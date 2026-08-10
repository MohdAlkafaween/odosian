import { prisma } from "./prisma";
import { elasticFetch, type ElasticFetchResponse } from "./elastic-fetch";
import { HttpError, type SyncFieldDiff } from "./errors";

// The subset of a rule's content that's actually meaningful to compare —
// deliberately narrower than every column on Rule (tags/index/etc. drift
// far more often and far less consequentially; these five are what someone
// editing a rule, in Odosian or directly in Kibana, is actually changing).
export interface SyncSnapshot {
  title: string;
  description: string;
  query: string;
  severity: string;
  riskScore: number;
}

export type SyncStatus = "not_linked" | "remote_missing" | "in_sync" | "local_ahead" | "remote_ahead" | "diverged";

export interface SyncCheckResult {
  status: SyncStatus;
  local: SyncSnapshot | null;
  remote: SyncSnapshot | null;
  diffs: SyncFieldDiff[];
}

const FIELD_LABELS: Record<keyof SyncSnapshot, string> = {
  title: "Title",
  description: "Description",
  query: "Query",
  severity: "Severity",
  riskScore: "Risk Score",
};

function diffSnapshots(local: SyncSnapshot, remote: SyncSnapshot): SyncFieldDiff[] {
  const diffs: SyncFieldDiff[] = [];
  for (const key of Object.keys(FIELD_LABELS) as Array<keyof SyncSnapshot>) {
    if (String(local[key]) !== String(remote[key])) {
      diffs.push({ field: key, label: FIELD_LABELS[key], local: String(local[key]), remote: String(remote[key]) });
    }
  }
  return diffs;
}

export function snapshotOf(rule: { title: string; description: string; query: string; severity: string; riskScore: number }): SyncSnapshot {
  return { title: rule.title, description: rule.description, query: rule.query, severity: rule.severity, riskScore: rule.riskScore };
}

// Fetches the rule's live counterpart from Elastic and compares it against
// both the rule's current local values and the stored "last synced"
// snapshot (the merge base) — the same three-way comparison git uses to
// classify a branch as ahead, behind, or diverged from its upstream.
export async function checkElasticSync(ruleId: string): Promise<SyncCheckResult> {
  const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new HttpError("Rule not found", 404);

  if (!rule.elasticRuleId || !rule.elasticConnectionId) {
    return { status: "not_linked", local: null, remote: null, diffs: [] };
  }

  const connection = await prisma.elasticConnection.findUnique({ where: { id: rule.elasticConnectionId } });
  if (!connection) throw new HttpError("Elastic connection not found", 404);

  const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
  const spacePrefix = connection.spaceId && connection.spaceId !== "default" ? `/s/${connection.spaceId}` : "";
  const url = `${baseUrl}${spacePrefix}/api/detection_engine/rules?rule_id=${encodeURIComponent(rule.elasticRuleId)}`;

  let res: ElasticFetchResponse;
  try {
    res = await elasticFetch(
      url,
      { headers: { Authorization: `ApiKey ${connection.apiKey}`, "kbn-xsrf": "true" }, timeoutMs: 15000 },
      connection.verifySsl
    );
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
    throw new HttpError(`Failed to reach Elastic: ${msg}`, 502);
  }

  if (res.status === 404) {
    return { status: "remote_missing", local: snapshotOf(rule), remote: null, diffs: [] };
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new HttpError(body.message || body.error || `Elastic returned ${res.status}`, 502);
  }

  const er = (await res.json()) as { name: string; description?: string; query?: string; severity: string; risk_score: number };
  const local = snapshotOf(rule);
  const remote: SyncSnapshot = {
    title: er.name,
    description: er.description || "",
    query: er.query || "",
    severity: er.severity,
    riskScore: er.risk_score,
  };

  const base: SyncSnapshot | null = rule.elasticSyncedSnapshot ? JSON.parse(rule.elasticSyncedSnapshot) : null;

  // No base recorded — either this rule was linked before this feature
  // existed, or a push/pull already happened without one. Can't tell
  // ahead/behind apart without a base, so fall back to a direct comparison:
  // matching means in sync, any difference is treated as diverged (the
  // safer of the two guesses — it blocks and asks, rather than guessing a
  // direction and possibly overwriting the wrong side).
  if (!base) {
    const diffs = diffSnapshots(local, remote);
    return { status: diffs.length === 0 ? "in_sync" : "diverged", local, remote, diffs };
  }

  const localChanged = diffSnapshots(local, base).length > 0;
  const remoteChanged = diffSnapshots(remote, base).length > 0;
  const diffs = diffSnapshots(local, remote);

  let status: SyncStatus;
  if (!localChanged && !remoteChanged) status = "in_sync";
  else if (localChanged && !remoteChanged) status = "local_ahead";
  else if (!localChanged && remoteChanged) status = "remote_ahead";
  else status = "diverged";

  return { status, local, remote, diffs };
}

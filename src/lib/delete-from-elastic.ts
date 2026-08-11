import { prisma } from "./prisma";
import { HttpError } from "./errors";
import { logAudit } from "./audit";
import { elasticFetch, type ElasticFetchResponse } from "./elastic-fetch";
import { markRuleDeprecated } from "./rule-status";

// Push and elastic-enabled cover create/update and pause/resume, but there
// was no way to actually remove a rule from Elastic short of doing it
// manually in Kibana — pausing still leaves it sitting there. This is the
// third leg of full lifecycle control from Odosian: push, pause/resume,
// delete, all without leaving the app.
export async function deleteRuleFromElastic(ruleId: string, userId: string, ipAddress?: string): Promise<{ deleted: boolean }> {
  const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!rule) throw new HttpError("Rule not found", 404);
  if (!rule.elasticRuleId || !rule.elasticConnectionId) {
    throw new HttpError("This rule isn't deployed to Elastic", 400);
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
      { method: "DELETE", headers: { Authorization: `ApiKey ${connection.apiKey}`, "kbn-xsrf": "true" }, timeoutMs: 15000 },
      connection.verifySsl
    );
  } catch (fetchErr: unknown) {
    const msg = fetchErr instanceof Error ? fetchErr.message : "Connection failed";
    throw new HttpError(`Failed to reach Elastic: ${msg}`, 502);
  }

  // A 404 here means the rule is already gone from Elastic's side (deleted
  // directly in Kibana, say) — that's the same end state we're trying to
  // reach, so treat it as success rather than failing on it.
  if (!res.ok && res.status !== 404) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new HttpError(body.message || body.error || `Elastic returned ${res.status}`, 502);
  }

  await prisma.rule.update({
    where: { id: ruleId },
    data: {
      elasticRuleId: null,
      elasticEnabled: false,
      elasticConnectionId: null,
      elasticSyncedSnapshot: "",
      elasticSyncedAt: null,
      // "covered" (analyzed + enhanced + pushed + enabled) is no longer
      // true the moment the rule stops being pushed at all.
      covered: false,
      coveredAt: null,
    },
  });

  await markRuleDeprecated(ruleId);

  logAudit({
    userId,
    action: "RULE_DELETED_FROM_ELASTIC",
    targetType: "rule",
    targetId: ruleId,
    details: { elasticRuleId: rule.elasticRuleId, connectionName: connection.name },
    ipAddress,
  });

  return { deleted: true };
}

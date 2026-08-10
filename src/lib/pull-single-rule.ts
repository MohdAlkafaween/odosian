import { prisma } from "./prisma";
import { HttpError, SyncConflictError } from "./errors";
import { logAudit } from "./audit";
import { checkElasticSync, snapshotOf } from "./elastic-sync-check";

export interface PullSingleRuleResult {
  title: string;
  description: string;
  query: string;
  severity: string;
  riskScore: number;
}

// The single-rule counterpart to bulk pull-rules — brings just this rule's
// live Elastic content back into Odosian. Same conflict protection as
// pushRuleToElastic, mirrored: refuses to overwrite local edits that
// haven't been pushed yet (or genuine divergence) unless forced.
export async function pullSingleRuleFromElastic(
  ruleId: string,
  userId: string,
  ipAddress?: string,
  force = false
): Promise<PullSingleRuleResult> {
  const check = await checkElasticSync(ruleId);

  if (check.status === "not_linked") throw new HttpError("This rule isn't linked to an Elastic rule yet", 400);
  if (check.status === "remote_missing") throw new HttpError("This rule's linked Elastic rule no longer exists", 404);
  if (!check.remote) throw new HttpError("Failed to read the rule's current Elastic content", 502);

  if (!force && (check.status === "diverged" || check.status === "local_ahead")) {
    throw new SyncConflictError(
      check.status === "diverged"
        ? "This rule has changed in both Odosian and Elastic since the last sync — pulling would overwrite your local changes."
        : "This rule has local changes that haven't been pushed yet — pulling would overwrite them.",
      check.status,
      check.diffs
    );
  }

  const rule = await prisma.rule.update({
    where: { id: ruleId },
    data: {
      title: check.remote.title,
      description: check.remote.description,
      query: check.remote.query,
      severity: check.remote.severity,
      riskScore: check.remote.riskScore,
      version: { increment: 1 },
      // What we just pulled is, by definition, also what Elastic has — new
      // merge base for the next Check/push/pull.
      elasticSyncedSnapshot: JSON.stringify(snapshotOf(check.remote)),
      elasticSyncedAt: new Date(),
    },
  });

  logAudit({
    userId,
    action: "RULE_PULLED_FROM_ELASTIC",
    targetType: "rule",
    targetId: ruleId,
    details: { elasticRuleId: rule.elasticRuleId },
    ipAddress,
  });

  return { title: rule.title, description: rule.description, query: rule.query, severity: rule.severity, riskScore: rule.riskScore };
}

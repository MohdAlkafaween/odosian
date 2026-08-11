import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { setElasticRuleEnabled } from "@/lib/elastic-rule-status";
import { maybeAdvanceRuleStatus } from "@/lib/rule-status";

interface Body {
  enabled?: boolean;
}

// Pauses (enabled: false) or resumes (enabled: true) a rule already pushed
// to Elastic, without re-pushing its content. Uses the connection it was
// last pushed through (elasticConnectionId) rather than asking again.
export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const body = (await request.json().catch(() => ({}))) as Body;
    if (typeof body.enabled !== "boolean") return errorResponse("enabled (boolean) is required", 400);

    const rule = await prisma.rule.findUnique({ where: { id } });
    if (!rule) return errorResponse("Rule not found", 404);
    if (!rule.elasticRuleId) return errorResponse("Rule hasn't been pushed to Elastic yet", 400);
    if (!rule.elasticConnectionId) return errorResponse("No Elastic connection recorded for this rule — push it again to record one", 400);

    const connection = await prisma.elasticConnection.findUnique({ where: { id: rule.elasticConnectionId } });
    if (!connection) return errorResponse("Elastic connection not found", 404);
    if (!connection.isActive) return errorResponse("Elastic connection is inactive", 400);

    const baseUrl = connection.kibanaUrl.replace(/\/+$/, "");
    const spacePrefix = connection.spaceId && connection.spaceId !== "default" ? `/s/${connection.spaceId}` : "";

    const ok = await setElasticRuleEnabled(
      baseUrl,
      spacePrefix,
      connection.apiKey,
      rule.elasticRuleId,
      body.enabled,
      connection.verifySsl
    );
    if (!ok) return errorResponse("Failed to update rule status in Elastic", 502);

    await prisma.rule.update({ where: { id }, data: { elasticEnabled: body.enabled } });
    if (body.enabled) await maybeAdvanceRuleStatus(id);

    logAudit({
      userId: request.user.id,
      action: body.enabled ? "RULE_RESUMED_IN_ELASTIC" : "RULE_PAUSED_IN_ELASTIC",
      targetType: "rule",
      targetId: id,
      details: { elasticRuleId: rule.elasticRuleId, connectionName: connection.name },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, enabled: body.enabled });
  } catch (e) {
    console.error("Failed to update rule status in Elastic:", e);
    return errorResponse("Failed to update rule status in Elastic", 500);
  }
});

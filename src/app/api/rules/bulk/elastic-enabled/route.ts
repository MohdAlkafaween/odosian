import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";
import { setElasticRuleEnabled } from "@/lib/elastic-rule-status";

interface Body {
  ids?: string[];
  enabled?: boolean;
}

// Bulk pause/resume for rules already pushed to Elastic. Each rule is its
// own connection lookup + PATCH call (fast, synchronous — unlike batch
// analyze/enhance this has no AI latency, so a plain sequential loop in one
// request is enough; no need for the crash-resumable AnalysisBatch machinery).
export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;
    const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : [];
    if (ids.length === 0) return errorResponse("Select at least one rule", 400);
    if (typeof body.enabled !== "boolean") return errorResponse("enabled (boolean) is required", 400);

    const rules = await prisma.rule.findMany({
      where: { id: { in: ids } },
      include: { elasticConnection: true },
    });

    let updated = 0;
    let skipped = 0;
    const errors: { ruleId: string; title: string; reason: string }[] = [];

    for (const rule of rules) {
      if (!rule.elasticRuleId) { skipped++; continue; }
      if (!rule.elasticConnection) {
        errors.push({ ruleId: rule.id, title: rule.title, reason: "No Elastic connection recorded — push it again" });
        continue;
      }
      if (!rule.elasticConnection.isActive) {
        errors.push({ ruleId: rule.id, title: rule.title, reason: "Elastic connection is inactive" });
        continue;
      }

      const baseUrl = rule.elasticConnection.kibanaUrl.replace(/\/+$/, "");
      const spacePrefix = rule.elasticConnection.spaceId && rule.elasticConnection.spaceId !== "default"
        ? `/s/${rule.elasticConnection.spaceId}`
        : "";

      const ok = await setElasticRuleEnabled(
        baseUrl,
        spacePrefix,
        rule.elasticConnection.apiKey,
        rule.elasticRuleId,
        body.enabled,
        rule.elasticConnection.verifySsl
      );

      if (ok) {
        await prisma.rule.update({ where: { id: rule.id }, data: { elasticEnabled: body.enabled } });
        updated++;
      } else {
        errors.push({ ruleId: rule.id, title: rule.title, reason: "Elastic rejected the request" });
      }
    }

    logAudit({
      userId: request.user.id,
      action: body.enabled ? "RULES_BULK_RESUMED_IN_ELASTIC" : "RULES_BULK_PAUSED_IN_ELASTIC",
      targetType: "rule",
      targetId: ids.join(","),
      details: { updated, skipped, failed: errors.length },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ updated, skipped, failed: errors.length, errors });
  } catch (e) {
    console.error("Failed to bulk update rule status in Elastic:", e);
    return errorResponse("Failed to bulk update rule status in Elastic", 500);
  }
});

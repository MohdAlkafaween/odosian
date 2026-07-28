import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

const ODOSIAN_PREFIX = "#odosian ";

interface ApplyEnhancementBody {
  enhancedTitle?: string;
  enhancedDescription?: string;
  enhancedQuery?: string;
  newSeverity?: string;
  newRiskScore?: number;
  investigationGuide?: string;
  falsePositives?: string[];
  references?: string[];
  indexPatterns?: string[];
}

// Enhance only ever produces a preview (see /api/analysis/enhance) — nothing
// gets written onto the rule until this endpoint is called with that
// preview's fields. Rules that originated from an AI "Generate" (source ===
// "generated") get "#odosian " prepended to their title here, once, marking
// them as AI-authored content that's been through a human-reviewed
// enhancement pass rather than pushed to Elastic untouched.
export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.rule.findUnique({ where: { id } });
    if (!existing) return errorResponse("Rule not found", 404);

    if (existing.authorId !== request.user.id && request.user.role !== "ADMIN") {
      return errorResponse("You can only edit your own rules", 403);
    }

    await prisma.ruleVersion.create({
      data: {
        ruleId: id,
        version: existing.version,
        title: existing.title,
        description: existing.description,
        query: existing.query,
        severity: existing.severity,
        riskScore: existing.riskScore,
        ruleType: existing.ruleType,
        language: existing.language,
        index: existing.index,
        tags: existing.tags,
        status: existing.status,
        interval: existing.interval,
        fromTime: existing.fromTime,
        maxSignals: existing.maxSignals,
        investigationGuide: existing.investigationGuide,
        falsePositives: existing.falsePositives,
        references: existing.references,
        changedBy: request.user.id,
      },
    });

    const body = (await request.json().catch(() => ({}))) as ApplyEnhancementBody;

    let title = body.enhancedTitle?.trim() || existing.title;
    if (existing.source === "generated" && !title.startsWith(ODOSIAN_PREFIX)) {
      title = `${ODOSIAN_PREFIX}${title}`;
    }

    const data: Record<string, unknown> = {
      title,
      version: existing.version + 1,
    };

    if (body.enhancedDescription !== undefined) data.description = body.enhancedDescription;
    if (body.enhancedQuery !== undefined) data.query = body.enhancedQuery;
    if (body.newSeverity !== undefined) data.severity = body.newSeverity;
    if (body.newRiskScore !== undefined) data.riskScore = body.newRiskScore;
    if (body.investigationGuide !== undefined) data.investigationGuide = body.investigationGuide;
    if (body.falsePositives !== undefined) data.falsePositives = JSON.stringify(body.falsePositives);
    if (body.references !== undefined) data.references = JSON.stringify(body.references);
    if (body.indexPatterns !== undefined) data.index = body.indexPatterns.join(", ");

    const rule = await prisma.rule.update({ where: { id }, data });

    logAudit({
      userId: request.user.id,
      action: "RULE_ENHANCEMENT_APPLIED",
      targetType: "rule",
      targetId: id,
      details: { title },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true, title: rule.title });
  } catch (e) {
    console.error("Failed to apply enhancement:", e);
    return errorResponse("Failed to apply enhancement", 500);
  }
});

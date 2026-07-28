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

    if (body.enhancedDescription !== undefined) data.description = String(body.enhancedDescription);
    if (body.enhancedQuery !== undefined) data.query = String(body.enhancedQuery);
    if (body.newSeverity !== undefined) data.severity = String(body.newSeverity);
    if (body.newRiskScore !== undefined) {
      // AI providers occasionally emit numeric fields as quoted strings
      // (e.g. "75" instead of 75) depending on the model/gateway — Prisma's
      // Int column rejects that outright, so coerce and validate here rather
      // than let a malformed AI response crash the whole apply.
      const riskScore = Math.round(Number(body.newRiskScore));
      if (Number.isFinite(riskScore)) {
        data.riskScore = Math.min(100, Math.max(0, riskScore));
      }
    }
    if (body.investigationGuide !== undefined) data.investigationGuide = String(body.investigationGuide);
    if (body.falsePositives !== undefined) data.falsePositives = JSON.stringify(Array.isArray(body.falsePositives) ? body.falsePositives : []);
    if (body.references !== undefined) data.references = JSON.stringify(Array.isArray(body.references) ? body.references : []);
    if (body.indexPatterns !== undefined && Array.isArray(body.indexPatterns)) data.index = body.indexPatterns.join(", ");

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

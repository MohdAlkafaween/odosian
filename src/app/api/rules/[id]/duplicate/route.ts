import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const original = await prisma.rule.findUnique({ where: { id } });
    if (!original) return errorResponse("Rule not found", 404);

    const duplicate = await prisma.rule.create({
      data: {
        title: `${original.title} (Copy)`,
        description: original.description,
        ruleType: original.ruleType,
        severity: original.severity,
        riskScore: original.riskScore,
        query: original.query,
        language: original.language,
        index: original.index,
        tags: original.tags,
        status: "draft",
        version: 1,
        parentRuleId: original.id,
        investigationGuide: original.investigationGuide,
        falsePositives: original.falsePositives,
        references: original.references,
        interval: original.interval,
        fromTime: original.fromTime,
        maxSignals: original.maxSignals,
        authorId: request.user.id,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    logAudit({
      userId: request.user.id,
      action: "RULE_DUPLICATED",
      targetType: "rule",
      targetId: duplicate.id,
      details: { sourceRuleId: id },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ rule: duplicate }, { status: 201 });
  } catch (e) {
    console.error("Failed to duplicate rule:", e);
    return errorResponse("Failed to duplicate rule", 500);
  }
});

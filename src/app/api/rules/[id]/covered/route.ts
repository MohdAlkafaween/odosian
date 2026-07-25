import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";

export const PATCH = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const existing = await prisma.rule.findUnique({ where: { id }, select: { id: true, covered: true, title: true } });
    if (!existing) return errorResponse("Rule not found", 404);

    const body = await request.json().catch(() => ({}));
    const covered = typeof body.covered === "boolean" ? body.covered : !existing.covered;

    const rule = await prisma.rule.update({
      where: { id },
      data: { covered, coveredAt: covered ? new Date() : null },
    });

    logAudit({
      userId: request.user.id,
      action: covered ? "RULE_MARKED_COVERED" : "RULE_MARKED_UNCOVERED",
      targetType: "rule",
      targetId: id,
      details: { title: existing.title },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ covered: rule.covered, coveredAt: rule.coveredAt });
  } catch (e) {
    console.error("Failed to update rule coverage:", e);
    return errorResponse("Failed to update rule coverage", 500);
  }
});

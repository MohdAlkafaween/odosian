import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { logAudit, getClientIp } from "@/lib/audit";

const VALID_STATUSES = ["draft", "active", "testing", "deprecated", "archived"];
const VALID_SEVERITIES = ["low", "medium", "high", "critical"];

export const PATCH = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    let body: { ids?: string[]; action?: string; value?: string };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid request body", 400);
    }

    const { ids, action, value } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse("ids must be a non-empty array", 400);
    }
    if (action !== "status" && action !== "severity") {
      return errorResponse("action must be 'status' or 'severity'", 400);
    }
    if (!value || typeof value !== "string") {
      return errorResponse("value is required", 400);
    }

    if (action === "status" && !VALID_STATUSES.includes(value)) {
      return errorResponse(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`, 400);
    }
    if (action === "severity" && !VALID_SEVERITIES.includes(value)) {
      return errorResponse(`Invalid severity. Must be one of: ${VALID_SEVERITIES.join(", ")}`, 400);
    }

    let targetIds = ids;
    if (request.user.role !== "ADMIN") {
      const ownedRules = await prisma.rule.findMany({
        where: { id: { in: ids }, authorId: request.user.id },
        select: { id: true },
      });
      targetIds = ownedRules.map((r) => r.id);
    }

    let updated = 0;
    for (const ruleId of targetIds) {
      const rule = await prisma.rule.findUnique({ where: { id: ruleId }, select: { version: true } });
      if (!rule) continue;

      const data: Record<string, unknown> = { version: rule.version + 1 };
      if (action === "status") data.status = value;
      if (action === "severity") data.severity = value;

      await prisma.rule.update({ where: { id: ruleId }, data });
      updated++;
    }

    logAudit({
      userId: request.user.id,
      action: "BULK_UPDATE",
      targetType: "rule",
      targetId: targetIds.join(","),
      details: { action, value, count: updated },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ updated });
  } catch (e) {
    console.error("Failed to bulk update rules:", e);
    return errorResponse("Failed to bulk update rules", 500);
  }
});

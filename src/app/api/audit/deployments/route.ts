import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

const DEPLOYMENT_ACTIONS = ["RULE_PUSHED_TO_ELASTIC", "RULE_UPDATED_IN_ELASTIC", "RULE_PULLED_FROM_ELASTIC"];

// Pushes/pulls to Elastic are rule mutations, not Analysis rows, so they
// never showed up anywhere in the History page before — they only ever
// existed in AuditLog, which nothing user-facing reads. This surfaces the
// same events (already being logged by pushRuleToElastic/
// pullSingleRuleFromElastic) as their own "Deployments" list.
export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const ruleId = url.searchParams.get("ruleId") || "";

    const where: Record<string, unknown> = { action: { in: DEPLOYMENT_ACTIONS } };
    if (ruleId) where.targetId = ruleId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const ruleIds = [...new Set(logs.map((l) => l.targetId).filter(Boolean))];
    const rules = await prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true, title: true },
    });
    const ruleTitleById = new Map(rules.map((r) => [r.id, r.title]));

    return NextResponse.json({
      deployments: logs.map((l) => {
        let details: Record<string, unknown> = {};
        try { details = JSON.parse(l.details || "{}"); } catch { /* leave empty */ }
        return {
          id: l.id,
          action: l.action,
          ruleId: l.targetId,
          ruleTitle: ruleTitleById.get(l.targetId) || "(deleted rule)",
          user: l.user.name,
          elasticRuleId: details.elasticRuleId ?? null,
          connectionName: details.connectionName ?? null,
          enabled: details.enabled ?? null,
          duplicated: details.duplicated ?? false,
          createdAt: l.createdAt,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("Failed to list deployments:", e);
    return errorResponse("Failed to fetch deployments", 500);
  }
});

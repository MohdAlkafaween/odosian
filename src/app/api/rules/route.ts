import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { ruleCreateSchema, validateRequest } from "@/lib/validation";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";
import { syncRuleCategoryProject } from "@/lib/category-projects";

function parseJsonFields(rule: Record<string, unknown>) {
  return {
    ...rule,
    tags: JSON.parse((rule.tags as string) || "[]"),
    falsePositives: JSON.parse((rule.falsePositives as string) || "[]"),
    references: JSON.parse((rule.references as string) || "[]"),
  };
}

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const search = url.searchParams.get("search") || "";
    const severity = url.searchParams.get("severity") || "";
    const status = url.searchParams.get("status") || "";
    const ruleType = url.searchParams.get("ruleType") || "";
    const language = url.searchParams.get("language") || "";
    const client = url.searchParams.get("client") || "";
    const category = url.searchParams.get("category") || "";
    const covered = url.searchParams.get("covered") || "";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (severity) where.severity = severity;
    if (status) where.status = status;
    if (ruleType) where.ruleType = ruleType;
    if (language) where.language = language;
    if (client) where.client = client;
    if (category) where.category = category;
    if (covered === "true") where.covered = true;
    else if (covered === "false") where.covered = false;

    const allowedSorts = ["title", "severity", "createdAt", "updatedAt", "riskScore", "status"];
    const orderField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";

    const { covered: _omitCovered, ...whereWithoutCovered } = where;
    void _omitCovered;

    const [rules, total, totalInScope, coveredInScope] = await Promise.all([
      prisma.rule.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: sortDir },
        include: {
          author: { select: { id: true, name: true } },
          _count: { select: { analyses: true } },
        },
      }),
      prisma.rule.count({ where }),
      prisma.rule.count({ where: whereWithoutCovered }),
      prisma.rule.count({ where: { ...whereWithoutCovered, covered: true } }),
    ]);

    return NextResponse.json({
      rules: rules.map(parseJsonFields),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      coverage: {
        covered: coveredInScope,
        total: totalInScope,
      },
    });
  } catch (e) {
    console.error("Failed to list rules:", e);
    return errorResponse("Failed to fetch rules", 500);
  }
});

export const POST = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const validated = await validateRequest(ruleCreateSchema, request);
    if ("error" in validated) return validated.error;

    const { tags, falsePositives, references, ...rest } = validated.data;

    const rule = await prisma.rule.create({
      data: {
        ...rest,
        tags: JSON.stringify(tags),
        falsePositives: JSON.stringify(falsePositives),
        references: JSON.stringify(references),
        authorId: request.user.id,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (rule.category) {
      await syncRuleCategoryProject(rule.id, rule.category, request.user.id);
    }

    logAudit({
      userId: request.user.id,
      action: "RULE_CREATED",
      targetType: "rule",
      targetId: rule.id,
      details: { title: rule.title },
      ipAddress: getClientIp(request),
    });

    dispatchWebhookEvent("rule.created", { ruleId: rule.id, title: rule.title });

    return NextResponse.json({ rule: parseJsonFields(rule as Record<string, unknown>) }, { status: 201 });
  } catch (e) {
    console.error("Failed to create rule:", e);
    return errorResponse("Failed to create rule", 500);
  }
});

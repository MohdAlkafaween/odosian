import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

const JSON_FIELDS = ["findings", "suggestions", "strengths", "weaknesses", "evasionRisks", "mitreMappings"];

function parseJsonFields(analysis: Record<string, unknown>) {
  const parsed = { ...analysis };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep string */ }
    }
  }
  return parsed;
}

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const analysisType = url.searchParams.get("analysisType") || "";
    const ruleId = url.searchParams.get("ruleId") || "";
    const critical = url.searchParams.get("critical") === "true";
    const sortBy = url.searchParams.get("sortBy") || "createdAt";
    const sortDir = url.searchParams.get("sortDir") === "asc" ? "asc" : "desc";

    const where: Record<string, unknown> = {};
    if (analysisType) where.analysisType = analysisType;
    if (ruleId) where.ruleId = ruleId;
    // Same substring match the dashboard's "Critical" stat card uses to
    // count these in the first place — a proper JSON query isn't available
    // on findings (stored as a plain string column), but every finding
    // object is serialized with double-quoted keys, so this can't
    // false-positive on anything other than an actual critical finding.
    if (critical) where.findings = { contains: '"severity":"critical"' };

    const allowedSorts = ["createdAt", "score", "analysisType"];
    const orderField = allowedSorts.includes(sortBy) ? sortBy : "createdAt";

    const [analyses, total] = await Promise.all([
      prisma.analysis.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { [orderField]: sortDir },
        include: {
          user: { select: { id: true, name: true } },
          rule: { select: { id: true, title: true } },
          // An analysis run as part of a batch has exactly one
          // AnalysisBatchItem pointing at it — surface that batch so it's
          // clear this result came from a bulk run, not a one-off action.
          batchItems: { select: { batchId: true } },
        },
      }),
      prisma.analysis.count({ where }),
    ]);

    return NextResponse.json({
      analyses: analyses.map((a) => {
        const { batchItems, ...rest } = a;
        return {
          ...parseJsonFields(rest as unknown as Record<string, unknown>),
          batchId: batchItems[0]?.batchId ?? null,
        };
      }),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (e) {
    console.error("Failed to list analyses:", e);
    return errorResponse("Failed to fetch analyses", 500);
  }
});

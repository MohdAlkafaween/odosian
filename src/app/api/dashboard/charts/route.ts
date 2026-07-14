import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      recentAnalyses, recentRules, analysisTypeGroups, languageGroups,
      statusGroups, mitreTacticGroups, mitreTechniqueGroups, totalRules,
      mitreMappings,
    ] = await Promise.all([
      prisma.analysis.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { score: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.rule.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.analysis.groupBy({ by: ["analysisType"], _count: true }),
      prisma.rule.groupBy({ by: ["language"], _count: true }),
      prisma.rule.groupBy({ by: ["status"], _count: true }),
      prisma.mitreMapping.groupBy({ by: ["tacticId"], _count: true }),
      prisma.mitreMapping.groupBy({ by: ["techniqueId"], _count: true }),
      prisma.rule.count(),
      prisma.mitreMapping.findMany({
        select: { tacticId: true, tacticName: true, techniqueId: true, techniqueName: true },
      }),
    ]);

    const scoreByDay: Record<string, { total: number; count: number }> = {};
    for (const a of recentAnalyses) {
      const key = toDateKey(a.createdAt);
      if (!scoreByDay[key]) scoreByDay[key] = { total: 0, count: 0 };
      scoreByDay[key].total += a.score;
      scoreByDay[key].count += 1;
    }
    const scoreTrend = Object.entries(scoreByDay).map(([date, { total, count }]) => ({
      date,
      avgScore: Math.round(total / count),
      count,
    }));

    const ruleByDay: Record<string, number> = {};
    for (const r of recentRules) {
      const key = toDateKey(r.createdAt);
      ruleByDay[key] = (ruleByDay[key] || 0) + 1;
    }
    const ruleTimeline = Object.entries(ruleByDay).map(([date, count]) => ({ date, count }));

    const analysisTypes = analysisTypeGroups.map((g) => ({
      type: g.analysisType,
      count: g._count,
    }));

    const rulesByLanguage = languageGroups.map((g) => ({
      language: g.language,
      count: g._count,
    }));

    const ruleStatusCounts: Record<string, number> = {};
    for (const g of statusGroups) {
      ruleStatusCounts[g.status] = g._count;
    }

    const tacticCoverage: Record<string, { name: string; techniques: string[] }> = {};
    for (const m of mitreMappings) {
      if (!tacticCoverage[m.tacticId]) {
        tacticCoverage[m.tacticId] = { name: m.tacticName, techniques: [] };
      }
      if (!tacticCoverage[m.tacticId].techniques.includes(m.techniqueId)) {
        tacticCoverage[m.tacticId].techniques.push(m.techniqueId);
      }
    }

    const mitreCoverage = {
      coveredTactics: Object.keys(tacticCoverage).length,
      coveredTechniques: mitreTechniqueGroups.length,
      totalMappings: mitreMappings.length,
      tactics: Object.entries(tacticCoverage).map(([id, data]) => ({
        id,
        name: data.name,
        techniqueCount: data.techniques.length,
      })),
    };

    return NextResponse.json({
      scoreTrend,
      ruleTimeline,
      analysisTypes,
      rulesByLanguage,
      ruleStatusCounts,
      totalRules,
      mitreCoverage,
    });
  } catch (e) {
    console.error("Failed to fetch chart data:", e);
    return errorResponse("Failed to fetch chart data", 500);
  }
});

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (_request: AuthenticatedRequest) => {
  try {
    const [totalRules, coveredRules, totalAnalyses, avgResult, severityGroups, recentAnalyses] =
      await Promise.all([
        prisma.rule.count(),
        prisma.rule.count({ where: { covered: true } }),
        prisma.analysis.count(),
        prisma.analysis.aggregate({ _avg: { score: true } }),
        prisma.rule.groupBy({ by: ["severity"], _count: true }),
        prisma.analysis.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            rule: { select: { id: true, title: true } },
            user: { select: { id: true, name: true } },
          },
        }),
      ]);

    const criticalAnalyses = await prisma.analysis.findMany({
      where: { findings: { contains: '"severity":"critical"' } },
      select: { id: true },
    });

    const severityDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };
    for (const g of severityGroups) {
      severityDistribution[g.severity] = g._count;
    }

    return NextResponse.json({
      stats: {
        totalRules,
        coveredRules,
        totalAnalyses,
        avgScore: Math.round(avgResult._avg.score || 0),
        criticalFindings: criticalAnalyses.length,
      },
      recentActivity: recentAnalyses.map((a) => ({
        id: a.id,
        analysisType: a.analysisType,
        score: a.score,
        rating: a.rating,
        createdAt: a.createdAt,
        rule: a.rule,
        user: a.user,
      })),
      severityDistribution,
    });
  } catch (e) {
    console.error("Failed to fetch dashboard stats:", e);
    return errorResponse("Failed to fetch stats", 500);
  }
});

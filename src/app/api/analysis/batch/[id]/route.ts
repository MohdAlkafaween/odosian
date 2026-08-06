import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  const { id } = await context.params as { id: string };

  const batch = await prisma.analysisBatch.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      items: {
        include: {
          rule: { select: { id: true, title: true } },
          analysis: { select: { score: true, rating: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });
  if (!batch) return errorResponse("Batch not found", 404);

  return NextResponse.json({
    batch: {
      id: batch.id,
      operation: batch.operation,
      status: batch.status,
      totalCount: batch.totalCount,
      completedCount: batch.completedCount,
      failedCount: batch.failedCount,
      skippedCount: batch.skippedCount,
      createdBy: batch.createdBy.name,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      items: batch.items.map((item) => ({
        id: item.id,
        ruleId: item.ruleId,
        ruleTitle: item.rule.title,
        status: item.status,
        error: item.error,
        analysisId: item.analysisId,
        score: item.analysis?.score ?? null,
        rating: item.analysis?.rating ?? null,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
      })),
    },
  });
});

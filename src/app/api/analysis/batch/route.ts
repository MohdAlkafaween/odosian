import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { processBatch } from "@/lib/batch-analysis";

interface BatchBody {
  ruleIds?: string[];
  operation?: string;
  sourceBatchId?: string;
}

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json().catch(() => ({}))) as BatchBody;
    const operation = body.operation === "enhance" ? "enhance" : body.operation === "post_enhance" ? "post_enhance" : "analyze";

    // "Analyze After Enhancement" for a whole batch — takes every rule the
    // given enhance batch successfully enhanced and analyzes the enhanced
    // query, instead of the caller re-selecting rules.
    if (operation === "post_enhance") {
      if (!body.sourceBatchId) return errorResponse("sourceBatchId is required", 400);
      const sourceItems = await prisma.analysisBatchItem.findMany({
        where: { batchId: body.sourceBatchId, status: "completed", analysisId: { not: null } },
        select: { ruleId: true, analysisId: true },
      });
      if (sourceItems.length === 0) return errorResponse("No completed enhancements found to analyze", 404);

      const batch = await prisma.analysisBatch.create({
        data: {
          operation,
          totalCount: sourceItems.length,
          createdById: request.user.id,
          items: {
            create: sourceItems.map((i) => ({ ruleId: i.ruleId, sourceAnalysisId: i.analysisId })),
          },
        },
      });

      processBatch(batch.id).catch((e) => console.error(`Batch ${batch.id} failed:`, e));
      return NextResponse.json({ batchId: batch.id }, { status: 201 });
    }

    const ruleIds = Array.isArray(body.ruleIds) ? [...new Set(body.ruleIds)] : [];

    if (ruleIds.length === 0) return errorResponse(`Select at least one rule to ${operation}`, 400);
    if (ruleIds.length > 100) return errorResponse(`Cannot ${operation} more than 100 rules at once`, 400);

    const existingRules = await prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true },
    });
    if (existingRules.length === 0) return errorResponse("None of the selected rules could be found", 404);

    const batch = await prisma.analysisBatch.create({
      data: {
        operation,
        totalCount: existingRules.length,
        createdById: request.user.id,
        items: { create: existingRules.map((r) => ({ ruleId: r.id })) },
      },
    });

    processBatch(batch.id).catch((e) => console.error(`Batch ${batch.id} failed:`, e));

    return NextResponse.json({ batchId: batch.id }, { status: 201 });
  } catch (e) {
    console.error("Failed to start batch analysis:", e);
    return errorResponse("Failed to start batch analysis", 500);
  }
});

export const GET = requireRole("DETECTION_ENG", "ADMIN")(async () => {
  const batches = await prisma.analysisBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { createdBy: { select: { name: true } } },
  });

  // Live counts (see batch-analysis.ts) in one aggregate query across all
  // listed batches, rather than trusting the stored counter columns.
  const grouped = await prisma.analysisBatchItem.groupBy({
    by: ["batchId", "status"],
    where: { batchId: { in: batches.map((b) => b.id) } },
    _count: true,
  });
  const countsByBatch = new Map<string, { completed: number; failed: number; skipped: number }>();
  for (const g of grouped) {
    const entry = countsByBatch.get(g.batchId) || { completed: 0, failed: 0, skipped: 0 };
    if (g.status === "completed") entry.completed = g._count;
    if (g.status === "failed") entry.failed = g._count;
    if (g.status === "skipped") entry.skipped = g._count;
    countsByBatch.set(g.batchId, entry);
  }

  return NextResponse.json({
    batches: batches.map((b) => {
      const counts = countsByBatch.get(b.id) || { completed: 0, failed: 0, skipped: 0 };
      return {
        id: b.id,
        operation: b.operation,
        status: b.status,
        totalCount: b.totalCount,
        completedCount: counts.completed,
        failedCount: counts.failed,
        skippedCount: counts.skipped,
        createdBy: b.createdBy.name,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    }),
  });
});

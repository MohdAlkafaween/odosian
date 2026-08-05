import { prisma } from "./prisma";
import { analyzeRule } from "./analyze-rule";
import { enhanceRule } from "./enhance-rule";

const OPERATIONS = { analyze: analyzeRule, enhance: enhanceRule } as const;

// Runs every pending/running item in a batch sequentially against the AI
// provider, persisting status after each one so progress survives a crash —
// only the single item that was mid-flight when the process died is ever
// re-run on resume, everything already completed is untouched.
export async function processBatch(batchId: string): Promise<void> {
  const batchMeta = await prisma.analysisBatch.update({
    where: { id: batchId },
    data: { status: "running" },
  });

  const runOperation = OPERATIONS[batchMeta.operation as keyof typeof OPERATIONS] || analyzeRule;

  const items = await prisma.analysisBatchItem.findMany({
    where: { batchId, status: { in: ["pending", "running"] } },
    orderBy: { id: "asc" },
  });

  for (const item of items) {
    await prisma.analysisBatchItem.update({
      where: { id: item.id },
      data: { status: "running", startedAt: new Date() },
    });

    try {
      const { analysis } = await runOperation(item.ruleId, batchMeta.createdById);

      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "completed", analysisId: analysis.id, completedAt: new Date() },
      });
      await prisma.analysisBatch.update({
        where: { id: batchId },
        data: { completedCount: { increment: 1 } },
      });
    } catch (e) {
      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "failed", error: e instanceof Error ? e.message : "Analysis failed", completedAt: new Date() },
      });
      await prisma.analysisBatch.update({
        where: { id: batchId },
        data: { failedCount: { increment: 1 } },
      });
    }
  }

  const batch = await prisma.analysisBatch.findUnique({ where: { id: batchId } });
  if (batch) {
    const finalStatus = batch.failedCount === 0 ? "completed" : batch.completedCount === 0 ? "failed" : "partial";
    await prisma.analysisBatch.update({ where: { id: batchId }, data: { status: finalStatus } });
  }
}

// Called once on server startup. Any batch left "running" (or with items
// still "running") means the process died mid-batch — the in-flight item's
// AI call never persisted a result, so it goes back to "pending" and the
// whole batch resumes automatically.
export async function resumeInterruptedBatches(): Promise<void> {
  const stuck = await prisma.analysisBatch.findMany({
    where: { status: { in: ["pending", "running"] } },
    select: { id: true },
  });

  for (const batch of stuck) {
    await prisma.analysisBatchItem.updateMany({
      where: { batchId: batch.id, status: "running" },
      data: { status: "pending", startedAt: null },
    });
    processBatch(batch.id).catch((e) => console.error(`Failed to resume batch ${batch.id}:`, e));
  }
}

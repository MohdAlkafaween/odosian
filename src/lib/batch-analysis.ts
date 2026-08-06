import { prisma } from "./prisma";
import { analyzeRule, postEnhanceAnalyzeRule } from "./analyze-rule";
import { enhanceRule } from "./enhance-rule";

const OPERATIONS = { analyze: analyzeRule, enhance: enhanceRule } as const;

// A pod restart mid-batch (e.g. `up.sh --rebuild`) can briefly overlap with
// the pod it's replacing during a rolling update — both alive, both able to
// call resumeInterruptedBatches on startup. Only treat a "running" item as
// orphaned (safe to hand to a fresh run) once it's been running long enough
// that a real AI call would have finished or errored out by then; otherwise
// a genuinely still-active old pod can have its in-flight item yanked away
// and reprocessed a second time by the new pod.
const STALE_RUNNING_MS = 10 * 60 * 1000;

// Live counts derived from the actual item rows rather than trusted counter
// columns — an item's status is idempotent (marking it "completed" twice
// doesn't create a second row), so this can never drift or exceed
// totalCount the way an incrementable counter can if the same item ever
// gets processed more than once (see STALE_RUNNING_MS above).
export async function computeBatchCounts(batchId: string) {
  const grouped = await prisma.analysisBatchItem.groupBy({
    by: ["status"],
    where: { batchId },
    _count: true,
  });
  const counts = { pending: 0, running: 0, completed: 0, failed: 0, skipped: 0 };
  for (const g of grouped) {
    if (g.status in counts) counts[g.status as keyof typeof counts] = g._count;
  }
  return counts;
}

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
    where: { batchId, status: "pending" },
    orderBy: { id: "asc" },
  });

  for (const item of items) {
    // Atomic claim: only succeeds if the item is still "pending" right now.
    // If another process already claimed it since the findMany above, this
    // affects 0 rows and we skip it — the two processes can never both
    // "win" the same item, so it's never run twice concurrently.
    const claim = await prisma.analysisBatchItem.updateMany({
      where: { id: item.id, status: "pending" },
      data: { status: "running", startedAt: new Date() },
    });
    if (claim.count === 0) continue;

    try {
      const { analysis } = batchMeta.operation === "post_enhance"
        ? await runPostEnhance(item.id, item.ruleId, item.sourceAnalysisId, batchMeta.createdById)
        : await runOperation(item.ruleId, batchMeta.createdById);

      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "completed", analysisId: analysis.id, completedAt: new Date() },
      });
    } catch (e) {
      await prisma.analysisBatchItem.update({
        where: { id: item.id },
        data: { status: "failed", error: e instanceof Error ? e.message : "Analysis failed", completedAt: new Date() },
      });
    }
  }

  await finalizeBatchIfDone(batchId);
}

async function runPostEnhance(itemId: string, ruleId: string, sourceAnalysisId: string | null, userId: string) {
  if (!sourceAnalysisId) throw new Error("Missing source enhancement for this item");
  const source = await prisma.analysis.findUnique({ where: { id: sourceAnalysisId } });
  if (!source || !source.outputQuery) throw new Error("Source enhancement not found or has no enhanced query");
  return postEnhanceAnalyzeRule(ruleId, userId, source.outputQuery);
}

// Recomputes a batch's overall status and counter columns once nothing is
// left pending/running (whether that's because processBatch finished, or
// because skipping the last remaining item just resolved it). Skipped items
// count as "handled" for done-ness but don't affect the completed/partial/
// failed label.
export async function finalizeBatchIfDone(batchId: string): Promise<void> {
  const counts = await computeBatchCounts(batchId);
  if (counts.pending > 0 || counts.running > 0) return;

  const finalStatus = counts.failed === 0 ? "completed" : counts.completed === 0 ? "failed" : "partial";
  await prisma.analysisBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      completedCount: counts.completed,
      failedCount: counts.failed,
      skippedCount: counts.skipped,
    },
  });
}

// Called once on server startup. Any batch left "running" (or with items
// still "running") means the process died mid-batch — the in-flight item's
// AI call never persisted a result, so it goes back to "pending" and the
// whole batch resumes automatically. Items that have only just started
// running are left alone in case the previous pod is still genuinely
// working on them (see STALE_RUNNING_MS).
export async function resumeInterruptedBatches(): Promise<void> {
  const stuck = await prisma.analysisBatch.findMany({
    where: { status: { in: ["pending", "running"] } },
    select: { id: true },
  });

  for (const batch of stuck) {
    await prisma.analysisBatchItem.updateMany({
      where: {
        batchId: batch.id,
        status: "running",
        startedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) },
      },
      data: { status: "pending", startedAt: null },
    });
    processBatch(batch.id).catch((e) => console.error(`Failed to resume batch ${batch.id}:`, e));
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { computeBatchCounts } from "@/lib/batch-analysis";

// Permanently gives up on every item not yet done — pending items become
// "skipped" (the same terminal state the per-item Skip button uses, so
// resume semantics stay consistent: skipped items are never picked back up).
// Anything already "running" is left alone; it's mid-flight and will finish
// or fail on its own, then processBatch's loop notices "cancelled" and stops
// claiming anything further.
export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  try {
    const { id } = await context.params as { id: string };

    const batch = await prisma.analysisBatch.findUnique({ where: { id } });
    if (!batch) return errorResponse("Batch not found", 404);
    if (!["pending", "running", "paused"].includes(batch.status)) {
      return errorResponse(`Can't stop a batch that's ${batch.status}`, 400);
    }

    await prisma.analysisBatch.update({ where: { id }, data: { status: "cancelled" } });
    await prisma.analysisBatchItem.updateMany({
      where: { batchId: id, status: "pending" },
      data: { status: "skipped" },
    });

    const counts = await computeBatchCounts(id);
    await prisma.analysisBatch.update({
      where: { id },
      data: { completedCount: counts.completed, failedCount: counts.failed, skippedCount: counts.skipped },
    });

    return NextResponse.json({ cancelled: true });
  } catch (e) {
    console.error("Failed to stop batch:", e);
    return errorResponse("Failed to stop batch", 500);
  }
});

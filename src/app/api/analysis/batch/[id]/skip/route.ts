import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { finalizeBatchIfDone } from "@/lib/batch-analysis";

interface SkipBody {
  itemId?: string;
}

// Excludes one rule from a batch — either before it's been picked up
// (pending) or after it failed, so it won't be swept up by a later resume.
// Can't skip something already running or completed.
export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  const { id } = await context.params as { id: string };
  const body = (await request.json().catch(() => ({}))) as SkipBody;
  if (!body.itemId) return errorResponse("itemId is required", 400);

  const item = await prisma.analysisBatchItem.findUnique({ where: { id: body.itemId } });
  if (!item || item.batchId !== id) return errorResponse("Batch item not found", 404);
  if (item.status !== "pending" && item.status !== "failed") {
    return errorResponse(`Cannot skip an item that's ${item.status}`, 400);
  }

  await prisma.analysisBatchItem.update({
    where: { id: item.id },
    data: { status: "skipped" },
  });

  // Recomputes and persists the counter columns too, in case this was the
  // last item — no manual increment/decrement needed since counts are
  // always derived from actual item status, never trusted as running totals.
  await finalizeBatchIfDone(id);

  return NextResponse.json({ success: true });
});

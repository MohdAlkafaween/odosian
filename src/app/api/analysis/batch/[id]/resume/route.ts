import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { processBatch } from "@/lib/batch-analysis";

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  const { id } = await context.params as { id: string };

  const batch = await prisma.analysisBatch.findUnique({ where: { id } });
  if (!batch) return errorResponse("Batch not found", 404);
  if (batch.status === "completed") return errorResponse("Batch already completed", 400);

  // Failed items are retried too — most failures here are transient
  // AI/provider errors, not something inherent to the rule.
  await prisma.analysisBatchItem.updateMany({
    where: { batchId: id, status: { in: ["running", "failed"] } },
    data: { status: "pending", startedAt: null },
  });
  await prisma.analysisBatch.update({
    where: { id },
    data: { failedCount: 0 },
  });

  processBatch(id).catch((e) => console.error(`Batch ${id} failed on resume:`, e));

  return NextResponse.json({ resumed: true });
});

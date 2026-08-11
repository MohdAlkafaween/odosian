import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

// Doesn't touch any item — just flips the status flag processBatch's loop
// checks between items. The in-flight item (if any) finishes normally;
// nothing after it gets claimed until /resume is called.
export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request, context) => {
  try {
    const { id } = await context.params as { id: string };

    const batch = await prisma.analysisBatch.findUnique({ where: { id } });
    if (!batch) return errorResponse("Batch not found", 404);
    if (batch.status !== "pending" && batch.status !== "running") {
      return errorResponse(`Can't pause a batch that's ${batch.status}`, 400);
    }

    await prisma.analysisBatch.update({ where: { id }, data: { status: "paused" } });
    return NextResponse.json({ paused: true });
  } catch (e) {
    console.error("Failed to pause batch:", e);
    return errorResponse("Failed to pause batch", 500);
  }
});

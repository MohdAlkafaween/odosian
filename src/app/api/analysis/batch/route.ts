import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { processBatch } from "@/lib/batch-analysis";

interface BatchBody {
  ruleIds?: string[];
}

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json().catch(() => ({}))) as BatchBody;
    const ruleIds = Array.isArray(body.ruleIds) ? [...new Set(body.ruleIds)] : [];

    if (ruleIds.length === 0) return errorResponse("Select at least one rule to analyze", 400);
    if (ruleIds.length > 100) return errorResponse("Cannot analyze more than 100 rules at once", 400);

    const existingRules = await prisma.rule.findMany({
      where: { id: { in: ruleIds } },
      select: { id: true },
    });
    if (existingRules.length === 0) return errorResponse("None of the selected rules could be found", 404);

    const batch = await prisma.analysisBatch.create({
      data: {
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

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      status: b.status,
      totalCount: b.totalCount,
      completedCount: b.completedCount,
      failedCount: b.failedCount,
      createdBy: b.createdBy.name,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    })),
  });
});

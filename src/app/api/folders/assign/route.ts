import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const POST = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { ruleIds, folderId } = body;

    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      return errorResponse("ruleIds array is required", 400);
    }

    if (folderId) {
      const folder = await prisma.ruleFolder.findUnique({ where: { id: folderId } });
      if (!folder) return errorResponse("Folder not found", 404);
    }

    await prisma.rule.updateMany({
      where: { id: { in: ruleIds } },
      data: { folderId: folderId || null },
    });

    return NextResponse.json({ success: true, updated: ruleIds.length });
  } catch (e) {
    console.error("Failed to assign rules to folder:", e);
    return errorResponse("Failed to assign rules", 500);
  }
});

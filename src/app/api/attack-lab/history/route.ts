import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const tacticId = url.searchParams.get("tacticId");
    const techniqueId = url.searchParams.get("techniqueId");

    const where: Record<string, unknown> = { userId: request.user.id };
    if (tacticId) where.tacticId = tacticId;
    if (techniqueId) where.techniqueId = techniqueId;

    const [simulations, total] = await Promise.all([
      prisma.attackSimulation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          techniqueId: true,
          techniqueName: true,
          tacticId: true,
          tacticName: true,
          status: true,
          aiPrompt: true,
          createdAt: true,
        },
      }),
      prisma.attackSimulation.count({ where }),
    ]);

    return NextResponse.json({
      simulations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error("Failed to fetch simulation history:", e);
    return errorResponse("Failed to fetch history", 500);
  }
});

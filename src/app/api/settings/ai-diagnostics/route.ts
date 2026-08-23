import { NextResponse } from "next/server";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { checkEngineHealth } from "@/lib/engine-client";
import { prisma } from "@/lib/prisma";

export const GET = requireRole("ADMIN")(async (_request: AuthenticatedRequest, _context) => {
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const [engineHealth, defaultProvider, todayStats] = await Promise.all([
    checkEngineHealth(),
    prisma.aIProvider.findFirst({ where: { isDefault: true, isActive: true } }),
    prisma.analysis.aggregate({
      where: { createdAt: { gte: today } },
      _count: true,
      _avg: { latencyMs: true },
    }),
  ]);

  return NextResponse.json({
    engine: {
      available: engineHealth.available,
      pipelineReady: engineHealth.pipelineReady,
      latencyMs: engineHealth.latencyMs,
    },
    provider: defaultProvider
      ? {
          name: defaultProvider.name,
          model: defaultProvider.model,
          baseUrl: defaultProvider.baseUrl,
          isActive: defaultProvider.isActive,
        }
      : null,
    performance: {
      totalToday: todayStats._count,
      avgLatencyMs: Math.round(todayStats._avg.latencyMs || 0),
    },
    mode: engineHealth.available && engineHealth.pipelineReady ? "engine" : "direct",
  });
});

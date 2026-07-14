import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

export const GET = authenticate(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const techniqueId = url.searchParams.get("techniqueId") || "";
    const tacticId = url.searchParams.get("tacticId") || "";

    if (!techniqueId && !tacticId) {
      return errorResponse("techniqueId or tacticId is required", 400);
    }

    const where: Record<string, string> = {};
    if (techniqueId) where.techniqueId = techniqueId;
    if (tacticId) where.tacticId = tacticId;

    const mappings = await prisma.mitreMapping.findMany({
      where,
      include: {
        rule: {
          select: {
            id: true,
            title: true,
            severity: true,
            status: true,
            ruleType: true,
            language: true,
            client: true,
            tags: true,
            query: true,
            updatedAt: true,
            author: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const seen = new Map<string, { confidence: number }>();
    const rules = mappings
      .filter((m) => m.rule)
      .map((m) => ({
        ...m.rule,
        tags: JSON.parse((m.rule.tags as string) || "[]"),
        confidence: m.confidence,
        mappingTacticName: m.tacticName,
        mappingTechniqueName: m.techniqueName,
      }))
      .filter((r) => {
        const existing = seen.get(r.id as string);
        if (existing) {
          if (r.confidence > existing.confidence) existing.confidence = r.confidence;
          return false;
        }
        seen.set(r.id as string, { confidence: r.confidence });
        return true;
      })
      .map((r) => ({ ...r, confidence: seen.get(r.id as string)!.confidence }));

    return NextResponse.json({ rules });
  } catch (e) {
    console.error("Failed to fetch MITRE rules:", e);
    return errorResponse("Failed to fetch MITRE rules", 500);
  }
});

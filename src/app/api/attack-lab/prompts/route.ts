import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";
import { z } from "zod/v4";
import { validateRequest } from "@/lib/validation";

export const GET = requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const url = new URL(request.url);
    const techniqueId = url.searchParams.get("techniqueId");

    if (techniqueId) {
      const prompt = await prisma.mitreAttackPrompt.findUnique({
        where: { techniqueId },
      });
      if (!prompt) return errorResponse("Prompt not found", 404);
      return NextResponse.json({ prompt });
    }

    const prompts = await prisma.mitreAttackPrompt.findMany({
      orderBy: { techniqueId: "asc" },
      select: {
        id: true,
        techniqueId: true,
        techniqueName: true,
        tacticId: true,
        tacticName: true,
        isActive: true,
      },
    });

    return NextResponse.json({ prompts });
  } catch (e) {
    console.error("Failed to fetch attack prompts:", e);
    return errorResponse("Failed to fetch prompts", 500);
  }
});

const updatePromptSchema = z.object({
  id: z.string().min(1),
  systemPrompt: z.string().min(10),
  isActive: z.boolean().optional(),
});

export const PUT = requireRole("ADMIN")(async (request: AuthenticatedRequest) => {
  try {
    const validated = await validateRequest(updatePromptSchema, request);
    if ("error" in validated) return validated.error;

    const { id, systemPrompt, isActive } = validated.data;

    const prompt = await prisma.mitreAttackPrompt.findUnique({ where: { id } });
    if (!prompt) return errorResponse("Prompt not found", 404);

    const updated = await prisma.mitreAttackPrompt.update({
      where: { id },
      data: {
        systemPrompt,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return NextResponse.json({ prompt: updated });
  } catch (e) {
    console.error("Failed to update prompt:", e);
    return errorResponse("Failed to update prompt", 500);
  }
});

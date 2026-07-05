import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { validateRequest } from "@/lib/validation";
import { callAIWithSystemPrompt } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";
import { z } from "zod/v4";
import { v4 as uuidv4 } from "uuid";

const simulateSchema = z.object({
  techniqueId: z.string().min(1, "Technique ID is required"),
  userMessage: z.string().min(1, "Message is required").max(5000),
  kaliConnectionId: z.string().optional(),
});

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export interface SimulationResult {
  explanation: string;
  prerequisites: string[];
  steps: { description: string; command: string; notes: string }[];
  expectedArtifacts: string[];
  detectionRules: { name: string; query: string; language: string }[];
  evasionVariants: { variant: string; detection: string }[];
}

export const POST = rateLimit("attack-lab", AI_RATE_LIMIT)(
  requireRole("ANALYST", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(simulateSchema, request);
      if ("error" in validated) return validated.error;

      const { techniqueId, userMessage, kaliConnectionId } = validated.data;

      const mitrePrompt = await prisma.mitreAttackPrompt.findUnique({
        where: { techniqueId },
      });

      if (!mitrePrompt) {
        return errorResponse(`No prompt found for technique ${techniqueId}`, 404);
      }

      const { result, modelUsed, tokensUsed, latencyMs } =
        await callAIWithSystemPrompt<SimulationResult>(mitrePrompt.systemPrompt, userMessage);

      const simulation = await prisma.attackSimulation.create({
        data: {
          id: uuidv4(),
          techniqueId: mitrePrompt.techniqueId,
          techniqueName: mitrePrompt.techniqueName,
          tacticId: mitrePrompt.tacticId,
          tacticName: mitrePrompt.tacticName,
          status: "completed",
          aiPrompt: userMessage,
          aiResponse: JSON.stringify(result),
          commands: JSON.stringify(result.steps?.map((s) => s.command) || []),
          kaliConnectionId: kaliConnectionId || null,
          userId: request.user.id,
        },
      });

      logAudit({
        userId: request.user.id,
        action: "SIMULATION_CREATED",
        targetType: "attack_simulation",
        targetId: simulation.id,
        details: { techniqueId, modelUsed, tokensUsed, latencyMs },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        simulation: {
          id: simulation.id,
          techniqueId: simulation.techniqueId,
          techniqueName: simulation.techniqueName,
          tacticName: simulation.tacticName,
          result,
          modelUsed,
          tokensUsed,
          latencyMs,
        },
      }, { status: 201 });
    } catch (e) {
      console.error("Simulation failed:", e);
      return aiErrorResponse(e, "Simulation failed");
    }
  })
);

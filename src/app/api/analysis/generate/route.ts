import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import { generateSchema, validateRequest } from "@/lib/validation";
import { callAI, type GenerateResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(generateSchema, request);
      if ("error" in validated) return validated.error;

      const { description, saveAsRule } = validated.data;

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<GenerateResult>("generate", description);

      const analysis = await prisma.analysis.create({
        data: {
          analysisType: "generate",
          inputQuery: description,
          outputQuery: result.query || "",
          score: result.score || 0,
          feedback: result.notes || "",
          mitreMappings: JSON.stringify(result.mitreMappings || []),
          modelUsed,
          tokensUsed,
          latencyMs,
          userId: request.user.id,
        },
      });

      let savedRuleId: string | undefined;

      if (saveAsRule) {
        const rule = await prisma.rule.create({
          data: {
            title: result.title || "Generated Rule",
            description: result.description || "",
            query: result.query || "",
            language: result.language || "kuery",
            ruleType: result.ruleType || "query",
            severity: result.severity || "medium",
            riskScore: result.riskScore || 50,
            tags: JSON.stringify(result.tags || []),
            index: result.indexPatterns?.join(", ") || "",
            interval: result.interval || "5m",
            fromTime: result.fromTime || "now-6m",
            maxSignals: result.maxSignals || 100,
            investigationGuide: result.investigationGuide || "",
            falsePositives: JSON.stringify(result.falsePositives || []),
            references: JSON.stringify(result.references || []),
            status: "draft",
            source: "generated",
            authorId: request.user.id,
          },
        });
        savedRuleId = rule.id;

        if (result.mitreMappings?.length > 0) {
          await prisma.mitreMapping.createMany({
            data: result.mitreMappings.map((m) => ({
              ruleId: rule.id,
              tacticId: m.tacticId,
              tacticName: m.tacticName,
              techniqueId: m.techniqueId,
              techniqueName: m.techniqueName,
              subTechniqueId: m.subTechniqueId,
              subTechniqueName: m.subTechniqueName,
              confidence: m.confidence,
            })),
          });
        }
      }

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType: "generate", savedRuleId },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        analysis: { ...analysis, ...result },
        savedRuleId,
      }, { status: 201 });
    } catch (e) {
      console.error("Generation failed:", e);
      return aiErrorResponse(e, "Generation failed");
    }
  })
);

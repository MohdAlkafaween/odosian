import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { analyzeSchema, validateRequest } from "@/lib/validation";
import { callAI, type AnalyzeResult } from "@/lib/ai";
import { buildRuleMessage, analyzeRule } from "@/lib/analyze-rule";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(analyzeSchema, request);
      if ("error" in validated) return validated.error;

      // Plain analysis of an existing rule (not a post-enhancement comparison)
      // shares its whole create+persist path with the batch processor.
      const isPostEnhancement = !!(validated.data.postEnhancement && validated.data.query);
      if (validated.data.ruleId && !isPostEnhancement) {
        const { analysis, result } = await analyzeRule(validated.data.ruleId, request.user.id);

        logAudit({
          userId: request.user.id,
          action: "ANALYSIS_CREATED",
          targetType: "analysis",
          targetId: analysis.id,
          details: { analysisType: "analyze", ruleId: validated.data.ruleId, score: result.score },
          ipAddress: getClientIp(request),
        });

        dispatchWebhookEvent("analysis.completed", {
          analysisId: analysis.id,
          ruleId: validated.data.ruleId,
          score: result.score,
          rating: result.rating,
        });

        return NextResponse.json({
          analysis: {
            ...analysis,
            findings: result.findings,
            suggestions: result.suggestions,
            strengths: result.strengths,
            weaknesses: result.weaknesses,
            evasionRisks: result.evasionRisks,
            mitreMappings: result.mitreMappings,
          },
        }, { status: 201 });
      }

      let userMessage: string;
      let ruleId: string | null = null;

      if (validated.data.ruleId) {
        const rule = await prisma.rule.findUnique({
          where: { id: validated.data.ruleId },
          include: { mitreMappings: true },
        });
        if (!rule) return errorResponse("Rule not found", 404);
        ruleId = rule.id;

        const originalQuery = rule.query;
        const ruleWithEnhancedQuery = { ...(rule as unknown as Record<string, unknown>), query: validated.data.query };
        userMessage = `This is a POST-ENHANCEMENT analysis. Compare the original query against the enhanced query and evaluate the improvements.

${buildRuleMessage(ruleWithEnhancedQuery, rule.mitreMappings)}

Original Query (before enhancement):
${originalQuery}`;
      } else {
        userMessage = `Detection Query (${validated.data.language || "kuery"}, ${validated.data.ruleType || "query"}):\n${validated.data.query}`;
      }

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<AnalyzeResult>("analyze", userMessage);

      const analysisType = validated.data.postEnhancement ? "post_enhance" : "analyze";

      const analysis = await prisma.analysis.create({
        data: {
          ruleId,
          analysisType,
          inputQuery: validated.data.query || "",
          score: result.score || 0,
          rating: result.rating || "",
          feedback: result.feedback || "",
          findings: JSON.stringify(result.findings || []),
          suggestions: JSON.stringify(result.suggestions || []),
          strengths: JSON.stringify(result.strengths || []),
          weaknesses: JSON.stringify(result.weaknesses || []),
          evasionRisks: JSON.stringify(result.evasionRisks || []),
          mitreMappings: JSON.stringify(result.mitreMappings || []),
          fpRisk: result.fpRisk || "low",
          modelUsed,
          tokensUsed,
          latencyMs,
          userId: request.user.id,
        },
      });

      if (ruleId && result.mitreMappings?.length > 0) {
        await prisma.mitreMapping.deleteMany({ where: { ruleId } });
        await prisma.mitreMapping.createMany({
          data: result.mitreMappings.map((m) => ({
            ruleId: ruleId!,
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

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType, ruleId, score: result.score },
        ipAddress: getClientIp(request),
      });

      dispatchWebhookEvent("analysis.completed", {
        analysisId: analysis.id,
        ruleId,
        score: result.score,
        rating: result.rating,
      });

      return NextResponse.json({
        analysis: {
          ...analysis,
          findings: result.findings,
          suggestions: result.suggestions,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          evasionRisks: result.evasionRisks,
          mitreMappings: result.mitreMappings,
        },
      }, { status: 201 });
    } catch (e) {
      console.error("Analysis failed:", e);
      return aiErrorResponse(e, "Analysis failed");
    }
  })
);

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { analyzeSchema, validateRequest } from "@/lib/validation";
import { callAI, type AnalyzeResult } from "@/lib/ai";
import { analyzeRule, postEnhanceAnalyzeRule } from "@/lib/analyze-rule";
import { logAudit, getClientIp } from "@/lib/audit";
import { aiErrorResponse } from "@/lib/errors";
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

      // Post-enhancement comparison of an existing rule also shares its
      // create+persist path with the batch processor.
      if (validated.data.ruleId && isPostEnhancement) {
        const { analysis, result } = await postEnhanceAnalyzeRule(validated.data.ruleId, request.user.id, validated.data.query!);

        logAudit({
          userId: request.user.id,
          action: "ANALYSIS_CREATED",
          targetType: "analysis",
          targetId: analysis.id,
          details: { analysisType: "post_enhance", ruleId: validated.data.ruleId, score: result.score },
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

      // Only the ad-hoc query path (no ruleId) is left inline.
      const userMessage = `Detection Query (${validated.data.language || "kuery"}, ${validated.data.ruleType || "query"}):\n${validated.data.query}`;

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<AnalyzeResult>("analyze", userMessage);

      const analysis = await prisma.analysis.create({
        data: {
          analysisType: "analyze",
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

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType: "analyze", ruleId: null, score: result.score },
        ipAddress: getClientIp(request),
      });

      dispatchWebhookEvent("analysis.completed", {
        analysisId: analysis.id,
        ruleId: null,
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

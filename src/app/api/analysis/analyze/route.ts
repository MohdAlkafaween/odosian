import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { rateLimit } from "@/lib/middleware";
import { analyzeSchema, validateRequest } from "@/lib/validation";
import { callAI, type AnalyzeResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";
import { dispatchWebhookEvent } from "@/lib/webhook-dispatcher";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

function buildRuleMessage(rule: Record<string, unknown>): string {
  const tags = typeof rule.tags === "string" ? JSON.parse(rule.tags as string) : rule.tags || [];
  const fps = typeof rule.falsePositives === "string" ? JSON.parse(rule.falsePositives as string) : rule.falsePositives || [];
  const refs = typeof rule.references === "string" ? JSON.parse(rule.references as string) : rule.references || [];

  return `Rule Title: ${rule.title}
Description: ${rule.description || "None"}
Rule Type: ${rule.ruleType}
Severity: ${rule.severity}
Risk Score: ${rule.riskScore}
Language: ${rule.language}
Index Patterns: ${rule.index || "Not specified"}
Interval: ${rule.interval}
From Time: ${rule.fromTime}
Max Signals: ${rule.maxSignals}
Tags: ${tags.length > 0 ? tags.join(", ") : "None"}
Investigation Guide: ${rule.investigationGuide || "None"}
False Positives: ${fps.length > 0 ? fps.join("; ") : "None documented"}
References: ${refs.length > 0 ? refs.join(", ") : "None"}

Detection Query:
${rule.query}`;
}

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(analyzeSchema, request);
      if ("error" in validated) return validated.error;

      let userMessage: string;
      let ruleId: string | null = null;

      if (validated.data.ruleId) {
        const rule = await prisma.rule.findUnique({ where: { id: validated.data.ruleId } });
        if (!rule) return errorResponse("Rule not found", 404);
        ruleId = rule.id;
        userMessage = buildRuleMessage(rule as unknown as Record<string, unknown>);
      } else {
        userMessage = `Detection Query (${validated.data.language || "kuery"}, ${validated.data.ruleType || "query"}):\n${validated.data.query}`;
      }

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<AnalyzeResult>("analyze", userMessage);

      const analysis = await prisma.analysis.create({
        data: {
          ruleId,
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
        details: { analysisType: "analyze", ruleId, score: result.score },
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

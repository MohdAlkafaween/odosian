import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import { enhanceSchema, validateRequest } from "@/lib/validation";
import { callAI, type EnhanceResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(enhanceSchema, request);
      if ("error" in validated) return validated.error;

      const rule = await prisma.rule.findUnique({ where: { id: validated.data.ruleId } });
      if (!rule) return errorResponse("Rule not found", 404);

      const latestAnalysis = await prisma.analysis.findFirst({
        where: { ruleId: rule.id, analysisType: "analyze" },
        orderBy: { createdAt: "desc" },
      });

      if (!latestAnalysis) {
        return errorResponse("Please analyze the rule first before enhancing it", 400);
      }

      const findings = JSON.parse(latestAnalysis.findings || "[]");
      const suggestions = JSON.parse(latestAnalysis.suggestions || "[]");
      const weaknesses = JSON.parse(latestAnalysis.weaknesses || "[]");

      const tags = JSON.parse(rule.tags || "[]");

      const userMessage = `Original Rule:
Title: ${rule.title}
Description: ${rule.description}
Rule Type: ${rule.ruleType}
Severity: ${rule.severity}
Risk Score: ${rule.riskScore}
Language: ${rule.language}
Index: ${rule.index || "Not specified"}
Tags: ${tags.join(", ") || "None"}
Investigation Guide: ${rule.investigationGuide || "None"}

Detection Query:
${rule.query}

Analysis Score: ${latestAnalysis.score}/100 (${latestAnalysis.rating})

Findings:
${findings.map((f: { severity: string; title: string; detail: string }) => `- [${f.severity}] ${f.title}: ${f.detail}`).join("\n")}

Suggestions:
${suggestions.map((s: { priority: number; title: string; description: string }) => `- [P${s.priority}] ${s.title}: ${s.description}`).join("\n")}

Weaknesses:
${weaknesses.map((w: string) => `- ${w}`).join("\n")}`;

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<EnhanceResult>("enhance", userMessage);

      const analysis = await prisma.analysis.create({
        data: {
          ruleId: rule.id,
          analysisType: "enhance",
          inputQuery: rule.query,
          outputQuery: result.enhancedQuery || "",
          score: latestAnalysis.score,
          rating: latestAnalysis.rating,
          feedback: JSON.stringify(result.changelog || []),
          mitreMappings: JSON.stringify(result.newMitreMappings || []),
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
        details: { analysisType: "enhance", ruleId: rule.id },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({ analysis: { ...analysis, ...result } }, { status: 201 });
    } catch (e) {
      console.error("Enhancement failed:", e);
      return aiErrorResponse(e, "Enhancement failed");
    }
  })
);

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import { feedbackSchema, validateRequest } from "@/lib/validation";
import { callAI, type FeedbackResult } from "@/lib/ai";
import { logAudit, getClientIp } from "@/lib/audit";
import { errorResponse, aiErrorResponse } from "@/lib/errors";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(feedbackSchema, request);
      if ("error" in validated) return validated.error;

      const { query, language } = validated.data;
      const userMessage = `Language: ${language}\n\nDetection Query:\n${query}`;

      const { result, modelUsed, tokensUsed, latencyMs } = await callAI<FeedbackResult>("feedback", userMessage);

      const analysis = await prisma.analysis.create({
        data: {
          analysisType: "feedback",
          inputQuery: query,
          score: result.score || 0,
          rating: result.rating || "",
          feedback: result.feedback || "",
          findings: JSON.stringify(result.topIssues || []),
          suggestions: JSON.stringify(result.quickFixes || []),
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
        details: { analysisType: "feedback", score: result.score },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        analysis: { ...analysis, ...result },
      }, { status: 201 });
    } catch (e) {
      console.error("Feedback failed:", e);
      return aiErrorResponse(e, "Feedback failed");
    }
  })
);

import { NextResponse } from "next/server";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import { enhanceSchema, validateRequest } from "@/lib/validation";
import { enhanceRule } from "@/lib/enhance-rule";
import { logAudit, getClientIp } from "@/lib/audit";
import { aiErrorResponse } from "@/lib/errors";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest) => {
    try {
      const validated = await validateRequest(enhanceSchema, request);
      if ("error" in validated) return validated.error;

      const { analysis, result } = await enhanceRule(validated.data.ruleId, request.user.id);

      logAudit({
        userId: request.user.id,
        action: "ANALYSIS_CREATED",
        targetType: "analysis",
        targetId: analysis.id,
        details: { analysisType: "enhance", ruleId: validated.data.ruleId },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({ analysis: { ...analysis, ...result } }, { status: 201 });
    } catch (e) {
      console.error("Enhancement failed:", e);
      return aiErrorResponse(e, "Enhancement failed");
    }
  })
);

import { NextResponse } from "next/server";
import { requireRole, rateLimit, type AuthenticatedRequest } from "@/lib/middleware";
import {
  engineAnalyzeSSE,
  engineEnhanceSSE,
  engineGenerateSSE,
  EngineUnavailableError,
} from "@/lib/engine-client";
import { buildRuleMessage } from "@/lib/analyze-rule";
import { prisma } from "@/lib/prisma";

const AI_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AI || "10");

export const POST = rateLimit("analysis", AI_RATE_LIMIT)(
  requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, _context) => {
    const body = await request.json();
    const { operation, ruleId, query, language, requirement } = body as {
      operation: "analyze" | "enhance" | "generate";
      ruleId?: string;
      query?: string;
      language?: string;
      requirement?: string;
    };

    try {
      let engineRes: Response;

      if (operation === "generate") {
        engineRes = await engineGenerateSSE({
          user_id: request.user.id,
          requirement: requirement || "",
        });
      } else if (ruleId) {
        const rule = await prisma.rule.findUnique({
          where: { id: ruleId },
          include: { mitreMappings: true },
        });
        if (!rule) {
          return new NextResponse(
            JSON.stringify({ error: "Rule not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
        const ruleMessage = buildRuleMessage(
          rule as unknown as Record<string, unknown>,
          rule.mitreMappings,
        );

        if (operation === "enhance") {
          engineRes = await engineEnhanceSSE({
            user_id: request.user.id,
            rule_text: ruleMessage,
            rule_id: ruleId,
          });
        } else {
          engineRes = await engineAnalyzeSSE({
            user_id: request.user.id,
            rule_text: ruleMessage,
            rule_id: ruleId,
          });
        }
      } else if (query) {
        engineRes = await engineAnalyzeSSE({
          user_id: request.user.id,
          query,
          language: language || "kuery",
        });
      } else {
        return new NextResponse(
          JSON.stringify({ error: "Missing ruleId, query, or requirement" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (!engineRes.body) {
        return new NextResponse(
          JSON.stringify({ error: "No response from engine" }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      return new NextResponse(engineRes.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (e) {
      if (e instanceof EngineUnavailableError) {
        return new NextResponse(
          `event: error\ndata: ${JSON.stringify({ error: "Engine unavailable — use standard analysis", fallback: true })}\n\n`,
          {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          },
        );
      }
      const msg = e instanceof Error ? e.message : "Unknown error";
      return new NextResponse(
        `event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        },
      );
    }
  }),
);

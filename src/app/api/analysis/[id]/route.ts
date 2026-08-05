import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

const JSON_FIELDS = ["findings", "suggestions", "strengths", "weaknesses", "evasionRisks", "mitreMappings"];

function parseJsonFields(analysis: Record<string, unknown>) {
  const parsed = { ...analysis };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep string */ }
    }
  }
  // Enhancement runs stash their full AI result (enhancedTitle, newSeverity,
  // investigationGuide, ...) here since those fields have no columns of
  // their own — merge it back in so this reads the same as the response
  // from /api/analysis/enhance right after the run.
  if (typeof parsed.enhanceResult === "string" && parsed.enhanceResult) {
    try {
      Object.assign(parsed, JSON.parse(parsed.enhanceResult as string));
    } catch { /* keep as-is */ }
  }
  return parsed;
}

export const GET = authenticate(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const analysis = await prisma.analysis.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        rule: { select: { id: true, title: true, query: true, language: true } },
      },
    });

    if (!analysis) return errorResponse("Analysis not found", 404);

    return NextResponse.json({
      analysis: parseJsonFields(analysis as unknown as Record<string, unknown>),
    });
  } catch (e) {
    console.error("Failed to fetch analysis:", e);
    return errorResponse("Failed to fetch analysis", 500);
  }
});

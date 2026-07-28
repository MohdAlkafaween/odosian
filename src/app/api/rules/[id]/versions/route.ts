import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { errorResponse } from "@/lib/errors";

const JSON_FIELDS = ["tags", "falsePositives", "references"];

function parseJsonFields(v: Record<string, unknown>) {
  const parsed = { ...v };
  for (const field of JSON_FIELDS) {
    if (typeof parsed[field] === "string") {
      try { parsed[field] = JSON.parse(parsed[field] as string); } catch { /* keep string */ }
    }
  }
  return parsed;
}

export const GET = authenticate(async (_request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };

    const versions = await prisma.ruleVersion.findMany({
      where: { ruleId: id },
      orderBy: { version: "desc" },
    });

    return NextResponse.json({
      versions: versions.map((v) => parseJsonFields(v as unknown as Record<string, unknown>)),
    });
  } catch (e) {
    console.error("Failed to fetch rule versions:", e);
    return errorResponse("Failed to fetch rule versions", 500);
  }
});

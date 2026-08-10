import { NextResponse } from "next/server";
import { authenticate, type AuthenticatedRequest } from "@/lib/middleware";
import { httpErrorResponse } from "@/lib/errors";
import { checkElasticSync } from "@/lib/elastic-sync-check";

// Read-only — the "git status" equivalent. Doesn't push or pull anything,
// just reports where this rule stands relative to its live Elastic copy.
export const GET = authenticate(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const result = await checkElasticSync(id);
    return NextResponse.json(result);
  } catch (e) {
    return httpErrorResponse(e, "Failed to check Elastic sync status");
  }
});

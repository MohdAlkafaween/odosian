import { NextResponse } from "next/server";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { httpErrorResponse } from "@/lib/errors";
import { getClientIp } from "@/lib/audit";
import { pullSingleRuleFromElastic } from "@/lib/pull-single-rule";

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const body = await request.json().catch(() => ({}));
    const { force = false } = body as { force?: boolean };

    const result = await pullSingleRuleFromElastic(id, request.user.id, getClientIp(request), force);
    return NextResponse.json(result);
  } catch (e) {
    return httpErrorResponse(e, "Failed to pull rule from Elastic");
  }
});

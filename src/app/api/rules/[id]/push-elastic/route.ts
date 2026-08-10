import { NextResponse } from "next/server";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { httpErrorResponse } from "@/lib/errors";
import { getClientIp } from "@/lib/audit";
import { pushRuleToElastic } from "@/lib/push-to-elastic";

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const body = await request.json();
    const { connectionId, enabled = false, force = false } = body;

    const result = await pushRuleToElastic(id, connectionId, enabled, request.user.id, getClientIp(request), force);
    return NextResponse.json(result);
  } catch (e) {
    console.error("Push to Elastic failed:", e);
    return httpErrorResponse(e, "Failed to push rule to Elastic");
  }
});

import { NextResponse } from "next/server";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { httpErrorResponse } from "@/lib/errors";
import { getClientIp } from "@/lib/audit";
import { deleteRuleFromElastic } from "@/lib/delete-from-elastic";

export const POST = requireRole("ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const result = await deleteRuleFromElastic(id, request.user.id, getClientIp(request));
    return NextResponse.json(result);
  } catch (e) {
    return httpErrorResponse(e, "Failed to remove rule from Elastic");
  }
});

import { NextResponse } from "next/server";
import { requireRole, type AuthenticatedRequest } from "@/lib/middleware";
import { httpErrorResponse } from "@/lib/errors";
import { getClientIp } from "@/lib/audit";
import { applyEnhancementToRule, type ApplyEnhancementInput } from "@/lib/apply-enhancement";

export const POST = requireRole("DETECTION_ENG", "ADMIN")(async (request: AuthenticatedRequest, context) => {
  try {
    const { id } = await context.params as { id: string };
    const body = (await request.json().catch(() => ({}))) as ApplyEnhancementInput;

    const result = await applyEnhancementToRule(
      id,
      request.user.id,
      request.user.role === "ADMIN",
      body,
      getClientIp(request)
    );

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error("Failed to apply enhancement:", e);
    return httpErrorResponse(e, "Failed to apply enhancement");
  }
});

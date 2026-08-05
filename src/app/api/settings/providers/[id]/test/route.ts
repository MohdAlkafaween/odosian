import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware";
import { testProviderConnection } from "@/lib/ai";
import { aiErrorResponse } from "@/lib/errors";

export const POST = requireRole("ADMIN")(async (_request, context) => {
  try {
    const { id } = await context.params as { id: string };
    const { modelUsed, latencyMs } = await testProviderConnection(id);
    return NextResponse.json({ success: true, modelUsed, latencyMs });
  } catch (e) {
    console.error("Provider connection test failed:", e);
    return aiErrorResponse(e, "Connection test failed");
  }
});

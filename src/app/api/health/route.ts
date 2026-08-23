import { NextResponse } from "next/server";
import { checkEngineHealth } from "@/lib/engine-client";

export async function GET() {
  let engine = { available: false, pipelineReady: false, latencyMs: 0 };
  try {
    engine = await checkEngineHealth();
  } catch {
    // engine down — non-blocking
  }

  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    engine,
  });
}

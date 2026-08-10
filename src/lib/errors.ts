import { NextResponse } from "next/server";
import { AIError } from "./ai";

export function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// Thrown by shared lib functions (applyEnhancementToRule, pushRuleToElastic)
// so callers driving them in a loop (bulk review/deploy) can catch a status
// code per-item instead of every failure collapsing to a generic 500.
export class HttpError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "HttpError";
  }
}

export function httpErrorResponse(e: unknown, fallbackMessage: string): NextResponse {
  if (e instanceof HttpError) return errorResponse(e.message, e.status);
  return errorResponse(e instanceof Error ? e.message : fallbackMessage, 500);
}

export function aiErrorResponse(e: unknown, fallbackMessage: string): NextResponse {
  if (e instanceof AIError) {
    const status =
      e.statusCode === 429 ? 429 :
      e.statusCode === 503 ? 503 :
      e.statusCode === 401 || e.statusCode === 403 ? 502 :
      e.statusCode >= 500 ? 503 :
      500;
    return errorResponse(e.message, status);
  }
  return errorResponse(
    e instanceof Error ? e.message : fallbackMessage,
    500,
  );
}

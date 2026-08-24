import { NextResponse } from "next/server";
import { AIError } from "./ai";
import {
  EngineValidationError,
  EngineAuthError,
  EngineRateLimitError,
} from "./engine-client";

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
  if (e instanceof HttpError) {
    if (e instanceof SyncConflictError) {
      return NextResponse.json({ error: e.message, conflict: true, status: e.syncStatus, diffs: e.diffs }, { status: e.status });
    }
    return errorResponse(e.message, e.status);
  }
  return errorResponse(e instanceof Error ? e.message : fallbackMessage, 500);
}

export interface SyncFieldDiff {
  field: string;
  label: string;
  local: string;
  remote: string;
}

// Thrown by pushRuleToElastic/pullSingleRuleFromElastic when the rule and
// its live Elastic counterpart have both changed since the last sync (or
// the side about to be overwritten has unsynced changes) and the caller
// didn't pass force:true — the git-push-rejected-as-non-fast-forward
// equivalent. Carries enough for the UI to show a diff instead of a bare
// error string.
export class SyncConflictError extends HttpError {
  constructor(message: string, public readonly syncStatus: string, public readonly diffs: SyncFieldDiff[]) {
    super(message, 409);
    this.name = "SyncConflictError";
  }
}

export function aiErrorResponse(e: unknown, fallbackMessage: string): NextResponse {
  if (e instanceof EngineValidationError) {
    return NextResponse.json(
      {
        error: e.message,
        category: e.category,
        issues: e.issues,
        structuredIssues: e.structuredIssues,
        validationRejection: true,
      },
      { status: 422 },
    );
  }
  if (e instanceof EngineAuthError) {
    return errorResponse(e.message, 401);
  }
  if (e instanceof EngineRateLimitError) {
    return errorResponse(e.message, 429);
  }
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

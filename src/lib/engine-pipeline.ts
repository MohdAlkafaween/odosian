// Drives an engine SSE run (/api/analysis/stream) to completion outside of
// any component's lifecycle. A tab only renders while it's the active one —
// if the request lived inside the component showing its progress, switching
// away would unmount it and, via its cleanup, abort the real HTTP request.
// Returning to the tab would then remount a fresh component with no memory
// of what happened, so it would fire an entirely new request from scratch.
// Starting the run here instead, once, at the moment the tab is created,
// and writing every update straight into the tab store, means the run
// keeps going (and its result lands in the store) regardless of which tab
// is on screen. What renders while it's active just reads that state.
import { registerTabController, clearTabController } from "./tab-controllers";
import { PIPELINE_STAGE_IDS } from "@/components/ui/pipeline-progress";
import type { AITab, StageStatus, ValidationRejection } from "@/stores/tabs";

export function initialStageProgress(): Record<string, StageStatus> {
  const stages: Record<string, StageStatus> = {};
  for (const id of PIPELINE_STAGE_IDS) stages[id] = "pending";
  return stages;
}

export type PipelineWriter = (patch: Partial<{
  status: "running" | "completed" | "failed";
  statusMessage: string;
  error: string;
  validationRejection: ValidationRejection;
  result: AITab["result"];
  stageProgress: Record<string, StageStatus>;
  pipelineStartedAt: number;
  useEngine: boolean;
}>) => void;

export function startEnginePipeline(opts: {
  runId: string;
  endpoint: string;
  body: Record<string, unknown>;
  write: PipelineWriter;
  // Called on any engine-side failure — connection loss, a timeout, a
  // provider hiccup, or the engine's own validation rejecting the result —
  // so the caller can fall back to a direct LLM call instead of surfacing
  // the failure. This trades the engine's grounding/validation guarantees
  // for always producing a result: a fallback result can contain something
  // the engine would have caught and rejected. Not called for an explicit
  // user cancellation — that stays a real "Cancelled", not a fallback.
  onFallback: () => void;
}): void {
  const { runId, endpoint, body, write, onFallback } = opts;
  const controller = new AbortController();
  registerTabController(runId, controller);
  // onFallback kicks off its own async request — guard against triggering
  // it twice for the same run (e.g. a malformed-but-error-shaped event
  // followed by the stream closing) and racing two direct-LLM calls
  // against the same tab.
  let fellBack = false;
  const fallbackOnce = () => {
    if (fellBack) return;
    fellBack = true;
    onFallback();
  };

  const stageProgress = initialStageProgress();
  write({ stageProgress: { ...stageProgress }, pipelineStartedAt: Date.now() });

  const markStageActive = (stage: string) => {
    for (const id of PIPELINE_STAGE_IDS) {
      if (stageProgress[id] === "active") stageProgress[id] = "completed";
    }
    if (stage in stageProgress) stageProgress[stage] = "active";
    write({ stageProgress: { ...stageProgress } });
  };

  const markAllCompleted = () => {
    for (const id of PIPELINE_STAGE_IDS) stageProgress[id] = "completed";
    write({ stageProgress: { ...stageProgress } });
  };

  (async () => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        fallbackOnce();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        fallbackOnce();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        let eventData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6).trim();
          } else if (line === "" && eventType && eventData) {
            try {
              const parsed = JSON.parse(eventData);
              if (eventType === "stage") {
                markStageActive(parsed.stage);
              } else if (eventType === "result") {
                markAllCompleted();
                // Gives a tab that's actively being watched a moment to show
                // every stage turning green before the view switches away to
                // the result — pure polish, harmless if nobody's watching.
                await new Promise((r) => setTimeout(r, 300));
                const data = parsed as Record<string, unknown>;
                write({ status: "completed", result: (data.analysis ?? data) as AITab["result"] });
              } else if (eventType === "error") {
                fallbackOnce();
                return;
              }
            } catch {
              // skip malformed events
            }
            eventType = "";
            eventData = "";
          }
        }
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        write({ status: "failed", error: "Cancelled" });
        return;
      }
      fallbackOnce();
    } finally {
      clearTabController(runId);
    }
  })();
}

// The engine-unavailable fallback for the top-level analyze/enhance/generate
// tabs: a plain non-streaming request to the equivalent direct-LLM route.
// Shared across every startEnginePipeline call site so the endpoint mapping
// and error handling live in one place.
export async function runDirectFallback(opts: {
  type: "analyze" | "enhance" | "generate";
  ruleId?: string;
  write: PipelineWriter;
}): Promise<void> {
  const { type, ruleId, write } = opts;
  write({ useEngine: false, statusMessage: "Using direct AI provider..." });
  const endpoint = type === "enhance" ? "/api/analysis/enhance" : type === "generate" ? "/api/analysis/generate" : "/api/analysis/analyze";
  // The engine was already tried and gave up on this same run — skip the
  // route's own internal engine-first attempt so a hang doesn't cost a
  // second full timeout before this fallback actually lands.
  const body: Record<string, unknown> = { skipEngine: true };
  if (ruleId) body.ruleId = ruleId;
  try {
    const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) {
      write({ status: "completed", result: data.analysis });
    } else {
      write({ status: "failed", error: data.error || "Failed" });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    write({ status: "failed", error: `Fallback failed: ${msg}` });
  }
}

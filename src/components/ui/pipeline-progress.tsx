"use client";

import { useEffect, useState, useRef } from "react";
import type { StageStatus } from "@/stores/tabs";

interface PipelineStage {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
}

const STAGES: PipelineStage[] = [
  {
    id: "parse",
    label: "Parsing rule structure",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "extract",
    label: "Extracting entities",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    id: "map",
    label: "Mapping to knowledge domains",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
    ),
  },
  {
    id: "retrieve",
    label: "Retrieving evidence",
    subtitle: "12,397 records",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: "context",
    label: "Building grounded context",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    ),
  },
  {
    id: "reason",
    label: "AI reasoning with evidence",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a8 8 0 0 0-8 8c0 3.37 2.69 6.15 4 7.46V20h8v-2.54c1.31-1.31 4-4.09 4-7.46a8 8 0 0 0-8-8z" />
        <line x1="10" y1="22" x2="14" y2="22" />
      </svg>
    ),
  },
  {
    id: "validate",
    label: "Validating claims",
    subtitle: "cross-referencing sources",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    id: "format",
    label: "Formatting results",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
];

interface StageState {
  status: StageStatus;
}

const MIN_STAGE_VISIBLE_MS = 500;
export const PIPELINE_STAGE_IDS: readonly string[] = STAGES.map((s) => s.id);
const STAGE_ORDER = PIPELINE_STAGE_IDS;

function toDisplayState(progress: Record<string, StageStatus> | undefined): Record<string, StageState> {
  const next: Record<string, StageState> = {};
  STAGE_ORDER.forEach((id) => {
    next[id] = { status: progress?.[id] ?? "pending" };
  });
  return next;
}

// The run this displays lives in src/lib/engine-pipeline.ts, entirely
// outside this component's lifecycle — it keeps going, and keeps writing
// stageProgress into the tab store, whether or not this is mounted to watch
// it. That's what makes switching tabs and back show real progress instead
// of restarting the run. This component only ever reads and displays;
// mounting or unmounting it never starts or stops anything.
//
// The one thing it still owns locally is the staggered reveal (each stage
// stays visibly "active" for at least MIN_STAGE_VISIBLE_MS) — a purely
// cosmetic smoothing pass over transitions observed while mounted. On first
// mount it snaps straight to the true current state instead of replaying
// a catch-up animation for stages that finished while nobody was looking.
export function PipelineProgress({
  stageProgress,
  startedAt,
}: {
  stageProgress: Record<string, StageStatus> | undefined;
  startedAt: number | undefined;
}) {
  const [stages, setStages] = useState<Record<string, StageState>>(() => toDisplayState(stageProgress));
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => startedAt ?? Date.now());

  const stageQueueRef = useRef<string[]>([]);
  const drainRunningRef = useRef(false);
  const lastVisualUpdateRef = useRef(0);
  // Index into STAGE_ORDER of the furthest stage the local display has
  // caught up to, so a jump of more than one stage between two observed
  // prop values (React can batch several store writes into one render)
  // replays every stage in between instead of silently skipping them —
  // a skipped stage would otherwise never be marked "active" locally and
  // so never get marked "completed" either, leaving it stuck at "pending"
  // forever even though the run genuinely finished it.
  const lastSeenIndexRef = useRef(
    (() => {
      const active = STAGE_ORDER.findIndex((id) => stageProgress?.[id] === "active");
      if (active >= 0) return active;
      let lastCompleted = -1;
      STAGE_ORDER.forEach((id, i) => {
        if (stageProgress?.[id] === "completed") lastCompleted = i;
      });
      return lastCompleted;
    })(),
  );

  const drainQueue = useRef(() => {
    if (drainRunningRef.current) return;
    drainRunningRef.current = true;

    const processNext = () => {
      const stageId = stageQueueRef.current.shift();
      if (!stageId) {
        drainRunningRef.current = false;
        return;
      }

      const now = Date.now();
      const sinceLast = now - lastVisualUpdateRef.current;
      const delay = Math.max(0, MIN_STAGE_VISIBLE_MS - sinceLast);

      setTimeout(() => {
        lastVisualUpdateRef.current = Date.now();
        setStages((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (next[k].status === "active") next[k] = { status: "completed" };
          });
          if (next[stageId]) next[stageId] = { status: "active" };
          return next;
        });
        processNext();
      }, delay);
    };

    processNext();
  }).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, [startTime]);

  // Reacts to the true, store-held progress advancing — queues each newly
  // active stage through the same staggered reveal a live SSE event used to
  // drive directly. If every stage is already completed (a result landed,
  // possibly while this was unmounted), snaps straight there.
  useEffect(() => {
    const allDone = STAGE_ORDER.length > 0 && STAGE_ORDER.every((id) => stageProgress?.[id] === "completed");
    if (allDone) {
      stageQueueRef.current = [];
      const snapshot = stageProgress;
      setTimeout(() => setStages(toDisplayState(snapshot)), 0);
      return;
    }
    let trueIndex = STAGE_ORDER.findIndex((id) => stageProgress?.[id] === "active");
    if (trueIndex < 0) {
      STAGE_ORDER.forEach((id, i) => {
        if (stageProgress?.[id] === "completed") trueIndex = i;
      });
    }
    if (trueIndex > lastSeenIndexRef.current) {
      for (let i = lastSeenIndexRef.current + 1; i <= trueIndex; i++) {
        stageQueueRef.current.push(STAGE_ORDER[i]);
      }
      lastSeenIndexRef.current = trueIndex;
      drainQueue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageProgress]);

  const completedCount = Object.values(stages).filter((s) => s.status === "completed").length;
  const progressPct = Math.round((completedCount / STAGES.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-card/50 backdrop-blur p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Pipeline Progress</p>
        <p className="text-xs tabular-nums text-text-muted">{elapsed}s</p>
      </div>

      <div className="w-full h-1.5 rounded-full bg-border/50 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="space-y-1">
        {STAGES.map((stage) => {
          const state = stages[stage.id];
          const isActive = state?.status === "active";
          const isCompleted = state?.status === "completed";

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                isActive
                  ? "bg-primary/10 border-l-2 border-primary"
                  : isCompleted
                    ? "opacity-60"
                    : "opacity-30"
              }`}
            >
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isActive
                    ? "bg-primary text-white animate-pulse"
                    : isCompleted
                      ? "bg-success/20 text-success"
                      : "bg-border/30 text-text-muted"
                }`}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  stage.icon
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-sm transition-colors duration-300 ${isActive ? "font-medium text-text" : "text-text-secondary"}`}>
                  {stage.label}
                </p>
                {stage.subtitle && (
                  <p className="text-xs text-text-muted">{stage.subtitle}</p>
                )}
              </div>

              {isActive && (
                <div className="shrink-0 w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

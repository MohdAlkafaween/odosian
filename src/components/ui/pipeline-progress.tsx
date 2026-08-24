"use client";

import { useEffect, useState, useRef } from "react";

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

type StageStatus = "pending" | "active" | "completed";

interface StageState {
  status: StageStatus;
}

export function PipelineProgress({
  tabId,
  endpoint,
  body,
  onComplete,
  onError,
}: {
  tabId: string;
  endpoint: string;
  body: Record<string, unknown>;
  onComplete: (result: unknown) => void;
  onError: (error: string, validationRejection?: { category: string; issues: string[]; structuredIssues?: { code: string; severity: string; category: string; path: string; message: string }[] }) => void;
}) {
  const [stages, setStages] = useState<Record<string, StageState>>(() => {
    const initial: Record<string, StageState> = {};
    STAGES.forEach((s) => {
      initial[s.id] = { status: "pending" };
    });
    return initial;
  });
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);
  const bodyRef = useRef(body);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(bodyRef.current),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
          if (res.status === 422 && data.validationRejection) {
            onErrorRef.current(data.error || "Quality check failed", { category: data.category, issues: data.issues || [], structuredIssues: data.structuredIssues || [] });
          } else {
            onErrorRef.current(data.error || `Server error ${res.status}`);
          }
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          onErrorRef.current("No response stream");
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
                  setStages((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                      if (next[k].status === "active") {
                        next[k] = { status: "completed" };
                      }
                    });
                    if (next[parsed.stage]) {
                      next[parsed.stage] = { status: "active" };
                    }
                    return next;
                  });
                } else if (eventType === "result") {
                  setStages((prev) => {
                    const next = { ...prev };
                    Object.keys(next).forEach((k) => {
                      next[k] = { status: "completed" };
                    });
                    return next;
                  });
                  setTimeout(() => onCompleteRef.current(parsed), 300);
                } else if (eventType === "error") {
                  if (parsed.category === "validation" || parsed.category?.includes("validation")) {
                    onErrorRef.current(parsed.error || "Quality check failed", { category: parsed.category, issues: parsed.issues || [], structuredIssues: parsed.structured_issues || [] });
                  } else {
                    onErrorRef.current(parsed.error || "Pipeline error");
                  }
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
        if (e instanceof DOMException && e.name === "AbortError") return;
        onErrorRef.current("Lost connection to engine");
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, tabId]);

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

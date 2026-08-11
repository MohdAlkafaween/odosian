"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";
import { useTabStore } from "@/stores/tabs";
import { useOpenPageTab } from "@/hooks/use-open-page-tab";

export interface BatchItem {
  id: string;
  ruleId: string;
  ruleTitle: string;
  status: string;
  error: string;
  analysisId: string | null;
  score: number | null;
  rating: string | null;
}

export interface BatchDetail {
  id: string;
  operation: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  createdBy: string;
  createdAt: string;
  items: BatchItem[];
}

const ITEM_STATUS_STYLE: Record<string, string> = {
  pending: "text-text-muted",
  running: "text-info",
  completed: "text-success",
  failed: "text-danger",
  skipped: "text-text-muted",
};

const RATING_TEXT_COLOR: Record<string, string> = {
  "A+": "text-success",
  A: "text-success",
  B: "text-accent",
  C: "text-severity-medium",
  D: "text-severity-high",
  F: "text-severity-critical",
};

const OPERATION_LABEL: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  post_enhance: "Post-Enhancement Analysis",
};

// Shared by the standalone /dashboard/analysis/batches/[id] page and the AI
// tab view — both just need to poll a batch and render its progress the
// same way, so there's one implementation instead of two.
export function BatchProgress({ batchId, onStatusChange }: {
  batchId: string;
  onStatusChange?: (status: string) => void;
}) {
  const { addToast } = useToastStore();
  const { addTab, updateTab } = useTabStore();
  const { openRule } = useOpenPageTab();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [startingEnhance, setStartingEnhance] = useState(false);
  const [startingPostEnhance, setStartingPostEnhance] = useState(false);
  const [skipping, setSkipping] = useState<Set<string>>(new Set());

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}`);
      const data = await res.json();
      if (res.ok) {
        setBatch(data.batch);
        onStatusChange?.(data.batch.status);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [batchId, onStatusChange]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  useEffect(() => {
    if (!batch || ["completed", "paused", "cancelled"].includes(batch.status)) return;
    const interval = setInterval(fetchBatch, 2000);
    return () => clearInterval(interval);
  }, [batch, fetchBatch]);

  // Opens the exact same result view single-rule Analyze/Enhance produces —
  // a completed AI tab — instead of navigating to the plain detail page,
  // so this gets the real interactive buttons (Enhance This Rule, Apply to
  // Rule, Analyze After Enhancement), not just a static read of the fields.
  const handleView = async (item: BatchItem, operation: "analyze" | "enhance") => {
    const tabId = addTab({
      type: operation,
      title: `${operation === "analyze" ? "Analyze" : "Enhance"}: ${item.ruleTitle}`,
      ruleId: item.ruleId,
      ruleName: item.ruleTitle,
      status: "running",
      statusMessage: "Loading result...",
    });
    try {
      const res = await fetch(`/api/analysis/${item.analysisId}`);
      const data = await res.json();
      if (res.ok) {
        updateTab(tabId, { status: "completed", result: data.analysis });
      } else {
        updateTab(tabId, { status: "failed", error: data.error || "Failed to load result" });
      }
    } catch {
      updateTab(tabId, { status: "failed", error: "Failed to load result" });
    }
  };

  // Mirrors "Enhance This Rule" appearing after a single analyze completes —
  // here it's "enhance everything this batch successfully analyzed", fired
  // as its own new batch_enhance tab/run.
  const handleBulkEnhance = async () => {
    if (!batch) return;
    const ruleIds = batch.items.filter((i) => i.status === "completed").map((i) => i.ruleId);
    if (ruleIds.length === 0) return;
    setStartingEnhance(true);
    try {
      const res = await fetch("/api/analysis/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleIds, operation: "enhance" }),
      });
      const data = await res.json();
      if (res.ok) {
        addTab({
          type: "batch_enhance",
          title: `Enhance: ${ruleIds.length} rules`,
          batchId: data.batchId,
          status: "running",
          statusMessage: `Enhancing ${ruleIds.length} rules...`,
        });
      } else {
        addToast("error", data.error || "Failed to start bulk enhancement");
      }
    } catch {
      addToast("error", "Failed to start bulk enhancement");
    } finally {
      setStartingEnhance(false);
    }
  };

  // Mirrors "Analyze After Enhancement" appearing after a single enhance
  // completes — here it's "score everything this batch successfully
  // enhanced", fired as its own new batch run. The server derives which
  // rules/enhancements to use from this batch's completed items directly.
  const handleBulkPostEnhance = async () => {
    if (!batch) return;
    const count = batch.items.filter((i) => i.status === "completed").length;
    if (count === 0) return;
    setStartingPostEnhance(true);
    try {
      const res = await fetch("/api/analysis/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "post_enhance", sourceBatchId: batch.id }),
      });
      const data = await res.json();
      if (res.ok) {
        addTab({
          type: "batch_analyze",
          title: `Analyze After Enhancement: ${count} rules`,
          batchId: data.batchId,
          status: "running",
          statusMessage: `Analyzing ${count} enhanced rules...`,
        });
      } else {
        addToast("error", data.error || "Failed to start post-enhancement analysis");
      }
    } catch {
      addToast("error", "Failed to start post-enhancement analysis");
    } finally {
      setStartingPostEnhance(false);
    }
  };

  // Excludes a rule from this batch — before it's picked up, or after it
  // failed so a later resume/retry doesn't sweep it back in.
  const handleSkip = async (item: BatchItem) => {
    setSkipping((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res.ok) {
        fetchBatch();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to skip rule");
      }
    } catch {
      addToast("error", "Failed to skip rule");
    } finally {
      setSkipping((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    }
  };

  const handleResume = async () => {
    setResuming(true);
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/resume`, { method: "POST" });
      if (res.ok) {
        addToast("info", "Resuming batch");
        fetchBatch();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to resume batch");
      }
    } catch {
      addToast("error", "Failed to resume batch");
    } finally {
      setResuming(false);
    }
  };

  const handlePause = async () => {
    setPausing(true);
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/pause`, { method: "POST" });
      if (res.ok) {
        addToast("info", "Paused — remaining rules stayed untouched");
        fetchBatch();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to pause batch");
      }
    } catch {
      addToast("error", "Failed to pause batch");
    } finally {
      setPausing(false);
    }
  };

  const handleStop = async () => {
    if (!confirm("Stop this batch? Every rule not yet processed will be marked skipped and won't run.")) return;
    setStopping(true);
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/stop`, { method: "POST" });
      if (res.ok) {
        addToast("info", "Batch stopped");
        fetchBatch();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to stop batch");
      }
    } catch {
      addToast("error", "Failed to stop batch");
    } finally {
      setStopping(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!batch) return <p className="text-text-muted">Batch not found.</p>;

  const isEnhance = batch.operation === "enhance";
  const canResume = batch.items.some((i) => i.status === "pending" || i.status === "running" || i.status === "failed");
  const canPause = batch.status === "pending" || batch.status === "running";
  const canStop = batch.status === "pending" || batch.status === "running" || batch.status === "paused";
  const canBulkEnhance = batch.operation === "analyze"
    && (batch.status === "completed" || batch.status === "partial")
    && batch.items.some((i) => i.status === "completed");
  const canBulkPostEnhance = batch.operation === "enhance"
    && (batch.status === "completed" || batch.status === "partial")
    && batch.items.some((i) => i.status === "completed");
  const canReview = isEnhance
    && (batch.status === "completed" || batch.status === "partial")
    && batch.items.some((i) => i.status === "completed");
  const progressPct = batch.totalCount > 0
    ? Math.round(((batch.completedCount + batch.failedCount + batch.skippedCount) / batch.totalCount) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">
          {OPERATION_LABEL[batch.operation] || batch.operation} started by {batch.createdBy} on {new Date(batch.createdAt).toLocaleString()}
        </p>
        <div className="flex items-center gap-2">
          {canReview && (
            <Link href={`/dashboard/analysis/batches/${batch.id}/review`}>
              <Button size="sm" variant="success">Review &amp; Deploy</Button>
            </Link>
          )}
          {canBulkEnhance && (
            <Button size="sm" onClick={handleBulkEnhance} loading={startingEnhance}>
              Enhance {batch.items.filter((i) => i.status === "completed").length} Analyzed Rules
            </Button>
          )}
          {canBulkPostEnhance && (
            <Button size="sm" onClick={handleBulkPostEnhance} loading={startingPostEnhance}>
              Analyze {batch.items.filter((i) => i.status === "completed").length} After Enhancement
            </Button>
          )}
          {canPause && (
            <Button size="sm" variant="outline" onClick={handlePause} loading={pausing}>
              Pause
            </Button>
          )}
          {canStop && (
            <Button size="sm" variant="danger" onClick={handleStop} loading={stopping}>
              Stop
            </Button>
          )}
          {canResume && (
            <Button size="sm" variant="outline" onClick={handleResume} loading={resuming}>
              {batch.status === "pending" || batch.status === "running" ? "Resume Now" : batch.status === "paused" ? "Resume" : "Retry Failed"}
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4 mb-3">
            <Badge preset={
              batch.status === "completed" ? "production" :
              batch.status === "running" ? "reviewed" :
              batch.status === "partial" || batch.status === "failed" ? "deprecated" :
              batch.status === "cancelled" ? "reject" :
              "draft"
            }>
              {batch.status}
            </Badge>
            <span className="text-sm text-text-secondary">
              <span className="text-success font-semibold">{batch.completedCount}</span> completed
              {batch.failedCount > 0 && <> · <span className="text-danger font-semibold">{batch.failedCount}</span> failed</>}
              {batch.skippedCount > 0 && <> · <span className="text-text-muted font-semibold">{batch.skippedCount}</span> skipped</>}
              {" "}of {batch.totalCount}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-light overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-muted">
                <th className="px-4 py-3 font-medium">Rule</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {!isEnhance && <th className="px-4 py-3 font-medium">Score</th>}
                {!isEnhance && <th className="px-4 py-3 font-medium">Rating</th>}
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {batch.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <button onClick={() => openRule(item.ruleId, item.ruleTitle)} className="text-primary hover:underline text-left">
                      {item.ruleTitle}
                    </button>
                  </td>
                  <td className={`px-4 py-3 font-medium ${ITEM_STATUS_STYLE[item.status] || ""}`}>
                    {item.status === "running" && <Spinner size="sm" />}
                    {" "}{item.status}
                  </td>
                  {!isEnhance && (
                    <td className={`px-4 py-3 font-medium ${item.rating ? RATING_TEXT_COLOR[item.rating] ?? "text-text-secondary" : "text-text-secondary"}`}>
                      {item.score ?? "—"}
                    </td>
                  )}
                  {!isEnhance && (
                    <td className="px-4 py-3">
                      {item.rating ? <Badge preset={item.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{item.rating}</Badge> : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {item.status === "completed" && item.analysisId && (
                        <button
                          onClick={() => handleView(item, isEnhance ? "enhance" : "analyze")}
                          className="text-primary hover:underline text-xs"
                        >
                          View {isEnhance ? "Enhancement" : "Analysis"}
                        </button>
                      )}
                      {item.status === "failed" && (
                        <span className="text-danger text-xs">{item.error}</span>
                      )}
                      {item.status === "skipped" && (
                        <span className="text-text-muted text-xs">Excluded from this batch</span>
                      )}
                      {(item.status === "pending" || item.status === "failed") && (
                        <button
                          onClick={() => handleSkip(item)}
                          disabled={skipping.has(item.id)}
                          className="text-text-muted hover:text-danger text-xs underline disabled:opacity-50"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

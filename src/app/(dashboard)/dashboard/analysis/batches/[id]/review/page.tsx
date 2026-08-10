"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CodeBlock } from "@/components/ui/code-block";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";

interface ReviewItem {
  itemId: string;
  analysisId: string | null;
  ruleId: string;
  ruleTitle: string;
  originalQuery: string;
  originalSeverity: string;
  currentQuery: string;
  enhancedQuery: string;
  enhancedTitle: string;
  enhancedDescription: string;
  newSeverity: string;
  newRiskScore: number;
  changelog: { change: string; reason: string }[];
  applied: boolean;
  deployed: boolean;
}

interface ElasticConn {
  id: string;
  name: string;
  kibanaUrl: string;
}

type Severity = "low" | "medium" | "high" | "critical";

export default function BatchReviewPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;
  const { addToast } = useToastStore();

  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [elasticConns, setElasticConns] = useState<ElasticConn[]>([]);
  const [selectedConn, setSelectedConn] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [working, setWorking] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/review`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error || "Failed to load batch review");
        return;
      }
      setItems(data.items);
      // Default selection: whatever hasn't already been applied — the
      // reviewer's job is deciding what's left, not re-confirming what's
      // already live.
      setSelected(new Set(data.items.filter((i: ReviewItem) => !i.applied).map((i: ReviewItem) => i.itemId)));
    } catch {
      setLoadError("Failed to load batch review");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/elastic")
      .then((r) => r.json())
      .then((data) => {
        const conns = data.connections || [];
        setElasticConns(conns);
        if (conns.length > 0) setSelectedConn(conns[0].id);
      })
      .catch(() => {});
  }, []);

  const toggleSelected = (itemId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const toggleExpanded = (itemId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(items.map((i) => i.itemId)));
  const selectNone = () => setSelected(new Set());

  const runAction = async (itemIds: string[], action: "apply" | "apply_and_deploy") => {
    if (itemIds.length === 0) return;
    if (action === "apply_and_deploy" && !selectedConn) {
      addToast("error", "Choose an Elastic connection first");
      return;
    }
    setWorking((prev) => new Set([...prev, ...itemIds]));
    try {
      const res = await fetch(`/api/analysis/batch/${batchId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemIds,
          action,
          connectionId: action === "apply_and_deploy" ? selectedConn : undefined,
          enabled: pushEnabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Action failed");
        return;
      }
      const failed = (data.results as Array<{ itemId: string; error?: string }>).filter((r) => r.error);
      if (failed.length > 0) {
        addToast("error", `${failed.length} of ${itemIds.length} failed — see rows for details`);
      } else {
        addToast("success", action === "apply_and_deploy"
          ? `Applied and deployed ${data.deployedCount} rule(s)`
          : `Applied ${data.appliedCount} rule(s)`);
      }
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of data.results as Array<{ itemId: string; error?: string }>) {
          if (!r.error) next.delete(r.itemId);
        }
        return next;
      });
      await load();
    } catch {
      addToast("error", "Action failed");
    } finally {
      setWorking((prev) => {
        const next = new Set(prev);
        for (const id of itemIds) next.delete(id);
        return next;
      });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  }

  if (loadError) {
    return (
      <div className="p-6">
        <EmptyState title="Can't review this batch" description={loadError} />
        <div className="mt-4">
          <Button variant="ghost" onClick={() => router.push(`/dashboard/analysis/batches/${batchId}`)}>Back to batch</Button>
        </div>
      </div>
    );
  }

  const selectedCount = selected.size;
  const pendingCount = items.filter((i) => !i.applied).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <Link href={`/dashboard/analysis/batches/${batchId}`} className="text-sm text-primary hover:underline">&larr; Back to batch</Link>
        <h1 className="text-2xl font-bold text-text mt-2">Review Enhanced Rules</h1>
        <p className="text-sm text-text-secondary mt-1">
          {items.length} rule{items.length !== 1 ? "s" : ""} enhanced &middot; {pendingCount} awaiting a decision
        </p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nothing to review" description="This batch has no completed enhancement results." />
      ) : (
        <>
          <Card className="sticky top-4 z-10">
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-text">{selectedCount} selected</span>
                  <button onClick={selectAll} className="text-xs text-primary hover:underline">Select all</button>
                  <button onClick={selectNone} className="text-xs text-text-muted hover:underline">Select none</button>
                </div>
              </div>

              {elasticConns.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
                  <Select
                    label="Deploy to"
                    value={selectedConn}
                    onChange={(e) => setSelectedConn(e.target.value)}
                    options={elasticConns.map((c) => ({ value: c.id, label: `${c.name} — ${c.kibanaUrl}` }))}
                  />
                  <label className="flex items-center gap-2 text-xs text-text-secondary pb-2.5">
                    <input type="checkbox" checked={pushEnabled} onChange={(e) => setPushEnabled(e.target.checked)} />
                    Enable in Elastic after push
                  </label>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  disabled={selectedCount === 0}
                  onClick={() => runAction([...selected], "apply")}
                >
                  Apply Selected (no deploy)
                </Button>
                <Button
                  variant="success"
                  disabled={selectedCount === 0 || elasticConns.length === 0}
                  onClick={() => runAction([...selected], "apply_and_deploy")}
                >
                  Apply &amp; Deploy Selected
                </Button>
              </div>
              {elasticConns.length === 0 && (
                <p className="text-xs text-text-muted">No Elastic connections configured — you can still apply enhancements, just not deploy them.</p>
              )}
            </CardBody>
          </Card>

          <div className="space-y-3">
            {items.map((item) => {
              const isWorking = working.has(item.itemId);
              const isExpanded = expanded.has(item.itemId);
              const severityChanged = item.newSeverity !== item.originalSeverity;

              return (
                <Card key={item.itemId}>
                  <CardHeader className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={selected.has(item.itemId)}
                        onChange={() => toggleSelected(item.itemId)}
                        disabled={item.applied}
                      />
                      <Link href={`/dashboard/rules/${item.ruleId}`} className="font-medium text-text hover:text-primary truncate">
                        {item.ruleTitle}
                      </Link>
                      {item.deployed ? (
                        <Badge preset="deployed">Deployed</Badge>
                      ) : item.applied ? (
                        <Badge preset="enhanced">Applied</Badge>
                      ) : (
                        <Badge>Awaiting review</Badge>
                      )}
                      {severityChanged && (
                        <span className="flex items-center gap-1 text-xs">
                          <Badge preset={item.originalSeverity as Severity} />
                          <span className="text-text-muted">&rarr;</span>
                          <Badge preset={item.newSeverity as Severity} />
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => toggleExpanded(item.itemId)}
                      className="text-xs text-primary hover:underline shrink-0"
                    >
                      {isExpanded ? "Hide diff" : "View diff"}
                    </button>
                  </CardHeader>

                  {isExpanded && (
                    <CardBody className="space-y-4">
                      {item.changelog.length > 0 && (
                        <div className="space-y-1.5">
                          {item.changelog.map((c, i) => (
                            <div key={i} className="flex gap-2 text-sm">
                              <span className="text-primary shrink-0">&bull;</span>
                              <div>
                                <span className="text-text font-medium">{c.change}</span>
                                <span className="text-text-muted ml-2">— {c.reason}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide">
                            {item.applied ? "Before This Enhancement" : "Current Rule Query"}
                          </p>
                          <CodeBlock code={item.originalQuery} language="kuery" formatQuery />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-success mb-2 uppercase tracking-wide">Enhanced Query</p>
                          <CodeBlock code={item.enhancedQuery} language="kuery" formatQuery />
                        </div>
                      </div>
                    </CardBody>
                  )}

                  <CardBody className="pt-0 flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={isWorking}
                      disabled={item.applied}
                      onClick={() => runAction([item.itemId], "apply")}
                    >
                      Apply
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      loading={isWorking}
                      disabled={elasticConns.length === 0}
                      onClick={() => runAction([item.itemId], "apply_and_deploy")}
                    >
                      {item.applied ? "Deploy" : "Apply & Deploy"}
                    </Button>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

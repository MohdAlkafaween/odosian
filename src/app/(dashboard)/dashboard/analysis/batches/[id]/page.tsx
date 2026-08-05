"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";

interface BatchItem {
  id: string;
  ruleId: string;
  ruleTitle: string;
  status: string;
  error: string;
  analysisId: string | null;
  score: number | null;
  rating: string | null;
}

interface BatchDetail {
  id: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  items: BatchItem[];
}

const ITEM_STATUS_STYLE: Record<string, string> = {
  pending: "text-text-muted",
  running: "text-info",
  completed: "text-success",
  failed: "text-danger",
};

export default function AnalysisBatchDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { addToast } = useToastStore();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);

  const fetchBatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/batch/${id}`);
      const data = await res.json();
      if (res.ok) setBatch(data.batch);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  useEffect(() => {
    if (!batch || batch.status === "completed") return;
    const interval = setInterval(fetchBatch, 2000);
    return () => clearInterval(interval);
  }, [batch, fetchBatch]);

  const handleResume = async () => {
    setResuming(true);
    try {
      const res = await fetch(`/api/analysis/batch/${id}/resume`, { method: "POST" });
      if (res.ok) {
        addToast("info", "Resuming batch analysis");
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

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!batch) return <p className="text-text-muted">Batch not found.</p>;

  const canResume = batch.status !== "completed" && batch.items.some((i) => i.status !== "completed");
  const progressPct = batch.totalCount > 0 ? Math.round(((batch.completedCount + batch.failedCount) / batch.totalCount) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Batch Analysis</h1>
          <p className="text-sm text-text-secondary mt-1">
            Started by {batch.createdBy} on {new Date(batch.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canResume && (
            <Button size="sm" onClick={handleResume} loading={resuming}>
              {batch.status === "pending" || batch.status === "running" ? "Resume Now" : "Retry Failed"}
            </Button>
          )}
          <Link href="/dashboard/analysis/batches">
            <Button variant="outline" size="sm">All Batches</Button>
          </Link>
        </div>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex items-center gap-4 mb-3">
            <Badge preset={batch.status === "completed" ? "production" : batch.status === "running" ? "reviewed" : batch.status === "partial" || batch.status === "failed" ? "deprecated" : "draft"}>
              {batch.status}
            </Badge>
            <span className="text-sm text-text-secondary">
              <span className="text-success font-semibold">{batch.completedCount}</span> completed
              {batch.failedCount > 0 && <> · <span className="text-danger font-semibold">{batch.failedCount}</span> failed</>}
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
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {batch.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/rules/${item.ruleId}`} className="text-primary hover:underline">
                      {item.ruleTitle}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 font-medium ${ITEM_STATUS_STYLE[item.status] || ""}`}>
                    {item.status === "running" && <Spinner size="sm" />}
                    {" "}{item.status}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{item.score ?? "—"}</td>
                  <td className="px-4 py-3">
                    {item.rating ? <Badge preset={item.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{item.rating}</Badge> : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === "completed" && item.analysisId && (
                      <Link href={`/dashboard/analysis/${item.analysisId}`} className="text-primary hover:underline text-xs">
                        View Analysis
                      </Link>
                    )}
                    {item.status === "failed" && (
                      <span className="text-danger text-xs">{item.error}</span>
                    )}
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

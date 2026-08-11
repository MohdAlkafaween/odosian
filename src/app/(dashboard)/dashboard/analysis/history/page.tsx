"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loading";
import { Tabs } from "@/components/ui/tabs";
import { BatchList } from "@/components/batch-list";
import { DeploymentList } from "@/components/deployment-list";
import { useOpenAnalysisTab } from "@/hooks/use-open-analysis-tab";
import { useOpenPageTab } from "@/hooks/use-open-page-tab";

interface AnalysisRecord {
  id: string;
  analysisType: string;
  score: number | null;
  rating: string | null;
  modelUsed: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  rule: { id: string; title: string } | null;
  batchId: string | null;
}

const RATING_TEXT_COLOR: Record<string, string> = {
  "A+": "text-success",
  A: "text-success",
  B: "text-accent",
  C: "text-severity-medium",
  D: "text-severity-high",
  F: "text-severity-critical",
};

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  post_enhance: "Post-Enhancement",
  generate: "Generation",
  feedback: "Simulation",
  simulate: "Simulation",
};

export default function AnalysisHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openAnalysisTab = useOpenAnalysisTab();
  const { openRule } = useOpenPageTab();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  // Seeded from the dashboard's "ANALYSES" card link
  // (/dashboard/analysis/history?analysisType=analyze) — the dashboard's
  // "Analyses" figure means Analyze-type runs specifically, not every AI
  // record type (enhance/generate/etc.) this page can also show.
  const [filterType, setFilterType] = useState(() => searchParams.get("analysisType") || "");
  // Seeded from the dashboard's "Critical" stat card link
  // (/dashboard/analysis/history?critical=true) — not just a local toggle,
  // so landing here from that card shows exactly what it counted.
  const [criticalOnly, setCriticalOnly] = useState(() => searchParams.get("critical") === "true");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterType) params.set("analysisType", filterType);
      if (criticalOnly) params.set("critical", "true");
      const res = await fetch(`/api/analysis?${params}`);
      const data = await res.json();
      setAnalyses(data.analyses || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, filterType, criticalOnly]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      key: "analysisType",
      header: "Type",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return <Badge preset="info">{TYPE_LABELS[row.analysisType] || row.analysisType}</Badge>;
      },
    },
    {
      key: "score",
      header: "Score",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        if (row.analysisType === "enhance" || !row.score) {
          return <span className="text-text-muted">—</span>;
        }
        const color = row.rating ? RATING_TEXT_COLOR[row.rating] ?? "text-text-secondary" : "text-text-secondary";
        return <span className={`font-bold ${color}`}>{row.score}</span>;
      },
    },
    {
      key: "rating",
      header: "Rating",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return row.rating ? <Badge preset={row.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{row.rating}</Badge> : <span className="text-text-muted">—</span>;
      },
    },
    {
      key: "source",
      header: "Source",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return row.batchId ? (
          <Link href={`/dashboard/analysis/batches/${row.batchId}`} className="text-xs text-primary hover:underline">
            Batch Run
          </Link>
        ) : <span className="text-xs text-text-muted">Manual</span>;
      },
    },
    {
      key: "rule",
      header: "Rule",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return row.rule ? (
          <button onClick={() => openRule(row.rule!.id, row.rule!.title)} className="text-primary hover:underline text-sm text-left">
            {row.rule.title}
          </button>
        ) : <span className="text-text-muted text-sm">—</span>;
      },
    },
    {
      key: "user",
      header: "User",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return <span className="text-sm text-text-secondary">{row.user?.name || "—"}</span>;
      },
    },
    {
      key: "createdAt",
      header: "Date",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return <span className="text-sm text-text-muted">{new Date(row.createdAt).toLocaleDateString()}</span>;
      },
    },
    {
      key: "actions",
      header: "",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return (
          <Button variant="ghost" size="sm" onClick={() => openAnalysisTab(row.id, row.analysisType, row.rule?.id, row.rule?.title)}>
            View
          </Button>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Shield Analysis History</h1>
          <p className="text-sm text-text-secondary mt-1">View past AI analysis results</p>
        </div>
        <Link href="/dashboard/analysis">
          <Button variant="outline" size="sm">New Analysis</Button>
        </Link>
      </div>

      <Tabs tabs={[{ id: "individual", label: "Individual Runs" }, { id: "batches", label: "Batch Runs" }, { id: "deployments", label: "Deployments" }]}>
        {(activeTab) => activeTab === "batches" ? (
          <div className="pt-2">
            <BatchList />
          </div>
        ) : activeTab === "deployments" ? (
          <div className="pt-2">
            <DeploymentList />
          </div>
        ) : (
          <div className="pt-2">
            <Card className="mb-6">
              <CardBody>
                <div className="flex gap-4 items-end">
                  <Select
                    label="Filter by Type"
                    value={filterType}
                    onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                    options={[
                      { value: "", label: "All Types" },
                      { value: "analyze", label: "Analysis" },
                      { value: "enhance", label: "Enhancement" },
                      { value: "post_enhance", label: "Post-Enhancement" },
                      { value: "generate", label: "Generation" },
                      { value: "simulate", label: "Simulation" },
                    ]}
                  />
                  <label className="flex items-center gap-2 text-sm text-text-secondary pb-2.5">
                    <input
                      type="checkbox"
                      checked={criticalOnly}
                      onChange={(e) => { setCriticalOnly(e.target.checked); setPage(1); }}
                    />
                    Critical findings only
                  </label>
                </div>
              </CardBody>
            </Card>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="lg" /></div>
            ) : analyses.length === 0 ? (
              <EmptyState
                title="No analyses yet"
                description="Run an AI analysis on a detection rule to see results here."
                actionLabel="Start Analysis"
                onAction={() => router.push("/dashboard/analysis")}
              />
            ) : (
              <>
                <DataTable columns={columns} data={analyses as unknown as Record<string, unknown>[]} keyField="id" />
                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}

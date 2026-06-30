"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loading";

interface AnalysisRecord {
  id: string;
  analysisType: string;
  score: number | null;
  rating: string | null;
  modelUsed: string | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  rule: { id: string; title: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Feedback",
};

export default function AnalysisHistoryPage() {
  const router = useRouter();
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterType) params.set("analysisType", filterType);
      const res = await fetch(`/api/analysis?${params}`);
      const data = await res.json();
      setAnalyses(data.analyses || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, filterType]);

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
        return (
          <span className={`font-bold ${
            (row.score || 0) >= 80 ? "text-success" :
            (row.score || 0) >= 60 ? "text-info" :
            (row.score || 0) >= 40 ? "text-warning" : "text-danger"
          }`}>
            {row.score ?? "—"}
          </span>
        );
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
      key: "rule",
      header: "Rule",
      render: (r: Record<string, unknown>) => {
        const row = r as unknown as AnalysisRecord;
        return row.rule ? (
          <Link href={`/dashboard/rules/${row.rule.id}`} className="text-primary hover:underline text-sm">
            {row.rule.title}
          </Link>
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
          <Link href={`/dashboard/analysis/${row.id}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
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
                { value: "generate", label: "Generation" },
                { value: "feedback", label: "Feedback" },
              ]}
            />
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
  );
}

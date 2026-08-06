"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loading";

interface BatchRow {
  id: string;
  operation: string;
  status: string;
  totalCount: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  createdBy: string;
  createdAt: string;
  [key: string]: unknown;
}

const STATUS_PRESET: Record<string, "production" | "reviewed" | "draft" | "deprecated"> = {
  completed: "production",
  running: "reviewed",
  pending: "draft",
  partial: "deprecated",
  failed: "deprecated",
};

const OPERATION_LABEL: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
};

// The batch run list — used standalone on /dashboard/analysis/batches and
// embedded in the "Batch Runs" tab of the analysis History page, so there's
// one place to find and open a specific batch run from either entry point.
export function BatchList() {
  const router = useRouter();
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch("/api/analysis/batch");
      const data = await res.json();
      setBatches(data.batches || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchBatches();
    const interval = setInterval(fetchBatches, 5000);
    return () => clearInterval(interval);
  }, [fetchBatches]);

  const columns = [
    {
      key: "operation",
      header: "Type",
      render: (row: BatchRow) => <Badge preset="info">{OPERATION_LABEL[row.operation] || row.operation}</Badge>,
    },
    {
      key: "status",
      header: "Status",
      render: (row: BatchRow) => <Badge preset={STATUS_PRESET[row.status] || "info"}>{row.status}</Badge>,
    },
    {
      key: "progress",
      header: "Progress",
      render: (row: BatchRow) => (
        <span className="text-sm text-text-secondary">
          <span className="text-success font-semibold">{row.completedCount}</span>
          {row.failedCount > 0 && <span className="text-danger font-semibold"> / {row.failedCount} failed</span>}
          {row.skippedCount > 0 && <span className="text-text-muted"> / {row.skippedCount} skipped</span>}
          {" "}of {row.totalCount}
        </span>
      ),
    },
    {
      key: "createdBy",
      header: "Started By",
      render: (row: BatchRow) => <span className="text-text-secondary">{row.createdBy}</span>,
    },
    {
      key: "createdAt",
      header: "Started",
      render: (row: BatchRow) => <span className="text-sm text-text-muted">{new Date(row.createdAt).toLocaleString()}</span>,
    },
    {
      key: "actions",
      header: "",
      render: (row: BatchRow) => (
        <Link href={`/dashboard/analysis/batches/${row.id}`}>
          <Button variant="ghost" size="sm">View</Button>
        </Link>
      ),
    },
  ];

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  if (batches.length === 0) {
    return (
      <EmptyState
        title="No batch runs yet"
        description="Select multiple rules from the rules list and click Analyze Selected or Enhance Selected to start one."
        actionLabel="Go to Rules"
        onAction={() => router.push("/dashboard/rules")}
      />
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <DataTable columns={columns} data={batches} keyField="id" />
      </CardBody>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BatchList } from "@/components/batch-list";

export default function AnalysisBatchesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Batch Analysis Runs</h1>
          <p className="text-sm text-text-secondary mt-1">
            Progress here is saved to the database — if the cluster restarts mid-run, reopen a batch to resume it.
          </p>
        </div>
        <Link href="/dashboard/rules">
          <Button variant="outline" size="sm">Select Rules</Button>
        </Link>
      </div>

      <BatchList />
    </div>
  );
}

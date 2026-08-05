"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BatchProgress } from "@/components/batch-progress";

export default function AnalysisBatchDetailPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] font-extrabold text-text">Batch Progress</h1>
        <Link href="/dashboard/analysis/batches">
          <Button variant="outline" size="sm">All Batches</Button>
        </Link>
      </div>

      <BatchProgress batchId={id} />
    </div>
  );
}

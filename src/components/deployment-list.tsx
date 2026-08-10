"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Spinner } from "@/components/ui/loading";

interface DeploymentRow {
  id: string;
  action: string;
  ruleId: string;
  ruleTitle: string;
  user: string;
  elasticRuleId: string | null;
  connectionName: string | null;
  enabled: boolean | null;
  duplicated: boolean;
  createdAt: string;
  [key: string]: unknown;
}

const ACTION_LABEL: Record<string, string> = {
  RULE_PUSHED_TO_ELASTIC: "Pushed (new)",
  RULE_UPDATED_IN_ELASTIC: "Pushed (update)",
  RULE_PULLED_FROM_ELASTIC: "Pulled from Elastic",
  RULE_DELETED_FROM_ELASTIC: "Removed from Elastic",
};

const ACTION_BADGE: Record<string, "production" | "enhanced" | "analyzed" | "reject"> = {
  RULE_PUSHED_TO_ELASTIC: "production",
  RULE_UPDATED_IN_ELASTIC: "enhanced",
  RULE_PULLED_FROM_ELASTIC: "analyzed",
  RULE_DELETED_FROM_ELASTIC: "reject",
};

// Pushes and pulls to/from Elastic — surfaced here because they were
// previously only visible in AuditLog, which nothing in the UI reads.
// Embedded as the History page's "Deployments" tab.
export function DeploymentList({ ruleId }: { ruleId?: string }) {
  const router = useRouter();
  const [deployments, setDeployments] = useState<DeploymentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeployments = useCallback(async () => {
    try {
      const qs = ruleId ? `?ruleId=${ruleId}` : "";
      const res = await fetch(`/api/audit/deployments${qs}`);
      const data = await res.json();
      setDeployments(data.deployments || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [ruleId]);

  useEffect(() => { fetchDeployments(); }, [fetchDeployments]);

  const columns = [
    {
      key: "action",
      header: "Action",
      render: (row: DeploymentRow) => <Badge preset={ACTION_BADGE[row.action] || "info"}>{ACTION_LABEL[row.action] || row.action}</Badge>,
    },
    {
      key: "ruleTitle",
      header: "Rule",
      render: (row: DeploymentRow) => (
        <Link href={`/dashboard/rules/${row.ruleId}`} className="text-primary hover:underline">
          {row.ruleTitle}
        </Link>
      ),
    },
    {
      key: "connectionName",
      header: "Connection",
      render: (row: DeploymentRow) => <span className="text-text-secondary">{row.connectionName || "—"}</span>,
    },
    {
      key: "enabled",
      header: "Enabled",
      render: (row: DeploymentRow) =>
        row.enabled === null ? <span className="text-text-muted">—</span> : <Badge preset={row.enabled ? "production" : "draft"}>{row.enabled ? "Yes" : "No"}</Badge>,
    },
    {
      key: "user",
      header: "By",
      render: (row: DeploymentRow) => <span className="text-text-secondary">{row.user}</span>,
    },
    {
      key: "createdAt",
      header: "When",
      render: (row: DeploymentRow) => <span className="text-sm text-text-muted">{new Date(row.createdAt).toLocaleString()}</span>,
    },
  ];

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;

  if (deployments.length === 0) {
    return (
      <EmptyState
        title="No deployments yet"
        description="Push a rule to Elastic Security to see it show up here."
        actionLabel="Go to Rules"
        onAction={() => router.push("/dashboard/rules")}
      />
    );
  }

  return (
    <Card>
      <CardBody className="p-0">
        <DataTable columns={columns} data={deployments} keyField="id" />
      </CardBody>
    </Card>
  );
}

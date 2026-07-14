"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/loading";
import { useAuthStore } from "@/stores/auth";

interface AuditRecord {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ipAddress: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATED: "text-success bg-success/10",
  UPDATED: "text-accent bg-accent/10",
  DELETED: "text-danger bg-danger/10",
  LOGIN: "text-info bg-info/10",
};

function getActionColor(action: string): string {
  for (const [key, val] of Object.entries(ACTION_COLORS)) {
    if (action.includes(key)) return val;
  }
  return "text-text-secondary bg-surface-light";
}

export default function AuditLogsPage() {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterTarget, setFilterTarget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterAction) params.set("action", filterAction);
      if (filterTarget) params.set("targetType", filterTarget);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await fetch(`/api/audit?${params}`);
      if (res.status === 403) { setLoading(false); return; }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setActions(data.filters?.actions || []);
      setTargetTypes(data.filters?.targetTypes || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [page, filterAction, filterTarget, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (user?.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <h2 className="text-xl font-bold text-text mb-2">Access Denied</h2>
        <p className="text-text-secondary">Only administrators can view audit logs.</p>
      </div>
    );
  }

  if (loading && logs.length === 0) return <PageLoader />;

  const clearFilters = () => {
    setFilterAction("");
    setFilterTarget("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-text">Shield Audit Logs</h1>
        <p className="text-sm text-text-secondary mt-1">Track all system activity and changes</p>
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-48">
              <Select
                label="Action"
                value={filterAction}
                onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
                options={[
                  { value: "", label: "All Actions" },
                  ...actions.map((a) => ({ value: a, label: a.replace(/_/g, " ") })),
                ]}
              />
            </div>
            <div className="w-48">
              <Select
                label="Target Type"
                value={filterTarget}
                onChange={(e) => { setFilterTarget(e.target.value); setPage(1); }}
                options={[
                  { value: "", label: "All Types" },
                  ...targetTypes.map((t) => ({ value: t, label: t })),
                ]}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="px-3 py-2 rounded-lg border border-border bg-surface text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {(filterAction || filterTarget || startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
            )}
          </div>
        </CardBody>
      </Card>

      {logs.length === 0 ? (
        <EmptyState title="No audit logs found" description="Try adjusting your filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-light">
                  <th className="px-4 py-3 text-left text-text-secondary font-medium">Action</th>
                  <th className="px-4 py-3 text-left text-text-secondary font-medium">Target</th>
                  <th className="px-4 py-3 text-left text-text-secondary font-medium">User</th>
                  <th className="px-4 py-3 text-left text-text-secondary font-medium">IP</th>
                  <th className="px-4 py-3 text-left text-text-secondary font-medium">Timestamp</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <Fragment key={log.id}>
                    <tr
                      className="border-b border-border last:border-0 hover:bg-surface-light/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${getActionColor(log.action)}`}>
                          {log.action.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text text-xs">{log.targetType}</span>
                        {log.targetId && (
                          <span className="text-text-muted text-xs ml-1 font-mono">
                            {log.targetId.slice(0, 8)}...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary text-xs">{log.user.name}</td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">{log.ipAddress || "—"}</td>
                      <td className="px-4 py-3 text-text-muted text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {Object.keys(log.details).length > 0 && (
                          <button
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                            className="text-text-muted hover:text-text text-xs"
                          >
                            {expandedId === log.id ? "Hide" : "Details"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-details`} className="border-b border-border">
                        <td colSpan={6} className="px-4 py-3 bg-surface-light">
                          <pre className="text-xs text-text-secondary font-mono overflow-x-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
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

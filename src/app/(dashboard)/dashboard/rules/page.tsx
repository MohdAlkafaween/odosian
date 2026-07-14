"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageLoader } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";

interface RuleRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  ruleType: string;
  language: string;
  client: string;
  tags: string[];
  updatedAt: string;
  author: { id: string; name: string };
  _count: { analyses: number };
  [key: string]: unknown;
}

const SEVERITY_OPTIONS = [
  { value: "", label: "All Severities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "reviewed", label: "Reviewed" },
  { value: "production", label: "Production" },
  { value: "deprecated", label: "Deprecated" },
];

const TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "query", label: "Query" },
  { value: "eql", label: "EQL" },
  { value: "threshold", label: "Threshold" },
  { value: "new_terms", label: "New Terms" },
  { value: "machine_learning", label: "ML" },
];

const LANG_OPTIONS = [
  { value: "", label: "All Languages" },
  { value: "kuery", label: "KQL" },
  { value: "eql", label: "EQL" },
  { value: "lucene", label: "Lucene" },
  { value: "esql", label: "ES|QL" },
];

const CLIENT_COLORS: Record<string, string> = {};
const PALETTE = ["#4CBDFA", "#A78BFA", "#34D399", "#FBBF24", "#FB7185", "#F97316", "#6ED1CA", "#E879F9"];
function getClientColor(client: string): string {
  if (!CLIENT_COLORS[client]) {
    const idx = Object.keys(CLIENT_COLORS).length % PALETTE.length;
    CLIENT_COLORS[client] = PALETTE[idx];
  }
  return CLIENT_COLORS[client];
}

export default function RulesListPage() {
  const router = useRouter();
  const { addToast } = useToastStore();

  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [ruleType, setRuleType] = useState("");
  const [language, setLanguage] = useState("");
  const [client, setClient] = useState("");
  const [clientOptions, setClientOptions] = useState<{ value: string; label: string }[]>([{ value: "", label: "All Clients" }]);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/rules/clients")
      .then((r) => r.json())
      .then((data) => {
        if (data.clients) {
          setClientOptions([
            { value: "", label: "All Clients" },
            ...data.clients.map((c: string) => ({ value: c, label: c })),
          ]);
        }
      })
      .catch(() => {});
  }, []);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), sortBy, sortDir });
      if (search) params.set("search", search);
      if (severity) params.set("severity", severity);
      if (status) params.set("status", status);
      if (ruleType) params.set("ruleType", ruleType);
      if (language) params.set("language", language);
      if (client) params.set("client", client);

      const res = await fetch(`/api/rules?${params}`);
      const data = await res.json();
      if (res.ok) {
        setRules(data.rules);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      addToast("error", "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [page, search, severity, status, ruleType, language, client, sortBy, sortDir, addToast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSearch = (q: string) => {
    setSearch(q);
    setPage(1);
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    let deleted = 0;
    for (const id of selectedKeys) {
      const res = await fetch(`/api/rules/${id}`, { method: "DELETE" });
      if (res.ok) deleted++;
    }
    setDeleting(false);
    setDeleteConfirm(false);
    setSelectedKeys(new Set());
    addToast("success", `${deleted} rule(s) deleted`);
    fetchRules();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const columns = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      render: (row: RuleRow) => (
        <div className="flex flex-col gap-1">
          <Link href={`/dashboard/rules/${row.id}`} className="text-primary hover:underline font-medium">
            {row.title}
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap">
            {row.client && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `${getClientColor(row.client)}15`,
                  color: getClientColor(row.client),
                  border: `1px solid ${getClientColor(row.client)}25`,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" opacity="0.7"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                {row.client}
              </span>
            )}
            {Array.isArray(row.tags) && row.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-text-muted">
                {tag}
              </span>
            ))}
            {Array.isArray(row.tags) && row.tags.length > 3 && (
              <span className="text-[10px] text-text-muted">+{row.tags.length - 3}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      render: (row: RuleRow) => <Badge preset={row.severity as "low" | "medium" | "high" | "critical"} />,
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row: RuleRow) => <Badge preset={row.status as "draft" | "reviewed" | "production" | "deprecated"} />,
    },
    { key: "ruleType", header: "Type" },
    { key: "language", header: "Language" },
    {
      key: "author",
      header: "Author",
      render: (row: RuleRow) => <span className="text-text-secondary">{row.author.name}</span>,
    },
    {
      key: "updatedAt",
      header: "Updated",
      sortable: true,
      render: (row: RuleRow) => <span className="text-text-secondary text-xs">{formatDate(row.updatedAt)}</span>,
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Defense Rules Arsenal</h1>
          <p className="text-sm text-text-muted mt-1">
            Manage your Elastic SIEM detection rules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>Import</Button>
          <div className="relative">
            <Button variant="outline" onClick={() => setShowExport(!showExport)}>Export</Button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-40 bg-surface border border-border rounded-lg shadow-lg z-10">
                {(["json", "csv", "xlsx"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      const ids = selectedKeys.size > 0 ? `&ids=${[...selectedKeys].join(",")}` : "";
                      window.open(`/api/rules/export?format=${fmt}${ids}`, "_blank");
                      setShowExport(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-text hover:bg-surface-light first:rounded-t-lg last:rounded-b-lg"
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={() => router.push("/dashboard/rules/new")}>
            <span className="text-base">+</span> Forge New Rule
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput onSearch={handleSearch} placeholder="Search rules..." />
        </div>
        <Select value={client} onChange={(e) => { setClient(e.target.value); setPage(1); }} options={clientOptions} />
        <Select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} options={SEVERITY_OPTIONS} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
        <Select value={ruleType} onChange={(e) => { setRuleType(e.target.value); setPage(1); }} options={TYPE_OPTIONS} />
        <Select value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }} options={LANG_OPTIONS} />
        {selectedKeys.size > 0 && (
          <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>
            Delete ({selectedKeys.size})
          </Button>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : rules.length === 0 ? (
        <EmptyState
          title="No detection rules found"
          description={search || severity || status ? "Try adjusting your filters" : "Create your first detection rule to get started"}
          actionLabel={!search && !severity && !status ? "Create Rule" : undefined}
          onAction={!search && !severity && !status ? () => router.push("/dashboard/rules/new") : undefined}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={rules}
            keyField="id"
            selectable
            selectedKeys={selectedKeys}
            onSelectionChange={setSelectedKeys}
            onSort={handleSort}
          />
          <div className="flex justify-center mt-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
        title="Delete Rules"
        message={`Are you sure you want to delete ${selectedKeys.size} rule(s)? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-text mb-4">Import Rules</h2>
            <p className="text-sm text-text-secondary mb-4">
              Upload a JSON or NDJSON file with up to 100 rules.
            </p>
            <input
              type="file"
              accept=".json,.ndjson"
              onChange={(e) => {
                setImportFile(e.target.files?.[0] || null);
                setImportResult(null);
              }}
              className="block w-full text-sm text-text-secondary mb-4 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90"
            />
            {importFile && (
              <p className="text-xs text-text-muted mb-4">
                Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
            {importResult && (
              <div className="mb-4 p-3 rounded-lg bg-surface-light border border-border text-sm">
                <p className="text-text">
                  Imported: <span className="text-success font-medium">{importResult.imported}</span> |
                  Failed: <span className="text-danger font-medium">{importResult.failed}</span>
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-text-muted max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowImport(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
              >
                {importResult ? "Close" : "Cancel"}
              </Button>
              {!importResult && (
                <Button
                  loading={importing}
                  disabled={!importFile}
                  onClick={async () => {
                    if (!importFile) return;
                    setImporting(true);
                    try {
                      const isNdjson = importFile.name.endsWith(".ndjson");
                      const content = await importFile.text();
                      const res = await fetch("/api/rules/import", {
                        method: "POST",
                        headers: {
                          "Content-Type": isNdjson ? "application/x-ndjson" : "application/json",
                        },
                        body: content,
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setImportResult(data);
                        if (data.imported > 0) fetchRules();
                      } else {
                        addToast("error", data.error || "Import failed");
                      }
                    } catch {
                      addToast("error", "Failed to import rules");
                    } finally {
                      setImporting(false);
                    }
                  }}
                >
                  Import
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface AIFlags {
  analyzed: boolean;
  enhanced: boolean;
  feedback: boolean;
  generated: boolean;
  deployed: boolean;
}

interface RuleRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  ruleType: string;
  language: string;
  category: string;
  covered: boolean;
  tags: string[];
  updatedAt: string;
  author: { id: string; name: string };
  aiFlags?: AIFlags;
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

const COVERED_OPTIONS = [
  { value: "", label: "All Coverage" },
  { value: "true", label: "Covered" },
  { value: "false", label: "Not Covered" },
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

const AI_FLAG_OPTIONS = [
  { value: "", label: "All AI Flags" },
  { value: "analyzed", label: "Analyzed" },
  { value: "enhanced", label: "Enhanced" },
  { value: "deployed", label: "Deployed" },
  { value: "covered", label: "Covered" },
  { value: "simulated", label: "Simulated" },
  { value: "generated", label: "Generated" },
  { value: "none", label: "No AI Activity" },
];

const CATEGORY_COLORS: Record<string, string> = {};
const PALETTE = ["#4CBDFA", "#A78BFA", "#34D399", "#FBBF24", "#FB7185", "#F97316", "#6ED1CA", "#E879F9"];
function getCategoryColor(category: string): string {
  if (!CATEGORY_COLORS[category]) {
    const idx = Object.keys(CATEGORY_COLORS).length % PALETTE.length;
    CATEGORY_COLORS[category] = PALETTE[idx];
  }
  return CATEGORY_COLORS[category];
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
  const [category, setCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([{ value: "", label: "All Categories" }]);
  const [covered, setCovered] = useState("");
  const [coverage, setCoverage] = useState<{ covered: number; total: number } | null>(null);
  const [togglingCovered, setTogglingCovered] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiFlag, setAiFlag] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number; errors: string[] } | null>(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    fetch("/api/rules/categories")
      .then((r) => r.json())
      .then((data) => {
        if (data.categories) {
          setCategoryOptions([
            { value: "", label: "All Categories" },
            ...data.categories.map((c: string) => ({ value: c, label: c })),
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
      if (category) params.set("category", category);
      if (covered) params.set("covered", covered);

      const res = await fetch(`/api/rules?${params}`);
      const data = await res.json();
      if (res.ok) {
        setRules(data.rules);
        setTotalPages(data.pagination.totalPages);
        if (data.coverage) setCoverage(data.coverage);
      }
    } catch {
      addToast("error", "Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, [page, search, severity, status, ruleType, language, category, covered, sortBy, sortDir, addToast]);

  const toggleCovered = async (rule: RuleRow) => {
    setTogglingCovered((prev) => new Set(prev).add(rule.id));
    const nextCovered = !rule.covered;
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, covered: nextCovered } : r)));
    try {
      const res = await fetch(`/api/rules/${rule.id}/covered`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ covered: nextCovered }),
      });
      if (!res.ok) {
        setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, covered: rule.covered } : r)));
        addToast("error", "Failed to update coverage");
      } else {
        setCoverage((prev) => prev ? { ...prev, covered: prev.covered + (nextCovered ? 1 : -1) } : prev);
      }
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, covered: rule.covered } : r)));
      addToast("error", "Failed to update coverage");
    } finally {
      setTogglingCovered((prev) => { const next = new Set(prev); next.delete(rule.id); return next; });
    }
  };

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

  const handleBulkAction = async (action: string, value: string) => {
    if (selectedKeys.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/rules/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedKeys], action, value }),
      });
      if (res.ok) {
        const data = await res.json();
        addToast("success", `Updated ${data.updated} rule(s)`);
        setSelectedKeys(new Set());
        setBulkAction("");
        setBulkValue("");
        fetchRules();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Bulk update failed");
      }
    } catch {
      addToast("error", "Bulk update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const displayedRules = useMemo(() => {
    if (!aiFlag) return rules;
    return rules.filter((r) => {
      if (aiFlag === "covered") return r.covered;
      if (!r.aiFlags) return aiFlag === "none";
      if (aiFlag === "none") return !r.aiFlags.analyzed && !r.aiFlags.enhanced && !r.aiFlags.feedback && !r.aiFlags.generated && !r.aiFlags.deployed;
      return r.aiFlags[aiFlag as keyof AIFlags];
    });
  }, [rules, aiFlag]);

  const columns = [
    {
      key: "covered",
      header: "",
      render: (row: RuleRow) => (
        <button
          onClick={(e) => { e.stopPropagation(); toggleCovered(row); }}
          disabled={togglingCovered.has(row.id)}
          title={row.covered ? "Covered — click to unmark" : "Mark as covered"}
          className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all shrink-0 ${
            row.covered
              ? "bg-success/20 border-success text-success"
              : "bg-transparent border-border text-transparent hover:border-success/50 hover:text-success/30"
          } ${togglingCovered.has(row.id) ? "opacity-50" : ""}`}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </button>
      ),
    },
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
            {row.category && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: `${getCategoryColor(row.category)}15`,
                  color: getCategoryColor(row.category),
                  border: `1px solid ${getCategoryColor(row.category)}25`,
                }}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" opacity="0.7"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                {row.category}
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
            {row.aiFlags && (
              <>
                {row.aiFlags.analyzed && <Badge preset="analyzed" className="text-[9px] px-1.5 py-0">Analyzed</Badge>}
                {row.aiFlags.enhanced && <Badge preset="enhanced" className="text-[9px] px-1.5 py-0">Enhanced</Badge>}
                {row.aiFlags.feedback && <Badge preset="qf" className="text-[9px] px-1.5 py-0">QF</Badge>}
                {row.aiFlags.generated && <Badge preset="generated" className="text-[9px] px-1.5 py-0">Generated</Badge>}
                {row.aiFlags.deployed && <Badge preset="deployed" className="text-[9px] px-1.5 py-0">Deployed</Badge>}
              </>
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
          {coverage && coverage.total > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-40 h-1.5 rounded-full bg-surface-light overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${Math.round((coverage.covered / coverage.total) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-muted">
                <span className="text-success font-semibold">{coverage.covered}</span> of {coverage.total} covered
                {" "}({Math.round((coverage.covered / coverage.total) * 100)}%)
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>Import</Button>
          <div className="relative">
            <Button variant="outline" onClick={() => setShowExport(!showExport)}>Export</Button>
            {showExport && (
              <div className="absolute right-0 mt-1 w-40 bg-surface border border-border rounded-lg shadow-lg z-10">
                {(["json", "csv", "xlsx", "pdf", "stix"] as const).map((fmt) => (
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
        <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} options={categoryOptions} />
        <Select value={covered} onChange={(e) => { setCovered(e.target.value); setPage(1); }} options={COVERED_OPTIONS} />
        <Select value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }} options={SEVERITY_OPTIONS} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={STATUS_OPTIONS} />
        <Select value={ruleType} onChange={(e) => { setRuleType(e.target.value); setPage(1); }} options={TYPE_OPTIONS} />
        <Select value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }} options={LANG_OPTIONS} />
        <Select value={aiFlag} onChange={(e) => { setAiFlag(e.target.value); setPage(1); }} options={AI_FLAG_OPTIONS} />
        {selectedKeys.size > 0 && (
          <div className="flex items-center gap-2 bg-surface-light border border-border rounded-lg px-3 py-1.5">
            <span className="text-xs font-semibold text-text">{selectedKeys.size} selected</span>
            <Select
              value={bulkAction}
              onChange={(e) => { setBulkAction(e.target.value); setBulkValue(""); }}
              options={[
                { value: "", label: "Bulk Action..." },
                { value: "status", label: "Change Status" },
                { value: "severity", label: "Change Severity" },
              ]}
            />
            {bulkAction === "status" && (
              <Select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                options={[
                  { value: "", label: "Select..." },
                  { value: "draft", label: "Draft" },
                  { value: "reviewed", label: "Reviewed" },
                  { value: "production", label: "Production" },
                  { value: "deprecated", label: "Deprecated" },
                ]}
              />
            )}
            {bulkAction === "severity" && (
              <Select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                options={[
                  { value: "", label: "Select..." },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "critical", label: "Critical" },
                ]}
              />
            )}
            {bulkAction && bulkValue && (
              <Button size="sm" onClick={() => handleBulkAction(bulkAction, bulkValue)} loading={bulkLoading}>
                Apply
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedKeys(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <PageLoader />
      ) : displayedRules.length === 0 ? (
        <EmptyState
          title="No detection rules found"
          description={search || severity || status || aiFlag ? "Try adjusting your filters" : "Create your first detection rule to get started"}
          actionLabel={!search && !severity && !status && !aiFlag ? "Create Rule" : undefined}
          onAction={!search && !severity && !status && !aiFlag ? () => router.push("/dashboard/rules/new") : undefined}
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={displayedRules}
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

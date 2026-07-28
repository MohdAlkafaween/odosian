"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/loading";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  baseQuery: string;
  language: string;
  ruleType: string;
  variables: Array<{ name: string; description: string; defaultValue?: string }>;
  tags: string[];
  mitreTactics: string[];
  createdAt: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN";

  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RuleTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "general", baseQuery: "", language: "kuery", ruleType: "query" });

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      const res = await fetch(`/api/templates?${params}`);
      const data = await res.json();
      setTemplates(data.templates || []);
      setCategories(data.categories || []);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [search, category]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "", category: "general", baseQuery: "", language: "kuery", ruleType: "query" });
    setShowModal(true);
  };

  const openEdit = (t: RuleTemplate) => {
    setEditing(t);
    setForm({ name: t.name, description: t.description, category: t.category, baseQuery: t.baseQuery, language: t.language, ruleType: t.ruleType });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.baseQuery.trim()) {
      addToast("error", "Name and query are required");
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/templates/${editing.id}` : "/api/templates";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        addToast("success", editing ? "Template updated" : "Template created");
        setShowModal(false);
        fetchTemplates();
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to save template");
      }
    } catch {
      addToast("error", "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/templates/${deleteConfirm}`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", "Template deleted");
        fetchTemplates();
      } else {
        addToast("error", "Failed to delete template");
      }
    } catch {
      addToast("error", "Failed to delete template");
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleUseTemplate = (t: RuleTemplate) => {
    const params = new URLSearchParams({
      fromTemplate: "1",
      title: t.name,
      description: t.description,
      query: t.baseQuery,
      language: t.language,
      ruleType: t.ruleType,
      tags: JSON.stringify(t.tags),
    });
    router.push(`/dashboard/rules/new?${params.toString()}`);
  };

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...categories.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Rule Templates</h1>
          <p className="text-sm text-text-muted mt-1">Pre-built detection rule templates for common use cases</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <span className="text-base">+</span> Create Template
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <SearchInput onSearch={setSearch} placeholder="Search templates..." />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} options={categoryOptions} />
      </div>

      {loading ? (
        <PageLoader />
      ) : templates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description={search || category ? "Try adjusting your filters" : "Create your first template to get started"}
          actionLabel={isAdmin && !search && !category ? "Create Template" : undefined}
          onAction={isAdmin && !search && !category ? openCreate : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="hover:border-border-focus/30 transition-colors">
              <CardBody>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-text">{t.name}</h3>
                  <Badge preset="info">{t.category}</Badge>
                </div>
                {t.description && (
                  <p className="text-xs text-text-secondary mb-3 line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-light text-text-muted">{t.language}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-light text-text-muted">{t.ruleType}</span>
                </div>
                {Array.isArray(t.tags) && t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">{tag}</span>
                    ))}
                  </div>
                )}
                <pre className="text-[11px] text-text-muted bg-bg p-2 rounded overflow-x-auto max-h-20 mb-3 font-mono">
                  {t.baseQuery.slice(0, 200)}{t.baseQuery.length > 200 ? "..." : ""}
                </pre>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => handleUseTemplate(t)} className="flex-1">
                    Use Template
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(t.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </Button>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-text mb-4">
              {editing ? "Edit Template" : "Create Template"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus resize-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Language</label>
                  <select
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus"
                  >
                    <option value="kuery">KQL</option>
                    <option value="eql">EQL</option>
                    <option value="lucene">Lucene</option>
                    <option value="esql">ES|QL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Rule Type</label>
                  <select
                    value={form.ruleType}
                    onChange={(e) => setForm({ ...form, ruleType: e.target.value })}
                    className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-border-focus"
                  >
                    <option value="query">Query</option>
                    <option value="eql">EQL</option>
                    <option value="threshold">Threshold</option>
                    <option value="new_terms">New Terms</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Base Query *</label>
                <textarea
                  value={form.baseQuery}
                  onChange={(e) => setForm({ ...form, baseQuery: e.target.value })}
                  rows={6}
                  className="w-full bg-surface-light border border-border rounded-lg px-3 py-2 text-sm text-text font-mono focus:outline-none focus:border-border-focus resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>
                {editing ? "Save Changes" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message="Are you sure you want to delete this template? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

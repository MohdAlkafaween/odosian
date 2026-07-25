"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageLoader } from "@/components/ui/loading";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

interface ProjectRule {
  id: string;
  title: string;
  severity: string;
  status: string;
  language: string;
  ruleType: string;
  createdAt: string;
  author?: { name: string };
}

interface ProjectDetail {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  owner: { id: string; name: string };
  projectRules: Array<{ rule: ProjectRule }>;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [ruleSearch, setRuleSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; severity: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const isOwnerOrAdmin = project && (project.owner.id === user?.id || user?.role === "ADMIN");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (res.ok) {
        setProject(data.project);
      } else {
        addToast("error", "Category not found");
        router.push("/dashboard/projects");
      }
    } catch {
      addToast("error", "Failed to load category");
    } finally {
      setLoading(false);
    }
  }, [id, addToast, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleEdit = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDesc(project.description);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc }),
    });
    if (res.ok) {
      addToast("success", "Category updated");
      setEditing(false);
      fetchProject();
    } else {
      const err = await res.json();
      addToast("error", err.error || "Failed to update");
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("success", "Category deleted");
      router.push("/dashboard/projects");
    } else {
      addToast("error", "Failed to delete category");
    }
    setDeleting(false);
  };

  const handleSearchRules = async () => {
    if (!ruleSearch.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/rules?search=${encodeURIComponent(ruleSearch)}&limit=10`);
      const data = await res.json();
      if (res.ok) {
        const assignedIds = new Set(project?.projectRules.map((pr) => pr.rule.id));
        setSearchResults(data.rules.filter((r: { id: string }) => !assignedIds.has(r.id)));
      }
    } catch {
      addToast("error", "Failed to search rules");
    } finally {
      setSearching(false);
    }
  };

  const handleAddRule = async (ruleId: string) => {
    const res = await fetch(`/api/projects/${id}/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId }),
    });
    if (res.ok) {
      addToast("success", "Rule added to project");
      setSearchResults((prev) => prev.filter((r) => r.id !== ruleId));
      fetchProject();
    } else {
      const err = await res.json();
      addToast("error", err.error || "Failed to add rule");
    }
  };

  const handleRemoveRule = async () => {
    if (!removeTarget) return;
    const res = await fetch(`/api/projects/${id}/rules?ruleId=${removeTarget}`, { method: "DELETE" });
    if (res.ok) {
      addToast("success", "Rule removed from project");
      fetchProject();
    } else {
      addToast("error", "Failed to remove rule");
    }
    setRemoveTarget(null);
  };

  if (loading) return <PageLoader />;
  if (!project) return null;

  const rules = project.projectRules.map((pr) => pr.rule);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => router.push("/dashboard/projects")} className="text-sm text-text-muted hover:text-text mb-2 block">
            &larr; Back to Shield Categories
          </button>
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold bg-bg border border-border rounded-lg px-3 py-1 text-text w-full focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-[28px] font-extrabold text-text">{project.name}</h1>
              {project.description && <p className="text-sm text-text-secondary mt-1">{project.description}</p>}
              <p className="text-xs text-text-muted mt-1">
                Owned by {project.owner.name} · Created {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </>
          )}
        </div>
        {isOwnerOrAdmin && !editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleEdit}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>Delete</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Assigned Rules ({rules.length})</h2>
            <Button variant="outline" size="sm" onClick={() => setShowAddRule(!showAddRule)}>
              {showAddRule ? "Close" : "+ Add Rule"}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {showAddRule && (
            <div className="mb-4 p-3 bg-surface-light rounded-lg">
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchRules()}
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Search rules to add..."
                />
                <Button size="sm" onClick={handleSearchRules} disabled={searching}>
                  {searching ? "..." : "Search"}
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded hover:bg-bg">
                      <div className="flex items-center gap-2">
                        <Badge preset={r.severity as "low" | "medium" | "high" | "critical"} />
                        <span className="text-sm text-text">{r.title}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleAddRule(r.id)}>Add</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {rules.length === 0 ? (
            <p className="text-center text-text-muted py-8">No rules assigned to this project yet.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-light transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge preset={rule.severity as "low" | "medium" | "high" | "critical"} />
                    <div>
                      <Link href={`/dashboard/rules/${rule.id}`} className="text-sm font-medium text-primary hover:underline">
                        {rule.title}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {rule.ruleType} · {rule.language} · <Badge preset={rule.status as "draft" | "reviewed" | "production" | "deprecated"} />
                      </p>
                    </div>
                  </div>
                  {isOwnerOrAdmin && (
                    <Button variant="ghost" size="sm" onClick={() => setRemoveTarget(rule.id)}>Remove</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Category"
        message={`Are you sure you want to delete "${project.name}"? Rules will not be deleted.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={handleRemoveRule}
        title="Remove Rule"
        message="Remove this rule from the project? The rule itself will not be deleted."
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}

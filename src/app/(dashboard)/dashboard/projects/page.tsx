"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Pagination } from "@/components/ui/pagination";
import { PageLoader } from "@/components/ui/loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  owner: { id: string; name: string };
  _count: { projectRules: number };
}

export default function ProjectsPage() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      const res = await fetch(`/api/projects?${params}`);
      const data = await res.json();
      if (res.ok) {
        setProjects(data.projects);
        setTotalPages(data.pagination.totalPages);
      }
    } catch {
      addToast("error", "Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [page, search, addToast]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, description: formDesc }),
      });
      if (res.ok) {
        addToast("success", "Category created");
        setFormName("");
        setFormDesc("");
        setShowForm(false);
        fetchProjects();
      } else {
        const err = await res.json();
        addToast("error", err.error || "Failed to create category");
      }
    } catch {
      addToast("error", "Failed to create category");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Shield Categories</h1>
          <p className="text-sm text-text-muted mt-1">Rules are auto-organized by category as they&apos;re pulled in from Elastic</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Category"}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardBody>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Category Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g., Custom Category"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-1">Description</label>
                <textarea
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-text text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  rows={2}
                  placeholder="Optional description..."
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !formName.trim()}>
                {creating ? "Creating..." : "Create Category"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mb-4 max-w-sm">
        <SearchInput onSearch={(q) => { setSearch(q); setPage(1); }} placeholder="Search categories..." />
      </div>

      {loading ? (
        <PageLoader />
      ) : projects.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Categories are created automatically as rules are pulled in, or add one manually"
          actionLabel="New Category"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link key={p.id} href={`/dashboard/projects/${p.id}`}>
                <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                  <CardBody>
                    <h3 className="font-semibold text-text mb-1">{p.name}</h3>
                    {p.description && (
                      <p className="text-sm text-text-secondary line-clamp-2 mb-3">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <Badge preset="info">{p._count.projectRules} rule{p._count.projectRules !== 1 ? "s" : ""}</Badge>
                      <span className="text-xs text-text-muted">
                        {p.owner.name}{p.owner.id === user?.id ? " (you)" : ""}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      )}
    </div>
  );
}

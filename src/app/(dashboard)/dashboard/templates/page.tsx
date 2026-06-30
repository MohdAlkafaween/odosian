"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoader } from "@/components/ui/loading";

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  baseQuery: string;
  language: string;
  ruleType: string;
  variables: Array<{ name: string; label: string; defaultValue: string }>;
  tags: string[];
  mitreTactics: string[];
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

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
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, category]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const categoryOptions = [
    { value: "", label: "All Categories" },
    ...categories.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })),
  ];

  if (loading && templates.length === 0) return <PageLoader />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Shield Template Gallery</h1>
          <p className="text-sm text-text-secondary mt-1">
            Pre-built detection rule templates to get started quickly
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onSearch={setSearch}
            placeholder="Search templates..."
          />
        </div>
        <div className="w-48">
          <Select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={categoryOptions}
          />
        </div>
      </div>

      {templates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <Card key={t.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text truncate">{t.name}</h3>
                  <Badge preset="info">{t.category}</Badge>
                </div>
              </CardHeader>
              <CardBody className="flex-1 flex flex-col">
                <p className="text-xs text-text-secondary mb-3 line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-light text-text-muted">{t.language}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-surface-light text-text-muted">{t.ruleType}</span>
                  {t.variables.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {t.variables.length} variable{t.variables.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {t.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {t.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                        {tag}
                      </span>
                    ))}
                    {t.tags.length > 3 && (
                      <span className="text-xs text-text-muted">+{t.tags.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="mt-auto pt-3">
                  <Link href={`/dashboard/templates/${t.id}`}>
                    <Button variant="outline" size="sm" className="w-full">View Template</Button>
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

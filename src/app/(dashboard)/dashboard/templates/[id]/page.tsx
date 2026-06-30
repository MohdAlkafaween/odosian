"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeBlock } from "@/components/ui/code-block";
import { PageLoader } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";

interface TemplateVariable {
  name: string;
  label: string;
  defaultValue: string;
}

interface TemplateDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  baseQuery: string;
  language: string;
  ruleType: string;
  variables: TemplateVariable[];
  tags: string[];
  mitreTactics: string[];
}

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToastStore();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVarForm, setShowVarForm] = useState(false);
  const [varValues, setVarValues] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setTemplate(d.template);
        const defaults: Record<string, string> = {};
        for (const v of d.template?.variables || []) {
          defaults[v.name] = v.defaultValue || "";
        }
        setVarValues(defaults);
      })
      .catch(() => addToast("error", "Failed to load template"))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  const handleUseTemplate = () => {
    if (!template) return;

    if (template.variables.length > 0 && !showVarForm) {
      setShowVarForm(true);
      return;
    }

    let query = template.baseQuery;
    for (const [name, value] of Object.entries(varValues)) {
      query = query.replaceAll(`{{${name}}}`, value);
    }

    const params = new URLSearchParams({
      fromTemplate: "1",
      title: template.name,
      description: template.description,
      query,
      language: template.language,
      ruleType: template.ruleType,
      tags: JSON.stringify(template.tags),
    });

    router.push(`/dashboard/rules/new?${params}`);
  };

  if (loading) return <PageLoader />;
  if (!template) return <div className="text-center py-12 text-text-muted">Template not found.</div>;

  const highlightedQuery = template.baseQuery.replace(
    /\{\{(\w+)\}\}/g,
    '<span class="text-primary font-bold">{{$1}}</span>'
  );

  return (
    <div className="max-w-4xl">
      <Link href="/dashboard/templates" className="text-sm text-text-secondary hover:text-primary mb-4 inline-block">
        ← Back to Templates
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">{template.name}</h1>
          <p className="text-sm text-text-secondary mt-1">{template.description}</p>
        </div>
        <Button onClick={handleUseTemplate}>
          {showVarForm ? "Create Rule" : "Use This Template"}
        </Button>
      </div>

      <div className="flex gap-2 mb-6">
        <Badge preset="info">{template.category}</Badge>
        <span className="text-xs px-2 py-1 rounded bg-surface-light text-text-muted">{template.language}</span>
        <span className="text-xs px-2 py-1 rounded bg-surface-light text-text-muted">{template.ruleType}</span>
      </div>

      {showVarForm && template.variables.length > 0 && (
        <Card className="mb-6 border-primary/30">
          <CardHeader><h2 className="font-semibold text-text">Configure Variables</h2></CardHeader>
          <CardBody className="space-y-4">
            <p className="text-xs text-text-muted">Fill in the template variables below. These will replace the placeholders in the query.</p>
            {template.variables.map((v) => (
              <Input
                key={v.name}
                label={v.label || v.name}
                value={varValues[v.name] || ""}
                onChange={(e) => setVarValues((prev) => ({ ...prev, [v.name]: e.target.value }))}
                placeholder={v.defaultValue || `Enter ${v.name}...`}
              />
            ))}
          </CardBody>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><h2 className="font-semibold text-text">Detection Query</h2></CardHeader>
        <CardBody>
          {template.variables.length > 0 ? (
            <pre className="bg-bg rounded-lg p-4 overflow-x-auto text-sm font-mono text-text-secondary">
              <code dangerouslySetInnerHTML={{ __html: highlightedQuery }} />
            </pre>
          ) : (
            <CodeBlock code={template.baseQuery} language={template.language} />
          )}
        </CardBody>
      </Card>

      {template.variables.length > 0 && (
        <Card className="mb-6">
          <CardHeader><h2 className="font-semibold text-text">Variables ({template.variables.length})</h2></CardHeader>
          <CardBody>
            <div className="space-y-2">
              {template.variables.map((v) => (
                <div key={v.name} className="flex items-center justify-between bg-surface-light px-4 py-2.5 rounded-lg">
                  <div>
                    <code className="text-sm text-primary font-mono">{`{{${v.name}}}`}</code>
                    {v.label && <span className="text-sm text-text-secondary ml-2">— {v.label}</span>}
                  </div>
                  {v.defaultValue && <span className="text-xs text-text-muted">Default: {v.defaultValue}</span>}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {template.tags.length > 0 && (
        <Card className="mb-6">
          <CardHeader><h2 className="font-semibold text-text">Tags</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {template.tags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                  {tag}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {template.mitreTactics.length > 0 && (
        <Card className="mb-6">
          <CardHeader><h2 className="font-semibold text-text">MITRE ATT&CK Tactics</h2></CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {template.mitreTactics.map((tactic) => (
                <span key={tactic} className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                  {tactic}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageLoader } from "@/components/ui/loading";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";

interface RuleDetail {
  id: string;
  title: string;
  description: string;
  ruleType: string;
  severity: string;
  riskScore: number;
  query: string;
  language: string;
  index: string;
  tags: string[];
  status: string;
  version: number;
  interval: string;
  fromTime: string;
  maxSignals: number;
  investigationGuide: string;
  falsePositives: string[];
  references: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  mitreMappings: { id: string; tacticName: string; techniqueId: string; techniqueName: string; confidence: number }[];
  customFields?: { fieldName: string; fieldValue: string; fieldType: string }[];
  _count: { analyses: number };
}

export default function RuleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [rule, setRule] = useState<RuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const canEdit = user && rule && (rule.authorId === user.id || user.role === "ADMIN");

  useEffect(() => {
    const fetchRule = async () => {
      try {
        const res = await fetch(`/api/rules/${params.id}`);
        if (!res.ok) {
          addToast("error", "Rule not found");
          router.push("/dashboard/rules");
          return;
        }
        const data = await res.json();
        setRule(data.rule);
      } catch {
        addToast("error", "Failed to load rule");
      } finally {
        setLoading(false);
      }
    };
    fetchRule();
  }, [params.id, router, addToast]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/rules/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        addToast("success", "Rule deleted");
        router.push("/dashboard/rules");
      } else {
        const data = await res.json();
        addToast("error", data.error || "Failed to delete rule");
      }
    } catch {
      addToast("error", "Failed to delete rule");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addToast("success", "Rule duplicated");
        router.push(`/dashboard/rules/${data.rule.id}`);
      } else {
        addToast("error", data.error || "Failed to duplicate rule");
      }
    } catch {
      addToast("error", "Failed to duplicate rule");
    } finally {
      setDuplicating(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) return <PageLoader />;
  if (!rule) return null;

  return (
    <div className="max-w-5xl">
      <Link href="/dashboard/rules" className="text-sm text-text-secondary hover:text-primary mb-4 inline-block">
        ← Back to Rules
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">{rule.title}</h1>
          {rule.description && (
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">{rule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/dashboard/analysis?tab=analyze&ruleId=${rule.id}`)}
          >
            Analyze
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate} loading={duplicating}>
            Duplicate
          </Button>
          {canEdit && (
            <>
              <Button size="sm" onClick={() => router.push(`/dashboard/rules/${rule.id}/edit`)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted mb-1">Severity</p>
            <Badge preset={rule.severity as "low" | "medium" | "high" | "critical"} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted mb-1">Status</p>
            <Badge preset={rule.status as "draft" | "reviewed" | "production" | "deprecated"} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted mb-1">Risk Score</p>
            <span className="text-xl font-bold text-text">{rule.riskScore}</span>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted mb-1">Analyses</p>
            <span className="text-xl font-bold text-text">{rule._count.analyses}</span>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">Type</p>
          <p className="text-sm text-text">{rule.ruleType}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Language</p>
          <p className="text-sm text-text">{rule.language}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Interval</p>
          <p className="text-sm text-text">{rule.interval}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Max Signals</p>
          <p className="text-sm text-text">{rule.maxSignals}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Version</p>
          <p className="text-sm text-text">v{rule.version}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Author</p>
          <p className="text-sm text-text">{rule.author.name}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Created</p>
          <p className="text-sm text-text">{formatDate(rule.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Updated</p>
          <p className="text-sm text-text">{formatDate(rule.updatedAt)}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-text mb-3">Detection Query</h2>
          <CodeBlock code={rule.query} language={rule.language} />
        </div>

        {rule.index && (
          <div>
            <h2 className="text-lg font-semibold text-text mb-2">Index Patterns</h2>
            <p className="text-sm text-text-secondary font-mono bg-surface-light px-3 py-2 rounded-lg">
              {rule.index}
            </p>
          </div>
        )}

        {rule.tags.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-text mb-2">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {rule.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {rule.mitreMappings.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-text mb-2">MITRE ATT&CK Mappings</h2>
            <div className="space-y-2">
              {rule.mitreMappings.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-surface-light px-4 py-2.5 rounded-lg border border-border"
                >
                  <div>
                    <span className="text-sm font-medium text-text">{m.tacticName}</span>
                    <span className="text-text-muted mx-2">→</span>
                    <span className="text-sm text-accent">{m.techniqueId}: {m.techniqueName}</span>
                  </div>
                  <span className="text-xs text-text-muted">{m.confidence}% confidence</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {rule.investigationGuide && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-text">Investigation Guide</h2>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">{rule.investigationGuide}</p>
            </CardBody>
          </Card>
        )}

        {rule.falsePositives.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-text">False Positives</h2>
            </CardHeader>
            <CardBody>
              <ul className="list-disc list-inside space-y-1">
                {rule.falsePositives.map((fp, i) => (
                  <li key={i} className="text-sm text-text-secondary">{fp}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}

        {rule.references.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-text">References</h2>
            </CardHeader>
            <CardBody>
              <ul className="space-y-1">
                {rule.references.map((ref, i) => (
                  <li key={i}>
                    <a
                      href={ref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {ref}
                    </a>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </div>

      {rule.customFields && rule.customFields.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h2 className="text-lg font-semibold text-text">Custom Fields</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rule.customFields.map((cf) => (
                <div key={cf.fieldName}>
                  <p className="text-xs text-text-muted mb-1">{cf.fieldName}</p>
                  <p className="text-sm text-text">
                    {cf.fieldType === "boolean" ? (cf.fieldValue === "true" ? "Yes" : "No") : cf.fieldValue || "—"}
                  </p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Rule"
        message={`Are you sure you want to delete "${rule.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

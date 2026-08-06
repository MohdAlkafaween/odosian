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
import { ScoreGauge } from "@/components/ui/score-gauge";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { useTabStore } from "@/stores/tabs";
import { VersionHistory } from "@/components/version-history";
import { CommentsSection } from "@/components/comments-section";

interface AnalysisRecord {
  id: string;
  analysisType: string;
  inputQuery: string | null;
  outputQuery: string | null;
  score: number | null;
  rating: string | null;
  feedback: string | null;
  findings: Array<{ title: string; detail: string; severity: string; category: string }> | string[];
  suggestions: Array<{ title: string; description: string; priority: number; codeSnippet?: string }> | string[];
  strengths: string[];
  weaknesses: string[];
  evasionRisks: Array<{ technique: string; description: string; mitigation: string }>;
  mitreMappings: Array<{ tacticName: string; techniqueId: string; techniqueName: string; confidence: number }>;
  fpRisk: string;
  modelUsed: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  batchId: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  analyze: "Full Analysis",
  enhance: "Enhancement",
  post_enhance: "Analysis After Enhancement",
  generate: "Generation",
  feedback: "Quick Feedback",
};

const TYPE_COLORS: Record<string, string> = {
  analyze: "text-primary",
  enhance: "text-accent",
  post_enhance: "text-success",
  generate: "text-success",
  feedback: "text-severity-medium",
};

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
  covered: boolean;
  coveredAt: string | null;
  version: number;
  interval: string;
  fromTime: string;
  maxSignals: number;
  investigationGuide: string;
  falsePositives: string[];
  references: string[];
  elasticRuleId: string | null;
  elasticEnabled: boolean;
  license: string;
  timestampOverride: string;
  timelineId: string;
  timelineTitle: string;
  relatedIntegrations: { package: string; version: string }[];
  requiredFields: { name: string; type: string }[];
  investigationFields: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
  mitreMappings: { id: string; tacticName: string; techniqueId: string; techniqueName: string; confidence: number }[];
  customFields?: { fieldName: string; fieldValue: string; fieldType: string }[];
  aiFlags?: {
    analyzed: boolean;
    enhanced: boolean;
    feedback: boolean;
    generated: boolean;
    deployed: boolean;
  };
  _count: { analyses: number };
}

interface ElasticConn {
  id: string;
  name: string;
  kibanaUrl: string;
  isActive: boolean;
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
  const [elasticOpen, setElasticOpen] = useState(false);
  const [elasticConns, setElasticConns] = useState<ElasticConn[]>([]);
  const [selectedConn, setSelectedConn] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [togglingCovered, setTogglingCovered] = useState(false);
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [analysesLoading, setAnalysesLoading] = useState(false);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

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

  const handleToggleCovered = async () => {
    if (!rule) return;
    setTogglingCovered(true);
    const nextCovered = !rule.covered;
    try {
      const res = await fetch(`/api/rules/${rule.id}/covered`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ covered: nextCovered }),
      });
      if (res.ok) {
        const data = await res.json();
        setRule({ ...rule, covered: data.covered, coveredAt: data.coveredAt });
        addToast("success", nextCovered ? "Marked as covered" : "Marked as not covered");
      } else {
        addToast("error", "Failed to update coverage");
      }
    } catch {
      addToast("error", "Failed to update coverage");
    } finally {
      setTogglingCovered(false);
    }
  };

  useEffect(() => {
    if (!params.id) return;
    setAnalysesLoading(true);
    fetch(`/api/analysis?ruleId=${params.id}&limit=50&sortDir=desc`)
      .then((r) => r.json())
      .then((d) => {
        setAnalyses(d.analyses || []);
        if (d.analyses?.length > 0) setExpandedAnalysis(d.analyses[0].id);
      })
      .catch(() => {})
      .finally(() => setAnalysesLoading(false));
  }, [params.id]);

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

  const { addTab, updateTab, setActiveTab } = useTabStore();

  const handleSimulate = async () => {
    if (!rule) return;
    const tabId = addTab({
      type: "simulate",
      title: `Simulate: ${rule.title}`,
      ruleId: rule.id,
      ruleName: rule.title,
      status: "running",
      statusMessage: "Generating attack simulation from rule fields...",
    });

    try {
      const res = await fetch(`/api/rules/${rule.id}/simulate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        updateTab(tabId, { status: "completed", result: data.simulation });
        setActiveTab(tabId);
      } else {
        updateTab(tabId, { status: "failed", error: data.error || "Simulation failed" });
      }
    } catch {
      updateTab(tabId, { status: "failed", error: "Failed to connect to server" });
    }
  };

  const openElasticPush = async () => {
    try {
      const res = await fetch("/api/elastic");
      if (res.ok) {
        const data = await res.json();
        const active = (data.connections || []).filter((c: ElasticConn) => c.isActive);
        setElasticConns(active);
        if (active.length > 0 && !selectedConn) setSelectedConn(active[0].id);
      }
    } catch { /* ignore */ }
    setElasticOpen(true);
  };

  const handlePushElastic = async () => {
    if (!selectedConn) return;
    setPushing(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/push-elastic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedConn, enabled: pushEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast(
          "success",
          data.duplicated
            ? `Pushed as a new rule and disabled the original${data.oldRuleDisabled ? "" : " (couldn't disable the original — check it in Kibana)"}`
            : `Rule ${data.action} in Elastic Security`
        );
        setElasticOpen(false);
        setRule((prev) => prev ? { ...prev, elasticRuleId: data.elasticRuleId, elasticEnabled: data.enabled } : prev);
      } else {
        addToast("error", data.error || "Failed to push rule");
      }
    } catch {
      addToast("error", "Failed to push rule to Elastic");
    } finally {
      setPushing(false);
    }
  };

  const handleToggleElasticEnabled = async () => {
    if (!rule) return;
    const nextEnabled = !rule.elasticEnabled;
    setPausing(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/elastic-enabled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setRule((prev) => prev ? { ...prev, elasticEnabled: data.enabled } : prev);
        addToast("success", nextEnabled ? "Rule resumed in Elastic" : "Rule paused in Elastic");
      } else {
        addToast("error", data.error || "Failed to update rule status");
      }
    } catch {
      addToast("error", "Failed to update rule status");
    } finally {
      setPausing(false);
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
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[28px] font-extrabold text-text">{rule.title}</h1>
            {rule.aiFlags && (
              <>
                {rule.aiFlags.analyzed && <Badge preset="analyzed">Analyzed</Badge>}
                {rule.aiFlags.enhanced && <Badge preset="enhanced">Enhanced</Badge>}
                {rule.aiFlags.feedback && <Badge preset="qf">QF</Badge>}
                {rule.aiFlags.generated && <Badge preset="generated">Generated</Badge>}
                {rule.aiFlags.deployed && <Badge preset="deployed">Deployed</Badge>}
              </>
            )}
          </div>
          {rule.description && (
            <p className="text-sm text-text-secondary mt-1 max-w-2xl">{rule.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={rule.covered ? "success" : "outline"}
            size="sm"
            onClick={handleToggleCovered}
            loading={togglingCovered}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              {rule.covered ? "Covered" : "Mark as Covered"}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openElasticPush}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /><path d="M17 8l4 4-4 4" /></svg>
              {rule.elasticRuleId ? "Update in Elastic" : "Push to Elastic"}
            </span>
          </Button>
          {rule.elasticRuleId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleElasticEnabled}
              loading={pausing}
            >
              <span className="flex items-center gap-1.5">
                {rule.elasticEnabled ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                )}
                {rule.elasticEnabled ? "Pause in Elastic" : "Resume in Elastic"}
              </span>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSimulate}
          >
            <span className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="3" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
              Simulate
            </span>
          </Button>
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

        {(rule.license || rule.timestampOverride || rule.timelineId || rule.timelineTitle
          || rule.relatedIntegrations.length > 0 || rule.requiredFields.length > 0 || rule.investigationFields.length > 0) && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-text">Elastic Metadata</h2>
            </CardHeader>
            <CardBody className="space-y-3">
              {rule.license && (
                <p className="text-sm"><span className="text-text-muted">License:</span> <span className="text-text">{rule.license}</span></p>
              )}
              {rule.timestampOverride && (
                <p className="text-sm"><span className="text-text-muted">Timestamp Override:</span> <span className="text-text">{rule.timestampOverride}</span></p>
              )}
              {(rule.timelineId || rule.timelineTitle) && (
                <p className="text-sm"><span className="text-text-muted">Timeline Template:</span> <span className="text-text">{rule.timelineTitle || rule.timelineId}</span></p>
              )}
              {rule.investigationFields.length > 0 && (
                <div>
                  <p className="text-sm text-text-muted mb-1">Custom Highlighted Fields:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.investigationFields.map((f, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-surface-light border border-border text-text-secondary">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {rule.relatedIntegrations.length > 0 && (
                <div>
                  <p className="text-sm text-text-muted mb-1">Related Integrations:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.relatedIntegrations.map((ri, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-surface-light border border-border text-text-secondary">{ri.package}@{ri.version}</span>
                    ))}
                  </div>
                </div>
              )}
              {rule.requiredFields.length > 0 && (
                <div>
                  <p className="text-sm text-text-muted mb-1">Required Fields:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {rule.requiredFields.map((rf, i) => (
                      <span key={i} className="text-xs font-mono px-2 py-0.5 rounded bg-surface-light border border-border text-text-secondary">{rf.name} ({rf.type})</span>
                    ))}
                  </div>
                </div>
              )}
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

      {/* AI Analysis History */}
      {analyses.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text">AI Analysis History</h2>
            <span className="text-xs text-text-muted">{analyses.length} record{analyses.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="space-y-3">
            {analyses.map((a) => {
              const expanded = expandedAnalysis === a.id;
              const isAnalyze = a.analysisType === "analyze" || a.analysisType === "post_enhance";
              const isEnhance = a.analysisType === "enhance";
              const isFeedback = a.analysisType === "feedback";
              const isGenerate = a.analysisType === "generate";

              return (
                <Card key={a.id}>
                  <button
                    onClick={() => setExpandedAnalysis(expanded ? null : a.id)}
                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-surface-light/50 transition-colors rounded-t-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isAnalyze ? "bg-primary/10 text-primary" :
                        isEnhance ? "bg-accent/10 text-accent" :
                        isGenerate ? "bg-success/10 text-success" :
                        "bg-severity-medium/10 text-severity-medium"
                      }`}>
                        {isAnalyze ? "A" : isEnhance ? "E" : isGenerate ? "G" : "F"}
                      </div>
                      <div className="text-left">
                        <span className={`text-sm font-semibold ${TYPE_COLORS[a.analysisType] || "text-text"}`}>
                          {TYPE_LABELS[a.analysisType] || a.analysisType}
                        </span>
                        <p className="text-[11px] text-text-muted">
                          {new Date(a.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {a.user && ` · ${a.user.name}`}
                          {a.batchId && (
                            <>
                              {" · "}
                              <Link
                                href={`/dashboard/analysis/batches/${a.batchId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline"
                              >
                                Batch Run
                              </Link>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {a.score !== null && a.score > 0 && (
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            a.score >= 80 ? "text-success" : a.score >= 60 ? "text-accent" : a.score >= 40 ? "text-severity-medium" : "text-severity-high"
                          }`}>{a.score}/100</span>
                          {a.rating && <Badge preset={a.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{a.rating}</Badge>}
                        </div>
                      )}
                      {isFeedback && a.feedback && (() => {
                        const verdictMatch = a.feedback.match(/verdict.*?:\s*"?(production_ready|needs_tuning|needs_rework|reject)"?/i);
                        return null;
                      })()}
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>
                  </button>

                  {expanded && (
                    <CardBody className="pt-0 space-y-4">
                      <div className="border-t border-border pt-4" />

                      {/* ── ANALYZE ── */}
                      {isAnalyze && (
                        <>
                          {a.score !== null && (
                            <div className="flex items-center gap-5">
                              <ScoreGauge score={a.score} size={80} label="Score" />
                              <div className="space-y-1">
                                {a.rating && <Badge preset={a.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{a.rating}</Badge>}
                                {a.fpRisk && a.fpRisk !== "low" && (
                                  <div className="text-xs text-text-muted">FP Risk: <span className={a.fpRisk === "high" ? "text-severity-high" : "text-severity-medium"}>{a.fpRisk}</span></div>
                                )}
                              </div>
                            </div>
                          )}
                          {a.feedback && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Assessment</p>
                              <p className="text-sm text-text-secondary whitespace-pre-wrap">{a.feedback}</p>
                            </div>
                          )}
                          {(a.strengths?.length > 0 || a.weaknesses?.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {a.strengths?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-success mb-1.5">Strengths</p>
                                  <ul className="space-y-1">
                                    {a.strengths.map((s, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-success shrink-0">&#10003;</span>{s}</li>)}
                                  </ul>
                                </div>
                              )}
                              {a.weaknesses?.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-danger mb-1.5">Weaknesses</p>
                                  <ul className="space-y-1">
                                    {a.weaknesses.map((w, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-danger shrink-0">&#10007;</span>{w}</li>)}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          {Array.isArray(a.findings) && a.findings.length > 0 && typeof a.findings[0] === "object" && "title" in a.findings[0] && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Findings ({a.findings.length})</p>
                              <div className="space-y-2">
                                {(a.findings as Array<{ title: string; detail: string; severity: string; category: string }>).map((f, i) => (
                                  <div key={i} className="bg-bg rounded-lg p-3 border border-border">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge preset={f.severity as "critical" | "high" | "medium" | "low"} />
                                      <Badge preset="info">{f.category}</Badge>
                                      <span className="text-xs font-medium text-text">{f.title}</span>
                                    </div>
                                    <p className="text-xs text-text-secondary">{f.detail}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {Array.isArray(a.suggestions) && a.suggestions.length > 0 && typeof a.suggestions[0] === "object" && "title" in a.suggestions[0] && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Suggestions</p>
                              <div className="space-y-2">
                                {(a.suggestions as Array<{ title: string; description: string; priority: number; codeSnippet?: string }>)
                                  .sort((x, y) => x.priority - y.priority)
                                  .map((s, i) => (
                                    <div key={i} className="border-b border-border last:border-0 pb-2 last:pb-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">P{s.priority}</span>
                                        <span className="text-xs font-medium text-text">{s.title}</span>
                                      </div>
                                      <p className="text-xs text-text-secondary">{s.description}</p>
                                      {s.codeSnippet && <CodeBlock code={s.codeSnippet} language={rule.language} maxHeight="150px" />}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                          {a.evasionRisks?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Evasion Risks</p>
                              <div className="space-y-2">
                                {a.evasionRisks.map((e, i) => (
                                  <div key={i} className="bg-bg rounded-lg p-3 border border-border">
                                    <p className="text-xs font-medium text-severity-medium mb-0.5">{e.technique}</p>
                                    <p className="text-xs text-text-secondary mb-1">{e.description}</p>
                                    <p className="text-xs text-success"><span className="font-medium">Mitigation:</span> {e.mitigation}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── ENHANCE ── */}
                      {isEnhance && (
                        <>
                          {a.inputQuery && a.outputQuery && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Query Comparison</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-[11px] font-semibold text-severity-medium mb-1">Before Enhancement</p>
                                  <CodeBlock code={a.inputQuery} language={rule.language} maxHeight="250px" />
                                </div>
                                <div>
                                  <p className="text-[11px] font-semibold text-success mb-1">After Enhancement</p>
                                  <CodeBlock code={a.outputQuery} language={rule.language} maxHeight="250px" />
                                </div>
                              </div>
                            </div>
                          )}
                          {a.feedback && (() => {
                            try {
                              const changelog = JSON.parse(a.feedback);
                              if (Array.isArray(changelog) && changelog.length > 0) {
                                return (
                                  <div>
                                    <p className="text-xs font-semibold text-text-muted mb-1.5">Changelog</p>
                                    <div className="space-y-2">
                                      {changelog.map((c: { change: string; reason: string }, i: number) => (
                                        <div key={i} className="flex gap-2 text-xs">
                                          <span className="text-accent shrink-0 mt-0.5">&#9656;</span>
                                          <div>
                                            <span className="font-medium text-text">{c.change}</span>
                                            {c.reason && <span className="text-text-muted"> &mdash; {c.reason}</span>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              }
                            } catch { /* not JSON, show as text */ }
                            return (
                              <div>
                                <p className="text-xs font-semibold text-text-muted mb-1.5">Feedback</p>
                                <p className="text-sm text-text-secondary whitespace-pre-wrap">{a.feedback}</p>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* ── GENERATE ── */}
                      {isGenerate && (
                        <>
                          {a.score !== null && (
                            <div className="flex items-center gap-5">
                              <ScoreGauge score={a.score} size={60} label="Self-Score" />
                            </div>
                          )}
                          {a.outputQuery && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Generated Query</p>
                              <CodeBlock code={a.outputQuery} language={rule.language} maxHeight="250px" />
                            </div>
                          )}
                          {a.inputQuery && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Original Description</p>
                              <p className="text-sm text-text-secondary whitespace-pre-wrap bg-bg rounded-lg p-3 border border-border">{a.inputQuery}</p>
                            </div>
                          )}
                          {a.feedback && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Notes</p>
                              <p className="text-sm text-text-secondary whitespace-pre-wrap">{a.feedback}</p>
                            </div>
                          )}
                        </>
                      )}

                      {/* ── FEEDBACK ── */}
                      {isFeedback && (
                        <>
                          {a.score !== null && (
                            <div className="flex items-center gap-5">
                              <ScoreGauge score={a.score} size={80} label="Quality Score" />
                              <div className="flex items-center gap-2">
                                {a.rating && <Badge preset={a.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{a.rating}</Badge>}
                              </div>
                            </div>
                          )}
                          {a.feedback && (
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1.5">Feedback</p>
                              <p className="text-sm text-text-secondary whitespace-pre-wrap">{a.feedback}</p>
                            </div>
                          )}
                          {(Array.isArray(a.findings) && a.findings.length > 0) || (Array.isArray(a.suggestions) && a.suggestions.length > 0) ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {Array.isArray(a.findings) && a.findings.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-danger mb-1.5">Top Issues</p>
                                  <ol className="list-decimal list-inside space-y-1">
                                    {a.findings.map((issue, i) => (
                                      <li key={i} className="text-sm text-text-secondary">{typeof issue === "string" ? issue : (issue as { title: string }).title}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                              {Array.isArray(a.suggestions) && a.suggestions.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-success mb-1.5">Quick Fixes</p>
                                  <ol className="list-decimal list-inside space-y-1">
                                    {a.suggestions.map((fix, i) => (
                                      <li key={i} className="text-sm text-text-secondary">{typeof fix === "string" ? fix : (fix as { title: string }).title}</li>
                                    ))}
                                  </ol>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </>
                      )}

                      {/* MITRE mappings — shared across all types */}
                      {a.mitreMappings?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-text-muted mb-1.5">MITRE ATT&CK Mappings</p>
                          <div className="space-y-1">
                            {a.mitreMappings.map((m, i) => (
                              <div key={i} className="flex items-center justify-between bg-surface-light px-3 py-2 rounded-lg border border-border">
                                <div>
                                  <span className="text-xs font-medium text-text">{m.tacticName}</span>
                                  <span className="text-text-muted mx-1.5 text-[10px]">&rarr;</span>
                                  <span className="text-xs text-accent">{m.techniqueId}: {m.techniqueName}</span>
                                </div>
                                <span className="text-[10px] text-text-muted">{m.confidence}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI metadata footer */}
                      <div className="flex items-center gap-4 pt-2 border-t border-border text-[10px] text-text-muted">
                        {a.modelUsed && <span>Model: {a.modelUsed}</span>}
                        {a.tokensUsed !== null && a.tokensUsed > 0 && <span>{a.tokensUsed.toLocaleString()} tokens</span>}
                        {a.latencyMs !== null && a.latencyMs > 0 && <span>{(a.latencyMs / 1000).toFixed(1)}s</span>}
                        <Link
                          href={`/dashboard/analysis/${a.id}`}
                          className="ml-auto text-primary hover:underline text-[11px]"
                        >
                          View Full Details &rarr;
                        </Link>
                      </div>
                    </CardBody>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {analysesLoading && (
        <div className="mt-8 flex justify-center py-6">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!analysesLoading && analyses.length === 0 && rule._count.analyses === 0 && null}

      {/* Version History */}
      <div className="mt-8">
        <VersionHistory
          ruleId={rule.id}
          currentRule={{
            version: rule.version,
            title: rule.title,
            description: rule.description,
            query: rule.query,
            severity: rule.severity,
            riskScore: rule.riskScore,
            status: rule.status,
            language: rule.language,
          }}
        />
      </div>

      {/* Comments */}
      <div className="mt-8">
        <CommentsSection ruleId={rule.id} />
      </div>

      {/* Elastic Push Dialog */}
      {elasticOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Push to Elastic Security</h3>
                  <p className="text-[11px] text-text-muted">
                    {rule.elasticRuleId ? "Update existing rule" : "Create new detection rule"}
                  </p>
                </div>
              </div>
              <button onClick={() => setElasticOpen(false)} className="p-1 text-text-muted hover:text-text transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {elasticConns.length === 0 ? (
                <div className="text-center py-6">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted mx-auto mb-3">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <p className="text-sm text-text-secondary mb-1">No Elastic connections configured</p>
                  <p className="text-xs text-text-muted">Go to Settings &gt; API &amp; Connections to add one.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1.5">Connection</label>
                    <select
                      value={selectedConn}
                      onChange={(e) => setSelectedConn(e.target.value)}
                      className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {elasticConns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} — {c.kibanaUrl}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between bg-surface-light rounded-lg px-4 py-3 border border-border">
                    <div>
                      <p className="text-sm text-text font-medium">Enable rule after push</p>
                      <p className="text-[11px] text-text-muted">If enabled, the rule will start generating alerts immediately</p>
                    </div>
                    <button
                      onClick={() => setPushEnabled(!pushEnabled)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${pushEnabled ? "bg-primary" : "bg-border"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${pushEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>

                  {rule.elasticRuleId && (
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary shrink-0">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                      <p className="text-xs text-text-secondary">
                        This rule is already synced as <span className="font-mono text-primary">{rule.elasticRuleId}</span>. It will be updated.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

            {elasticConns.length > 0 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setElasticOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={handlePushElastic} loading={pushing}>
                  {rule.elasticRuleId ? "Update Rule" : "Push Rule"}
                </Button>
              </div>
            )}
          </div>
        </div>
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

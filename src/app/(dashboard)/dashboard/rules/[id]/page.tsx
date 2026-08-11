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
import { useTabStore } from "@/stores/tabs";
import { VersionHistory } from "@/components/version-history";
import { CommentsSection } from "@/components/comments-section";
import type { SyncFieldDiff } from "@/lib/errors";

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

// Matches RULE_TYPES/LANGUAGES in rule-form.tsx — this page was showing the
// raw enum values (e.g. "new_terms", "kuery") instead of the same labels the
// create/edit form already uses for them.
const RULE_TYPE_LABEL: Record<string, string> = {
  query: "Query",
  eql: "EQL",
  threshold: "Threshold",
  new_terms: "New Terms",
  machine_learning: "Machine Learning",
  indicator_match: "Indicator Match",
};

const LANGUAGE_LABEL: Record<string, string> = {
  kuery: "KQL (Kuery)",
  eql: "EQL",
  lucene: "Lucene",
  esql: "ES|QL",
};

const SYNC_STATUS_LABEL: Record<string, string> = {
  not_linked: "Not linked",
  remote_missing: "Missing in Elastic",
  in_sync: "In sync",
  local_ahead: "Local changes not pushed",
  remote_ahead: "Elastic changed — pull available",
  diverged: "Diverged — review needed",
};

const SYNC_STATUS_BADGE: Record<string, "production" | "analyzed" | "enhanced" | "reject" | "draft" | "deprecated"> = {
  not_linked: "draft",
  remote_missing: "deprecated",
  in_sync: "production",
  local_ahead: "analyzed",
  remote_ahead: "enhanced",
  diverged: "reject",
};

export default function RuleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [rule, setRule] = useState<RuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removeElasticOpen, setRemoveElasticOpen] = useState(false);
  const [removingElastic, setRemovingElastic] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [elasticOpen, setElasticOpen] = useState(false);
  const [elasticConns, setElasticConns] = useState<ElasticConn[]>([]);
  const [selectedConn, setSelectedConn] = useState("");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [checkingSync, setCheckingSync] = useState(false);
  const [conflict, setConflict] = useState<{ status: string; diffs: SyncFieldDiff[] } | null>(null);
  const [togglingCovered, setTogglingCovered] = useState(false);

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

  const handleRemoveFromElastic = async () => {
    setRemovingElastic(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/delete-elastic`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        addToast("success", "Rule removed from Elastic");
        setSyncStatus(null);
        setRule((prev) => prev ? { ...prev, elasticRuleId: null, elasticEnabled: false, covered: false } : prev);
      } else {
        addToast("error", data.error || "Failed to remove rule from Elastic");
      }
    } catch {
      addToast("error", "Failed to remove rule from Elastic");
    } finally {
      setRemovingElastic(false);
      setRemoveElasticOpen(false);
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

  const checkSync = async () => {
    if (!rule?.elasticRuleId) return;
    setCheckingSync(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/elastic-check`);
      const data = await res.json();
      if (res.ok) setSyncStatus(data.status);
    } catch { /* ignore */ }
    finally { setCheckingSync(false); }
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
    setConflict(null);
    setElasticOpen(true);
    checkSync();
  };

  const handlePushElastic = async (force = false) => {
    if (!selectedConn) return;
    setPushing(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/push-elastic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selectedConn, enabled: pushEnabled, force }),
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
        setConflict(null);
        setSyncStatus("in_sync");
        setRule((prev) => prev ? { ...prev, elasticRuleId: data.elasticRuleId, elasticEnabled: data.enabled } : prev);
      } else if (data.conflict) {
        setConflict({ status: data.status, diffs: data.diffs || [] });
      } else {
        addToast("error", data.error || "Failed to push rule");
      }
    } catch {
      addToast("error", "Failed to push rule to Elastic");
    } finally {
      setPushing(false);
    }
  };

  const handlePullElastic = async (force = false) => {
    setPulling(true);
    try {
      const res = await fetch(`/api/rules/${params.id}/pull-elastic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("success", "Pulled the current Elastic version into this rule");
        setConflict(null);
        setSyncStatus("in_sync");
        setRule((prev) => prev ? { ...prev, title: data.title, description: data.description, query: data.query, severity: data.severity, riskScore: data.riskScore } : prev);
      } else if (data.conflict) {
        setConflict({ status: data.status, diffs: data.diffs || [] });
      } else {
        addToast("error", data.error || "Failed to pull rule from Elastic");
      }
    } catch {
      addToast("error", "Failed to pull rule from Elastic");
    } finally {
      setPulling(false);
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

      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[28px] font-extrabold text-text break-words">{rule.title}</h1>
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
        <div className="flex flex-wrap items-center gap-2">
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
          {rule.elasticRuleId && (
            <Button variant="danger" size="sm" onClick={() => setRemoveElasticOpen(true)}>
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" /></svg>
                Remove from Elastic
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
        <Link href={`/dashboard/rules/${rule.id}/history`}>
          <Card className="hover:border-primary/50 transition-colors">
            <CardBody>
              <p className="text-xs text-text-muted mb-1">Analyses</p>
              <span className="text-xl font-bold text-text">{rule._count.analyses}</span>
            </CardBody>
          </Card>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <p className="text-xs text-text-muted">Type</p>
          <p className="text-sm text-text">{RULE_TYPE_LABEL[rule.ruleType] || rule.ruleType}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Language</p>
          <p className="text-sm text-text">{LANGUAGE_LABEL[rule.language] || rule.language}</p>
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

                  {rule.elasticRuleId && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">Sync status:</span>
                        {checkingSync ? (
                          <span className="text-xs text-text-muted">Checking...</span>
                        ) : (
                          <Badge preset={SYNC_STATUS_BADGE[syncStatus || ""] || "info"}>
                            {SYNC_STATUS_LABEL[syncStatus || ""] || "Unknown"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={checkSync} className="text-xs text-primary hover:underline">Recheck</button>
                        {(syncStatus === "remote_ahead" || syncStatus === "diverged") && (
                          <Button size="sm" variant="outline" onClick={() => handlePullElastic(false)} loading={pulling}>
                            Pull
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {conflict && (
                    <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 space-y-3">
                      <p className="text-xs text-danger font-medium">
                        {conflict.status === "diverged"
                          ? "This rule and its Elastic copy have both changed since the last sync."
                          : "Elastic has a version of this rule that hasn't been pulled in yet."}
                      </p>
                      {conflict.diffs.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {conflict.diffs.map((d) => (
                            <div key={d.field} className="text-xs">
                              <p className="font-semibold text-text mb-1">{d.label}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-bg rounded px-2 py-1 border border-border">
                                  <p className="text-[10px] text-text-muted mb-0.5">Odosian</p>
                                  <p className="text-text-secondary truncate">{d.local || "—"}</p>
                                </div>
                                <div className="bg-bg rounded px-2 py-1 border border-border">
                                  <p className="text-[10px] text-text-muted mb-0.5">Elastic</p>
                                  <p className="text-text-secondary truncate">{d.remote || "—"}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handlePullElastic(true)} loading={pulling}>
                          Take Elastic&apos;s Version
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handlePushElastic(true)} loading={pushing}>
                          Overwrite Elastic
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {elasticConns.length > 0 && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setElasticOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => handlePushElastic(false)} loading={pushing}>
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

      <ConfirmDialog
        open={removeElasticOpen}
        onClose={() => setRemoveElasticOpen(false)}
        onConfirm={handleRemoveFromElastic}
        title="Remove from Elastic"
        message={`This deletes "${rule.title}" from Elastic Security entirely — it will stop generating alerts and won't show up in Kibana anymore. The rule stays in Odosian and can be pushed again later. Continue?`}
        confirmLabel="Remove"
        variant="danger"
        loading={removingElastic}
      />
    </div>
  );
}

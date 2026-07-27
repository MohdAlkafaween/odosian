"use client";

import { useTabStore, type AITab, type TabType } from "@/stores/tabs";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Spinner } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { useToastStore } from "@/stores/toast";
import { useState } from "react";
import type { AnalyzeResult, EnhanceResult, GenerateResult, FeedbackResult } from "@/lib/ai";

const TYPE_LABELS: Record<TabType, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Quick Feedback",
};

export function AITabContent() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  if (!activeTab) return null;

  return (
    <div className="flex-1 overflow-auto bg-bg">
      <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge preset={activeTab.type === "analyze" ? "analyzed" : activeTab.type === "enhance" ? "enhanced" : activeTab.type === "generate" ? "generated" : "qf"}>
                {TYPE_LABELS[activeTab.type]}
              </Badge>
              {activeTab.status === "running" && <Badge preset="draft">Running</Badge>}
              {activeTab.status === "completed" && <Badge preset="production">Completed</Badge>}
              {activeTab.status === "failed" && <Badge preset="critical">Failed</Badge>}
            </div>
            <h1 className="text-xl font-bold text-text">{activeTab.title}</h1>
            {activeTab.ruleName && (
              <p className="text-sm text-text-muted mt-0.5">Rule: {activeTab.ruleName}</p>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setActiveTab(null);
            }}
          >
            Back to page
          </Button>
        </div>

        {activeTab.status === "running" && (
          <div className="flex flex-col items-center gap-3 py-16">
            <Spinner size="lg" />
            <p className="text-text-secondary text-sm">{activeTab.statusMessage || "Processing..."}</p>
          </div>
        )}

        {activeTab.status === "failed" && (
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 text-danger">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <p className="text-sm font-medium">{activeTab.error || "Operation failed"}</p>
              </div>
            </CardBody>
          </Card>
        )}

        {activeTab.status === "completed" && activeTab.result && (
          <>
            {activeTab.type === "analyze" && (
              <TabAnalyzeResults result={activeTab.result as AnalyzeResult} ruleId={activeTab.ruleId} />
            )}
            {activeTab.type === "enhance" && (
              <TabEnhanceResults result={activeTab.result as EnhanceResult & { inputQuery?: string }} ruleId={activeTab.ruleId} />
            )}
            {activeTab.type === "generate" && (
              <TabGenerateResults result={activeTab.result as GenerateResult} />
            )}
            {activeTab.type === "feedback" && (
              <TabFeedbackResults result={activeTab.result as FeedbackResult} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabAnalyzeResults({ result, ruleId }: { result: AnalyzeResult; ruleId?: string }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <ScoreGauge score={result.score} size={100} label="Quality Score" />
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge preset={result.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{result.rating}</Badge>
            <Badge preset={result.fpRisk === "high" ? "critical" : result.fpRisk === "medium" ? "medium" : "low"}>
              FP Risk: {result.fpRisk}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader><h3 className="text-lg font-semibold text-text">Assessment</h3></CardHeader>
        <CardBody><p className="text-sm text-text-secondary whitespace-pre-wrap">{result.feedback}</p></CardBody>
      </Card>

      {(result.strengths?.length > 0 || result.weaknesses?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {result.strengths?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-success">Strengths</h3></CardHeader>
              <CardBody>
                <ul className="space-y-1">
                  {result.strengths.map((s, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-success shrink-0">✓</span>{s}</li>)}
                </ul>
              </CardBody>
            </Card>
          )}
          {result.weaknesses?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-danger">Weaknesses</h3></CardHeader>
              <CardBody>
                <ul className="space-y-1">
                  {result.weaknesses.map((w, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-danger shrink-0">✗</span>{w}</li>)}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {result.findings?.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold text-text">Findings ({result.findings.length})</h3></CardHeader>
          <CardBody className="space-y-3">
            {result.findings.map((f, i) => (
              <div key={i} className="bg-bg rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge preset={f.severity as "critical" | "high" | "medium" | "low"} />
                  <Badge preset="info">{f.category}</Badge>
                  <span className="text-sm font-medium text-text">{f.title}</span>
                </div>
                <p className="text-sm text-text-secondary">{f.detail}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {result.suggestions?.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold text-text">Suggestions</h3></CardHeader>
          <CardBody className="space-y-4">
            {result.suggestions.sort((a, b) => a.priority - b.priority).map((s, i) => (
              <div key={i} className="border-b border-border last:border-0 pb-4 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">P{s.priority}</span>
                  <span className="text-sm font-medium text-text">{s.title}</span>
                </div>
                <p className="text-sm text-text-secondary mb-2">{s.description}</p>
                {s.codeSnippet && <CodeBlock code={s.codeSnippet} language="kuery" maxHeight="200px" />}
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {result.evasionRisks?.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold text-text">Evasion Risks</h3></CardHeader>
          <CardBody className="space-y-3">
            {result.evasionRisks.map((e, i) => (
              <div key={i} className="bg-bg rounded-lg p-4 border border-border">
                <p className="text-sm font-medium text-warning mb-1">{e.technique}</p>
                <p className="text-sm text-text-secondary mb-2">{e.description}</p>
                <p className="text-sm text-success"><span className="font-medium">Mitigation:</span> {e.mitigation}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {result.mitreMappings?.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-lg font-semibold text-text">MITRE ATT&CK Mappings</h3></CardHeader>
          <CardBody className="space-y-2">
            {result.mitreMappings.map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-light px-4 py-2.5 rounded-lg border border-border">
                <div>
                  <span className="text-sm font-medium text-text">{m.tacticName}</span>
                  <span className="text-text-muted mx-2">→</span>
                  <span className="text-sm text-accent">{m.techniqueId}: {m.techniqueName}</span>
                  {m.subTechniqueName && <span className="text-sm text-text-muted ml-1">({m.subTechniqueName})</span>}
                </div>
                <span className="text-xs text-text-muted">{m.confidence}%</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TabEnhanceResults({ result, ruleId }: { result: EnhanceResult & { inputQuery?: string }; ruleId?: string }) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [analyzingPost, setAnalyzingPost] = useState(false);
  const [postAnalysisResult, setPostAnalysisResult] = useState<AnalyzeResult | null>(null);
  const { addToast } = useToastStore();

  const handleApply = async () => {
    if (!ruleId) return;
    setApplying(true);
    try {
      const res = await fetch(`/api/rules/${ruleId}/apply-enhancement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enhancedTitle: result.enhancedTitle,
          enhancedDescription: result.enhancedDescription,
          enhancedQuery: result.enhancedQuery,
          newSeverity: result.newSeverity,
          newRiskScore: result.newRiskScore,
          investigationGuide: result.investigationGuide,
          falsePositives: result.falsePositives,
          references: result.references,
          indexPatterns: result.indexPatterns,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("success", `Applied to rule — saved as "${data.title}"`);
        setApplied(true);
      } else {
        addToast("error", data.error || "Failed to apply enhancement");
      }
    } catch {
      addToast("error", "Failed to apply enhancement");
    } finally {
      setApplying(false);
    }
  };

  const handlePostEnhanceAnalysis = async () => {
    if (!ruleId) return;
    setAnalyzingPost(true);
    try {
      const res = await fetch("/api/analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId, postEnhancement: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostAnalysisResult(data.analysis);
        addToast("success", `Post-enhancement score: ${data.analysis.score}/100`);
      } else {
        addToast("error", data.error || "Post-enhancement analysis failed");
      }
    } catch {
      addToast("error", "Post-enhancement analysis failed");
    } finally {
      setAnalyzingPost(false);
    }
  };

  return (
    <div className="space-y-6">
      {ruleId && (
        <div className="flex gap-3">
          <Button onClick={handleApply} loading={applying} disabled={applied} variant="success" className="flex-1 gap-2">
            {applied ? "Applied to Rule" : "Apply to Rule"}
          </Button>
          <Button
            onClick={handlePostEnhanceAnalysis}
            loading={analyzingPost}
            disabled={!!postAnalysisResult}
            variant="primary"
            className="flex-1 gap-2"
          >
            {postAnalysisResult ? `Score: ${postAnalysisResult.score}/100` : "Analyze After Enhancement"}
          </Button>
        </div>
      )}

      {result.enhancedTitle && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Enhanced Metadata</h3></CardHeader>
          <CardBody className="space-y-2">
            <p className="text-sm"><span className="text-text-muted">Title:</span> <span className="text-text">{result.enhancedTitle}</span></p>
            {result.enhancedDescription && <p className="text-sm"><span className="text-text-muted">Description:</span> <span className="text-text">{result.enhancedDescription}</span></p>}
            <div className="flex gap-4">
              <p className="text-sm"><span className="text-text-muted">Severity:</span> <Badge preset={result.newSeverity as "low" | "medium" | "high" | "critical"} /></p>
              <p className="text-sm"><span className="text-text-muted">Risk Score:</span> <span className="text-text font-bold">{result.newRiskScore}</span></p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {result.inputQuery && (
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Original Query</h3>
            <CodeBlock code={result.inputQuery} language="kuery" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-medium text-success mb-2">Enhanced Query</h3>
          <CodeBlock code={result.enhancedQuery} language="kuery" />
        </div>
      </div>

      {result.changelog?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Changelog</h3></CardHeader>
          <CardBody className="space-y-2">
            {result.changelog.map((c, i) => (
              <div key={i} className="flex gap-2 text-sm">
                <span className="text-primary shrink-0">•</span>
                <div>
                  <span className="text-text font-medium">{c.change}</span>
                  <span className="text-text-muted ml-2">— {c.reason}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {result.investigationGuide && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Investigation Guide</h3></CardHeader>
          <CardBody><p className="text-sm text-text-secondary whitespace-pre-wrap">{result.investigationGuide}</p></CardBody>
        </Card>
      )}

      {postAnalysisResult && (
        <Card>
          <CardHeader><h3 className="font-semibold text-success">Analysis After Enhancement</h3></CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center gap-5">
              <ScoreGauge score={postAnalysisResult.score} size={80} label="Score" />
              {postAnalysisResult.rating && <Badge preset={postAnalysisResult.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{postAnalysisResult.rating}</Badge>}
            </div>
            {postAnalysisResult.feedback && (
              <div>
                <p className="text-xs font-semibold text-text-muted mb-1.5">Assessment</p>
                <p className="text-sm text-text-secondary whitespace-pre-wrap">{postAnalysisResult.feedback}</p>
              </div>
            )}
            {(postAnalysisResult.strengths?.length > 0 || postAnalysisResult.weaknesses?.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {postAnalysisResult.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-success mb-1.5">Strengths</p>
                    <ul className="space-y-1">
                      {postAnalysisResult.strengths.map((s: string, i: number) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-success shrink-0">&#10003;</span>{s}</li>)}
                    </ul>
                  </div>
                )}
                {postAnalysisResult.weaknesses?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-danger mb-1.5">Remaining Weaknesses</p>
                    <ul className="space-y-1">
                      {postAnalysisResult.weaknesses.map((w: string, i: number) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-danger shrink-0">&#10007;</span>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TabGenerateResults({ result }: { result: GenerateResult }) {
  const [saving, setSaving] = useState(false);
  const { addToast } = useToastStore();

  const handleSaveAsRule = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/analysis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: result.description || result.title, saveAsRule: true }),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Failed to save"); return; }
      addToast("success", "Rule saved successfully");
      if (data.savedRuleId) window.location.href = `/dashboard/rules/${data.savedRuleId}`;
    } catch { addToast("error", "Failed to save rule"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ScoreGauge score={result.score} size={60} />
          <div>
            <h3 className="text-lg font-semibold text-text">{result.title}</h3>
            <p className="text-sm text-text-secondary">{result.description}</p>
          </div>
        </div>
        <Button onClick={handleSaveAsRule} loading={saving} variant="success">Save as Rule</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardBody><p className="text-xs text-text-muted">Type</p><p className="text-sm text-text">{result.ruleType}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-text-muted">Severity</p><Badge preset={result.severity as "low" | "medium" | "high" | "critical"} /></CardBody></Card>
        <Card><CardBody><p className="text-xs text-text-muted">Language</p><p className="text-sm text-text">{result.language}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-text-muted">Risk Score</p><p className="text-sm text-text font-bold">{result.riskScore}</p></CardBody></Card>
      </div>

      <CodeBlock code={result.query} language={result.language} />

      {result.notes && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Notes</h3></CardHeader>
          <CardBody><p className="text-sm text-text-secondary">{result.notes}</p></CardBody>
        </Card>
      )}

      {result.mitreMappings?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">MITRE ATT&CK</h3></CardHeader>
          <CardBody className="space-y-2">
            {result.mitreMappings.map((m, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-text">{m.tacticName}</span>
                <span className="text-text-muted">→</span>
                <span className="text-accent">{m.techniqueId}: {m.techniqueName}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function TabFeedbackResults({ result }: { result: FeedbackResult }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-6">
        <ScoreGauge score={result.score} size={100} label="Quality Score" />
        <div className="flex items-center gap-2">
          <Badge preset={result.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{result.rating}</Badge>
          <Badge preset={
            result.verdict === "production_ready" ? "production" :
            result.verdict === "needs_tuning" ? "reviewed" :
            result.verdict === "needs_rework" ? "high" : "critical"
          }>{result.verdict?.replace(/_/g, " ")}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold text-text">Feedback</h3></CardHeader>
        <CardBody><p className="text-sm text-text-secondary whitespace-pre-wrap">{result.feedback}</p></CardBody>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.topIssues?.length > 0 && (
          <Card>
            <CardHeader><h3 className="font-semibold text-danger">Top Issues</h3></CardHeader>
            <CardBody>
              <ol className="space-y-1 list-decimal list-inside">
                {result.topIssues.map((issue, i) => <li key={i} className="text-sm text-text-secondary">{issue}</li>)}
              </ol>
            </CardBody>
          </Card>
        )}
        {result.quickFixes?.length > 0 && (
          <Card>
            <CardHeader><h3 className="font-semibold text-success">Quick Fixes</h3></CardHeader>
            <CardBody>
              <ol className="space-y-1 list-decimal list-inside">
                {result.quickFixes.map((fix, i) => <li key={i} className="text-sm text-text-secondary">{fix}</li>)}
              </ol>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

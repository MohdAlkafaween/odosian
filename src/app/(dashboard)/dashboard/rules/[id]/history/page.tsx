"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { PageLoader } from "@/components/ui/loading";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { DeploymentList } from "@/components/deployment-list";
import { useOpenAnalysisTab } from "@/hooks/use-open-analysis-tab";
import { useOpenPageTab } from "@/hooks/use-open-page-tab";

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

export default function RuleAnalysisHistoryPage() {
  const params = useParams();
  const openAnalysisTab = useOpenAnalysisTab();
  const { openRule } = useOpenPageTab();
  const [ruleTitle, setRuleTitle] = useState("");
  const [ruleLanguage, setRuleLanguage] = useState("kuery");
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    fetch(`/api/rules/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.rule) {
          setRuleTitle(d.rule.title);
          setRuleLanguage(d.rule.language);
        }
      })
      .catch(() => {});

    fetch(`/api/analysis?ruleId=${params.id}&limit=50&sortDir=desc`)
      .then((r) => r.json())
      .then((d) => {
        setAnalyses(d.analyses || []);
        if (d.analyses?.length > 0) setExpandedAnalysis(d.analyses[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-5xl">
      <button
        onClick={() => openRule(params.id as string, ruleTitle)}
        className="text-sm text-text-secondary hover:text-primary mb-4 inline-block"
      >
        ← Back to Rule
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">AI Analysis History</h1>
          {ruleTitle && <p className="text-sm text-text-muted mt-1">{ruleTitle}</p>}
        </div>
        <span className="text-xs text-text-muted">{analyses.length} record{analyses.length !== 1 ? "s" : ""}</span>
      </div>

      {analyses.length === 0 ? (
        <p className="text-text-muted">No AI activity on this rule yet.</p>
      ) : (
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
                                    {s.codeSnippet && <CodeBlock code={s.codeSnippet} language={ruleLanguage} maxHeight="150px" />}
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
                                <CodeBlock code={a.inputQuery} language={ruleLanguage} maxHeight="250px" />
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold text-success mb-1">After Enhancement</p>
                                <CodeBlock code={a.outputQuery} language={ruleLanguage} maxHeight="250px" />
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
                            <CodeBlock code={a.outputQuery} language={ruleLanguage} maxHeight="250px" />
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
                      <button
                        onClick={() => openAnalysisTab(a.id, a.analysisType, params.id as string, ruleTitle)}
                        className="ml-auto text-primary hover:underline text-[11px]"
                      >
                        View Full Details &rarr;
                      </button>
                    </div>
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold text-text mb-3">Deployments to Elastic</h2>
        <DeploymentList ruleId={params.id as string} />
      </div>
    </div>
  );
}

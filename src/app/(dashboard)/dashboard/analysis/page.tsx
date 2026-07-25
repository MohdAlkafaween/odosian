"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Spinner } from "@/components/ui/loading";
import { useToastStore } from "@/stores/toast";
import type { AnalyzeResult, EnhanceResult, GenerateResult, FeedbackResult } from "@/lib/ai";

type ToastFn = (type: "success" | "error" | "info" | "warning", msg: string) => void;

interface RuleOption {
  id: string;
  title: string;
  severity: string;
  language: string;
  status: string;
  ruleType: string;
  tags: string;
  mitreMappings?: { tacticName: string }[];
}

function AnalysisContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToastStore();
  const defaultTab = searchParams.get("tab") || "analyze";
  const preselectedRuleId = searchParams.get("ruleId") || "";

  const [rules, setRules] = useState<RuleOption[]>([]);

  useEffect(() => {
    fetch("/api/rules?limit=100")
      .then((r) => r.json())
      .then((d) => setRules((d.rules || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        title: r.title as string,
        severity: r.severity as string,
        language: r.language as string,
        status: r.status as string,
        ruleType: r.ruleType as string,
        tags: r.tags as string,
        mitreMappings: r.mitreMappings as { tacticName: string }[] | undefined,
      }))))
      .catch(() => {});
  }, []);

  const tabs = [
    { id: "analyze", label: "Analyze Rule" },
    { id: "enhance", label: "Enhance Rule" },
    { id: "generate", label: "Generate Rule" },
    { id: "feedback", label: "Quick Feedback" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-text">Shield Analysis Center</h1>
          <p className="text-sm text-text-muted mt-1">
            Analyze, enhance, and generate detection rules with AI
          </p>
        </div>
        <Link href="/dashboard/analysis/history">
          <Button variant="outline" size="sm">View History</Button>
        </Link>
      </div>

      <Tabs tabs={tabs} defaultTab={defaultTab}>
        {(activeTab) => (
          <>
            {activeTab === "analyze" && (
              <AnalyzeTab
                rules={rules}
                defaultRuleId={preselectedRuleId}
                addToast={addToast}
              />
            )}
            {activeTab === "enhance" && (
              <EnhanceTab rules={rules} addToast={addToast} />
            )}
            {activeTab === "generate" && (
              <GenerateTab addToast={addToast} router={router} />
            )}
            {activeTab === "feedback" && (
              <FeedbackTab addToast={addToast} />
            )}
          </>
        )}
      </Tabs>
    </div>
  );
}

function RuleSelector({ rules, selectedId, onSelect }: {
  rules: RuleOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(!selectedId);
  const [filters, setFilters] = useState<{ severity?: string; status?: string; language?: string }>({});
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const toggleFilter = (key: "severity" | "status" | "language", value: string) => {
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  };

  const clearFilters = () => setFilters({});

  const filtered = rules.filter((r) => {
    if (filters.severity && r.severity !== filters.severity) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.language && r.language !== filters.language) return false;
    if (search) {
      const s = search.toLowerCase();
      return r.title.toLowerCase().includes(s) || r.id.toLowerCase().includes(s);
    }
    return true;
  });

  const selected = rules.find((r) => r.id === selectedId);

  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

  const chipClass = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
      active
        ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_8px_rgba(76,189,250,0.15)]"
        : "bg-surface-light/50 text-text-muted border-border hover:border-primary/30 hover:text-text-secondary"
    }`;

  const severityDot: Record<string, string> = {
    critical: "bg-severity-critical",
    high: "bg-severity-high",
    medium: "bg-severity-medium",
    low: "bg-primary",
  };

  if (selected && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full group"
      >
        <div className="flex items-center gap-3 bg-bg border border-primary/30 rounded-xl px-4 py-3 hover:border-primary/50 transition-all">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-primary">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-text truncate">{selected.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${severityDot[selected.severity]}`} />
              <span className="text-xs text-text-muted capitalize">{selected.severity}</span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">{selected.language === "kuery" ? "KQL" : selected.language.toUpperCase()}</span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted capitalize">{selected.status}</span>
            </div>
          </div>
          <div className="shrink-0 text-text-muted group-hover:text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search with icon */}
      <div className="relative">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search rules..."
          className="w-full bg-bg border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted font-medium uppercase tracking-wider">Filter:</span>
        {(["critical", "high", "medium", "low"] as const).map((s) => (
          <button key={s} onClick={() => toggleFilter("severity", s)} className={chipClass(filters.severity === s)}>
            <span className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${severityDot[s]}`} />
              {s}
            </span>
          </button>
        ))}
        <span className="w-px h-4 bg-border mx-0.5" />
        {(["production", "reviewed", "draft"] as const).map((s) => (
          <button key={s} onClick={() => toggleFilter("status", s)} className={chipClass(filters.status === s)}>
            {s}
          </button>
        ))}
        <span className="w-px h-4 bg-border mx-0.5" />
        {(["kuery", "eql", "esql"] as const).map((s) => (
          <button key={s} onClick={() => toggleFilter("language", s)} className={chipClass(filters.language === s)}>
            {s === "kuery" ? "KQL" : s.toUpperCase()}
          </button>
        ))}
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-danger hover:text-danger-hover ml-1 transition-colors">
            Clear ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {filtered.length === rules.length ? `${rules.length} rules` : `${filtered.length} of ${rules.length} rules`}
        </p>
        {selected && (
          <button onClick={() => setExpanded(false)} className="text-xs text-primary hover:text-primary-hover transition-colors">
            Collapse
          </button>
        )}
      </div>

      {/* Rule list */}
      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
        {sorted.length === 0 && (
          <div className="text-center py-8">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-text-muted mb-2">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5z" />
            </svg>
            <p className="text-sm text-text-muted">No rules match your filters</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-primary mt-1 hover:text-primary-hover">Clear filters</button>
            )}
          </div>
        )}
        {sorted.map((rule) => {
          const isSelected = selectedId === rule.id;
          return (
            <button
              key={rule.id}
              onClick={() => { onSelect(rule.id); setExpanded(false); }}
              className={`w-full text-left rounded-xl transition-all border group ${
                isSelected
                  ? "bg-primary/8 border-primary/40 shadow-[0_0_12px_rgba(76,189,250,0.08)]"
                  : "bg-surface-light/40 border-border/60 hover:bg-surface-light hover:border-border"
              }`}
            >
              <div className="flex items-center gap-3 px-3.5 py-2.5">
                {/* Severity indicator bar */}
                <div className={`w-1 self-stretch rounded-full shrink-0 ${severityDot[rule.severity]} ${isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-70"} transition-opacity`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm leading-tight ${isSelected ? "text-primary font-semibold" : "text-text group-hover:text-text"}`}>
                    {rule.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge preset={rule.severity as "critical" | "high" | "medium" | "low"} />
                    <span className="text-[10px] text-text-muted font-mono uppercase">{rule.language === "kuery" ? "KQL" : rule.language.toUpperCase()}</span>
                    <span className="text-[10px] text-text-muted capitalize">{rule.status}</span>
                  </div>
                </div>
                {isSelected && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-primary shrink-0">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AnalyzeTab({ rules, defaultRuleId, addToast }: {
  rules: RuleOption[];
  defaultRuleId: string;
  addToast: ToastFn;
}) {
  const [ruleId, setRuleId] = useState(defaultRuleId);
  const [rawQuery, setRawQuery] = useState("");
  const [language, setLanguage] = useState("kuery");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [mode, setMode] = useState<"rule" | "query">(defaultRuleId ? "rule" : "rule");
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceResult, setEnhanceResult] = useState<EnhanceResult & { inputQuery?: string } | null>(null);

  const handleEnhanceDirect = useCallback(async () => {
    if (!ruleId) return;
    setEnhancing(true);
    setEnhanceResult(null);
    try {
      const res = await fetch("/api/analysis/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Enhancement failed"); return; }
      setEnhanceResult(data.analysis);
      addToast("success", "Rule enhanced");
    } catch { addToast("error", "Enhancement failed"); }
    finally { setEnhancing(false); }
  }, [ruleId, addToast]);

  const handleAnalyze = useCallback(async () => {
    if (mode === "rule" && !ruleId) { addToast("error", "Select a rule"); return; }
    if (mode === "query" && !rawQuery) { addToast("error", "Enter a query"); return; }

    setLoading(true);
    setResult(null);
    setEnhanceResult(null);
    try {
      const body = mode === "rule" ? { ruleId } : { query: rawQuery, language };
      const res = await fetch("/api/analysis/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Analysis failed"); return; }
      setResult(data.analysis);
    } catch { addToast("error", "Analysis failed"); }
    finally { setLoading(false); }
  }, [mode, ruleId, rawQuery, language, addToast]);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex gap-2 mb-2">
            <Button size="sm" variant={mode === "rule" ? "primary" : "ghost"} onClick={() => setMode("rule")}>Select Rule</Button>
            <Button size="sm" variant={mode === "query" ? "primary" : "ghost"} onClick={() => setMode("query")}>Raw Query</Button>
          </div>
          {mode === "rule" ? (
            <RuleSelector rules={rules} selectedId={ruleId} onSelect={setRuleId} />
          ) : (
            <>
              <Textarea label="Detection Query" value={rawQuery} onChange={(e) => setRawQuery(e.target.value)} rows={6} className="font-mono text-sm" placeholder="Enter your detection query..." />
              <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} options={[
                { value: "kuery", label: "KQL" }, { value: "eql", label: "EQL" },
                { value: "lucene", label: "Lucene" }, { value: "esql", label: "ES|QL" },
              ]} />
            </>
          )}
          <Button onClick={handleAnalyze} loading={loading} className="w-full gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
            {loading ? "Forging analysis..." : "Engage Shield Analysis"}
          </Button>
        </CardBody>
      </Card>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Spinner size="lg" />
          <p className="text-text-secondary text-sm">AI is analyzing the rule... This may take 10-30 seconds.</p>
        </div>
      )}

      {result && (
        <>
          <AnalyzeResults result={result} />

          {mode === "rule" && ruleId && !enhanceResult && (
            <Button onClick={handleEnhanceDirect} loading={enhancing} variant="success" className="w-full gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
              {enhancing ? "Enhancing..." : "Enhance This Rule Now"}
            </Button>
          )}

          {enhancing && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Spinner size="lg" />
              <p className="text-text-secondary text-sm">AI is enhancing the rule using these findings...</p>
            </div>
          )}

          {enhanceResult && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">Enhancement Results</h2>
                <Button size="sm" variant="outline" onClick={handleEnhanceDirect} loading={enhancing}>
                  Re-enhance
                </Button>
              </div>
              <EnhanceResults result={enhanceResult} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AnalyzeResults({ result }: { result: AnalyzeResult }) {
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

function EnhanceResults({ result }: { result: EnhanceResult & { inputQuery?: string } }) {
  return (
    <div className="space-y-6">
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
    </div>
  );
}

function EnhanceTab({ rules, addToast }: {
  rules: RuleOption[];
  addToast: ToastFn;
}) {
  const [ruleId, setRuleId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EnhanceResult & { inputQuery?: string } | null>(null);
  const [needsAnalysis, setNeedsAnalysis] = useState(false);

  const handleEnhance = async () => {
    if (!ruleId) { addToast("error", "Select a rule"); return; }
    setLoading(true);
    setResult(null);
    setNeedsAnalysis(false);
    try {
      const res = await fetch("/api/analysis/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.error?.includes("analyze the rule first")) {
          setNeedsAnalysis(true);
        } else {
          addToast("error", data.error || "Enhancement failed");
        }
        return;
      }
      setResult(data.analysis);
    } catch { addToast("error", "Enhancement failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <RuleSelector rules={rules} selectedId={ruleId} onSelect={(id) => { setRuleId(id); setNeedsAnalysis(false); }} />
          <p className="text-xs text-text-muted">The rule must have been analyzed first. Enhancement uses analysis findings to improve the rule.</p>
          {needsAnalysis && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
              <span className="text-warning text-lg shrink-0">!</span>
              <div>
                <p className="text-sm font-medium text-warning">Analysis Required</p>
                <p className="text-xs text-text-secondary mt-0.5">
                  This rule hasn&apos;t been analyzed yet. Go to the <strong>Analyze Rule</strong> tab and run an analysis first, then come back to enhance it.
                </p>
              </div>
            </div>
          )}
          <Button onClick={handleEnhance} loading={loading} className="w-full">
            {loading ? "Enhancing..." : "Enhance Rule"}
          </Button>
        </CardBody>
      </Card>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Spinner size="lg" />
          <p className="text-text-secondary text-sm">AI is enhancing the rule...</p>
        </div>
      )}

      {result && <EnhanceResults result={result} />}
    </div>
  );
}

function GenerateTab({ addToast, router }: {
  addToast: ToastFn;
  router: ReturnType<typeof useRouter>;
}) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);

  const handleGenerate = async () => {
    if (description.length < 10) { addToast("error", "Description must be at least 10 characters"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analysis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Generation failed"); return; }
      setResult(data.analysis);
    } catch { addToast("error", "Generation failed"); }
    finally { setLoading(false); }
  };

  const handleSaveAsRule = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/analysis/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, saveAsRule: true }),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Failed to save"); return; }
      addToast("success", "Rule saved successfully");
      if (data.savedRuleId) router.push(`/dashboard/rules/${data.savedRuleId}`);
    } catch { addToast("error", "Failed to save rule"); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <Textarea
            label="Threat Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Describe the threat behavior you want to detect. For example: 'Detect when a user runs encoded PowerShell commands that download and execute payloads from external URLs, commonly used in initial access and execution phases.'"
          />
          <Button onClick={handleGenerate} loading={loading} className="w-full">
            {loading ? "Generating..." : "Generate Rule"}
          </Button>
        </CardBody>
      </Card>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Spinner size="lg" />
          <p className="text-text-secondary text-sm">AI is generating a detection rule...</p>
        </div>
      )}

      {result && (
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
      )}
    </div>
  );
}

function FeedbackTab({ addToast }: { addToast: ToastFn }) {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("kuery");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeedbackResult | null>(null);

  const handleFeedback = async () => {
    if (!query) { addToast("error", "Enter a query"); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/analysis/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, language }),
      });
      const data = await res.json();
      if (!res.ok) { addToast("error", data.error || "Feedback failed"); return; }
      setResult(data.analysis);
    } catch { addToast("error", "Feedback failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <Textarea label="Detection Query" value={query} onChange={(e) => setQuery(e.target.value)} rows={6} className="font-mono text-sm" placeholder="Paste your detection query here for quick feedback..." />
          <Select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)} options={[
            { value: "kuery", label: "KQL" }, { value: "eql", label: "EQL" },
            { value: "lucene", label: "Lucene" }, { value: "esql", label: "ES|QL" },
          ]} />
          <Button onClick={handleFeedback} loading={loading} className="w-full">
            {loading ? "Getting Feedback..." : "Get Feedback"}
          </Button>
        </CardBody>
      </Card>

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Spinner size="lg" />
          <p className="text-text-secondary text-sm">AI is reviewing the query...</p>
        </div>
      )}

      {result && (
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
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<Spinner size="lg" />}>
      <AnalysisContent />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { ScoreGauge } from "@/components/ui/score-gauge";
import { Spinner } from "@/components/ui/loading";

interface AnalysisDetail {
  id: string;
  analysisType: string;
  inputQuery: string | null;
  outputQuery: string | null;
  score: number | null;
  rating: string | null;
  feedback: string | null;
  findings: Array<{ title: string; detail: string; severity: string; category: string }>;
  suggestions: Array<{ title: string; description: string; priority: number; codeSnippet?: string }>;
  strengths: string[];
  weaknesses: string[];
  evasionRisks: Array<{ technique: string; description: string; mitigation: string }>;
  mitreMappings: Array<{ tacticName: string; techniqueId: string; techniqueName: string; subTechniqueName?: string; confidence: number }>;
  modelUsed: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: string;
  user: { id: string; name: string } | null;
  rule: { id: string; title: string; query: string; language: string } | null;
}

const TYPE_LABELS: Record<string, string> = {
  analyze: "Full Analysis",
  enhance: "Rule Enhancement",
  generate: "Rule Generation",
  feedback: "Quick Feedback",
};

export default function AnalysisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analysis/${id}`)
      .then((r) => r.json())
      .then((d) => setAnalysis(d.analysis))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  if (!analysis) return <div className="text-center py-12 text-text-muted">Analysis not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[28px] font-extrabold text-text">{TYPE_LABELS[analysis.analysisType] || analysis.analysisType}</h1>
            <Badge preset="info">{analysis.analysisType}</Badge>
          </div>
          <p className="text-sm text-text-muted">
            {new Date(analysis.createdAt).toLocaleString()} · by {analysis.user?.name || "Unknown"}
          </p>
        </div>
        <div className="flex gap-2">
          {analysis.rule && (
            <Link href={`/dashboard/rules/${analysis.rule.id}`}>
              <Button variant="outline" size="sm">View Rule</Button>
            </Link>
          )}
          <Link href="/dashboard/analysis/history">
            <Button variant="ghost" size="sm">Back to History</Button>
          </Link>
        </div>
      </div>

      {analysis.rule && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Source Rule</h3></CardHeader>
          <CardBody>
            <p className="text-sm text-text mb-2">{analysis.rule.title}</p>
            <CodeBlock code={analysis.rule.query} language={analysis.rule.language} />
          </CardBody>
        </Card>
      )}

      {analysis.score !== null && (
        <div className="flex items-center gap-6">
          <ScoreGauge score={analysis.score} size={100} label="Quality Score" />
          <div className="flex items-center gap-2">
            {analysis.rating && <Badge preset={analysis.rating as "A+" | "A" | "B" | "C" | "D" | "F"}>{analysis.rating}</Badge>}
          </div>
        </div>
      )}

      {analysis.feedback && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Feedback</h3></CardHeader>
          <CardBody><p className="text-sm text-text-secondary whitespace-pre-wrap">{analysis.feedback}</p></CardBody>
        </Card>
      )}

      {analysis.inputQuery && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Input Query</h3></CardHeader>
          <CardBody><CodeBlock code={analysis.inputQuery} language="kuery" /></CardBody>
        </Card>
      )}

      {analysis.outputQuery && (
        <Card>
          <CardHeader><h3 className="font-semibold text-success">Enhanced / Generated Query</h3></CardHeader>
          <CardBody><CodeBlock code={analysis.outputQuery} language="kuery" /></CardBody>
        </Card>
      )}

      {(analysis.strengths?.length > 0 || analysis.weaknesses?.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analysis.strengths?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-success">Strengths</h3></CardHeader>
              <CardBody>
                <ul className="space-y-1">
                  {analysis.strengths.map((s, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-success shrink-0">✓</span>{s}</li>)}
                </ul>
              </CardBody>
            </Card>
          )}
          {analysis.weaknesses?.length > 0 && (
            <Card>
              <CardHeader><h3 className="font-semibold text-danger">Weaknesses</h3></CardHeader>
              <CardBody>
                <ul className="space-y-1">
                  {analysis.weaknesses.map((w, i) => <li key={i} className="text-sm text-text-secondary flex gap-2"><span className="text-danger shrink-0">✗</span>{w}</li>)}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {analysis.findings?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Findings ({analysis.findings.length})</h3></CardHeader>
          <CardBody className="space-y-3">
            {analysis.findings.map((f, i) => (
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

      {analysis.suggestions?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Suggestions</h3></CardHeader>
          <CardBody className="space-y-4">
            {analysis.suggestions.sort((a, b) => a.priority - b.priority).map((s, i) => (
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

      {analysis.evasionRisks?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">Evasion Risks</h3></CardHeader>
          <CardBody className="space-y-3">
            {analysis.evasionRisks.map((e, i) => (
              <div key={i} className="bg-bg rounded-lg p-4 border border-border">
                <p className="text-sm font-medium text-warning mb-1">{e.technique}</p>
                <p className="text-sm text-text-secondary mb-2">{e.description}</p>
                <p className="text-sm text-success"><span className="font-medium">Mitigation:</span> {e.mitigation}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {analysis.mitreMappings?.length > 0 && (
        <Card>
          <CardHeader><h3 className="font-semibold text-text">MITRE ATT&CK Mappings</h3></CardHeader>
          <CardBody className="space-y-2">
            {analysis.mitreMappings.map((m, i) => (
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

      <Card>
        <CardHeader><h3 className="font-semibold text-text">AI Metadata</h3></CardHeader>
        <CardBody>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-xs text-text-muted">Model</p><p className="text-sm text-text">{analysis.modelUsed || "—"}</p></div>
            <div><p className="text-xs text-text-muted">Tokens Used</p><p className="text-sm text-text">{analysis.tokensUsed?.toLocaleString() || "—"}</p></div>
            <div><p className="text-xs text-text-muted">Latency</p><p className="text-sm text-text">{analysis.latencyMs ? `${(analysis.latencyMs / 1000).toFixed(1)}s` : "—"}</p></div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

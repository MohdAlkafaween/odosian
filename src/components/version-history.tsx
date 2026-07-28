"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";
import { Badge } from "@/components/ui/badge";

interface RuleVersion {
  id: string;
  version: number;
  title: string;
  description: string;
  query: string;
  severity: string;
  riskScore: number;
  ruleType: string;
  language: string;
  index: string;
  tags: string[];
  status: string;
  interval: string;
  fromTime: string;
  maxSignals: number;
  investigationGuide: string;
  falsePositives: string[];
  references: string[];
  changedBy: string;
  changeNote: string;
  createdAt: string;
}

interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
}

function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const result: DiffLine[] = [];

  const max = Math.max(aLines.length, bLines.length);
  let ai = 0, bi = 0;
  while (ai < aLines.length || bi < bLines.length) {
    if (ai < aLines.length && bi < bLines.length) {
      if (aLines[ai] === bLines[bi]) {
        result.push({ type: "same", text: aLines[ai] });
        ai++;
        bi++;
      } else {
        let foundA = -1, foundB = -1;
        for (let k = bi + 1; k < Math.min(bi + 5, bLines.length); k++) {
          if (aLines[ai] === bLines[k]) { foundB = k; break; }
        }
        for (let k = ai + 1; k < Math.min(ai + 5, aLines.length); k++) {
          if (aLines[k] === bLines[bi]) { foundA = k; break; }
        }
        if (foundB >= 0 && (foundA < 0 || foundB - bi <= foundA - ai)) {
          while (bi < foundB) { result.push({ type: "add", text: bLines[bi] }); bi++; }
        } else if (foundA >= 0) {
          while (ai < foundA) { result.push({ type: "remove", text: aLines[ai] }); ai++; }
        } else {
          result.push({ type: "remove", text: aLines[ai] });
          result.push({ type: "add", text: bLines[bi] });
          ai++;
          bi++;
        }
      }
    } else if (ai < aLines.length) {
      result.push({ type: "remove", text: aLines[ai] });
      ai++;
    } else {
      result.push({ type: "add", text: bLines[bi] });
      bi++;
    }
  }
  return result;
}

interface CurrentRule {
  version: number;
  title: string;
  description: string;
  query: string;
  severity: string;
  riskScore: number;
  status: string;
  language: string;
}

export function VersionHistory({ ruleId, currentRule }: { ruleId: string; currentRule: CurrentRule }) {
  const [versions, setVersions] = useState<RuleVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [diffTarget, setDiffTarget] = useState<RuleVersion | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/rules/${ruleId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch { /* */ }
    finally { setLoading(false); }
  }, [ruleId]);

  useEffect(() => { fetchVersions(); }, [fetchVersions]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (versions.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Version History
        <span className="text-sm font-normal text-text-muted">({versions.length} version{versions.length !== 1 ? "s" : ""})</span>
      </h2>

      <div className="space-y-2">
        {versions.map((v) => (
          <Card key={v.id}>
            <button
              onClick={() => setExpanded(expanded === v.id ? null : v.id)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-light/50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                  v{v.version}
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-text">{v.title}</span>
                  <p className="text-[11px] text-text-muted">
                    {new Date(v.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge preset={v.severity as "low" | "medium" | "high" | "critical"} />
                <Badge preset={v.status as "draft" | "reviewed" | "production" | "deprecated"} />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); setDiffTarget(diffTarget?.id === v.id ? null : v); }}
                >
                  {diffTarget?.id === v.id ? "Close Diff" : "Compare"}
                </Button>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-text-muted transition-transform ${expanded === v.id ? "rotate-180" : ""}`}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </button>

            {expanded === v.id && (
              <CardBody className="pt-0">
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-text-muted text-xs">Severity</span><p className="text-text">{v.severity}</p></div>
                    <div><span className="text-text-muted text-xs">Risk Score</span><p className="text-text">{v.riskScore}</p></div>
                    <div><span className="text-text-muted text-xs">Status</span><p className="text-text">{v.status}</p></div>
                    <div><span className="text-text-muted text-xs">Language</span><p className="text-text">{v.language}</p></div>
                  </div>
                  {v.description && (
                    <div><span className="text-text-muted text-xs">Description</span><p className="text-sm text-text-secondary">{v.description}</p></div>
                  )}
                  <div>
                    <span className="text-text-muted text-xs">Detection Query</span>
                    <CodeBlock code={v.query} language={v.language} maxHeight="200px" />
                  </div>
                </div>
              </CardBody>
            )}
          </Card>
        ))}
      </div>

      {diffTarget && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text">
              Diff: v{diffTarget.version} → v{currentRule.version} (current)
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setDiffTarget(null)}>Close</Button>
          </div>
          <Card>
            <CardBody className="space-y-4">
              {diffTarget.title !== currentRule.title && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1">Title</p>
                  <p className="text-sm"><span className="bg-danger/20 text-danger line-through px-1 rounded">{diffTarget.title}</span> → <span className="bg-success/20 text-success px-1 rounded">{currentRule.title}</span></p>
                </div>
              )}
              {diffTarget.severity !== currentRule.severity && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1">Severity</p>
                  <p className="text-sm"><Badge preset={diffTarget.severity as "low" | "medium" | "high" | "critical"} /> → <Badge preset={currentRule.severity as "low" | "medium" | "high" | "critical"} /></p>
                </div>
              )}
              {diffTarget.status !== currentRule.status && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1">Status</p>
                  <p className="text-sm"><Badge preset={diffTarget.status as "draft" | "reviewed" | "production" | "deprecated"} /> → <Badge preset={currentRule.status as "draft" | "reviewed" | "production" | "deprecated"} /></p>
                </div>
              )}
              {diffTarget.query !== currentRule.query && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1">Query Changes</p>
                  <div className="bg-bg rounded-lg border border-border p-3 font-mono text-xs overflow-x-auto max-h-80 overflow-y-auto">
                    {diffLines(diffTarget.query, currentRule.query).map((line, i) => (
                      <div
                        key={i}
                        className={`px-2 py-0.5 whitespace-pre ${
                          line.type === "add" ? "bg-success/15 text-success" :
                          line.type === "remove" ? "bg-danger/15 text-danger" :
                          "text-text-secondary"
                        }`}
                      >
                        <span className="select-none mr-2 text-text-muted">
                          {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                        </span>
                        {line.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {diffTarget.query === currentRule.query && diffTarget.title === currentRule.title && diffTarget.severity === currentRule.severity && diffTarget.status === currentRule.status && (
                <p className="text-sm text-text-muted text-center py-4">No differences in key fields between these versions.</p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

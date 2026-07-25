"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loading";
import { DashboardCharts } from "@/components/dashboard-charts";
import { useAuthStore } from "@/stores/auth";

interface DashboardStats {
  stats: {
    totalRules: number;
    coveredRules: number;
    totalAnalyses: number;
    avgScore: number;
    criticalFindings: number;
  };
  recentActivity: Array<{
    id: string;
    analysisType: string;
    score: number;
    rating: string;
    createdAt: string;
    rule: { id: string; title: string } | null;
    user: { id: string; name: string } | null;
  }>;
  severityDistribution: Record<string, number>;
}

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Feedback",
};

function scoreColor(score: number) {
  if (score >= 80) return "#34D399";
  if (score >= 60) return "#4CBDFA";
  if (score >= 40) return "#FBBF24";
  return "#EF4444";
}

function ratingLabel(score: number) {
  if (score >= 80) return "STRONG";
  if (score >= 60) return "MODERATE";
  if (score >= 40) return "WEAK";
  return "CRITICAL";
}

function Odometer({ value, className, style }: { value: number; className?: string; style?: React.CSSProperties }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    const dur = 1200;
    const tick = (now: number) => {
      const t = Math.min((now - start) / dur, 1);
      const e = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * e));
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = value;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className={className} style={style}>{display}</span>;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;

  const stats = data?.stats;
  const sevColors: Record<string, string> = {
    critical: "#EF4444",
    high: "#F97316",
    medium: "#FBBF24",
    low: "#4CBDFA",
  };
  const totalFindings = Object.values(data?.severityDistribution || {}).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">Command Center</h1>
          <p className="text-[11px] text-text-muted mt-0.5 font-mono tracking-wide">DETECTION POSTURE OVERVIEW</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/rules/new">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors active:scale-[0.97]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
              New Rule
            </button>
          </Link>
          <Link href="/dashboard/analysis">
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-secondary text-xs font-medium hover:text-white hover:border-border-focus transition-colors active:scale-[0.97]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
              Analyze
            </button>
          </Link>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "ACTIVE RULES",
            value: stats?.totalRules ?? 0,
            color: "#4CBDFA",
            sub: stats?.totalRules
              ? `${Math.round(((stats.coveredRules ?? 0) / stats.totalRules) * 100)}% COVERED`
              : null,
          },
          {
            label: "ANALYSES",
            value: stats?.totalAnalyses ?? 0,
            color: "#A78BFA",
            sub: null,
          },
          {
            label: "AVG SCORE",
            value: stats?.avgScore ?? 0,
            color: scoreColor(stats?.avgScore || 0),
            sub: ratingLabel(stats?.avgScore || 0),
          },
          {
            label: "CRITICAL",
            value: stats?.criticalFindings ?? 0,
            color: (stats?.criticalFindings || 0) > 0 ? "#EF4444" : "#34D399",
            sub: (stats?.criticalFindings || 0) > 0 ? "NEEDS ATTENTION" : "CLEAR",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface/80 rounded-xl border border-border px-4 py-3"
          >
            <div className="text-[9px] text-text-muted font-mono tracking-[2px] mb-1.5">{card.label}</div>
            <div className="flex items-baseline gap-1.5">
              <Odometer
                value={card.value}
                className="font-mono text-2xl font-bold tabular-nums leading-none"
                style={{ color: card.color }}
              />
              {card.label === "AVG SCORE" && <span className="text-[11px] text-text-muted font-mono">/100</span>}
            </div>
            {card.sub && (
              <div className="text-[8px] font-mono tracking-widest mt-1" style={{ color: card.color, opacity: 0.7 }}>
                {card.sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <DashboardCharts />

      {/* Bottom Row: Severity + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">

        {/* Threat Severity */}
        <div className="lg:col-span-4 bg-surface/80 rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <span className="text-[11px] font-semibold uppercase tracking-[1.5px] font-mono text-text-secondary">Threat Severity</span>
            <span className="font-mono text-[10px] tabular-nums text-text-muted">{totalFindings} findings</span>
          </div>
          <div className="px-4 py-4 space-y-3">
            {(["critical", "high", "medium", "low"] as const).map((sev) => {
              const count = data?.severityDistribution?.[sev] || 0;
              const pct = totalFindings > 0 ? Math.round((count / totalFindings) * 100) : 0;
              const color = sevColors[sev];
              return (
                <div key={sev}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] text-text-secondary capitalize font-medium">{sev}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-text-muted tabular-nums">{pct}%</span>
                      <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color }}>{count}</span>
                    </div>
                  </div>
                  <div className="h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-8 bg-surface/80 rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] font-mono text-text-secondary">Recent Operations</span>
              <span className="font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                {data?.recentActivity?.length || 0}
              </span>
            </div>
            <Link href="/dashboard/analysis/history" className="text-[10px] font-semibold text-primary hover:text-primary-hover transition-colors uppercase tracking-wider">
              View All →
            </Link>
          </div>

          {data?.recentActivity?.length ? (
            <div className="divide-y divide-border">
              {data.recentActivity.map((a, idx) => {
                const sc = scoreColor(a.score);
                return (
                  <div
                    key={a.id}
                    className="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.015] cursor-pointer transition-colors group"
                    onClick={() => window.location.href = `/dashboard/analysis/${a.id}`}
                  >
                    <span className="font-mono text-[10px] text-text-muted tabular-nums w-5">{String(idx + 1).padStart(2, "0")}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-text-secondary group-hover:text-white transition-colors truncate">
                        {a.rule?.title || "Raw query analysis"}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {TYPE_LABELS[a.analysisType] || a.analysisType} · {new Date(a.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: sc }} />
                      </div>
                      <span className="font-mono text-[12px] font-bold tabular-nums w-6 text-right" style={{ color: sc }}>{a.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[12px] text-text-muted">No operations yet</p>
              <p className="text-[10px] text-text-muted mt-1">Run your first analysis to populate this feed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

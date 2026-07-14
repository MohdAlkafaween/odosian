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
  return "#FB7185";
}

function AnimateIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
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
  const totalSeverity = Object.values(data?.severityDistribution || {}).reduce((a, b) => a + b, 0) || 1;

  const sevColors: Record<string, string> = {
    critical: "#FB7185",
    high: "#F97316",
    medium: "#FBBF24",
    low: "#4CBDFA",
  };

  const statCards = [
    { label: "Detection Rules", value: stats?.totalRules ?? 0, color: "#4CBDFA" },
    { label: "Analyses Run", value: stats?.totalAnalyses ?? 0, color: "#A78BFA" },
    { label: "Avg Score", value: stats?.avgScore ?? 0, color: scoreColor(stats?.avgScore || 0), suffix: "/100" },
    { label: "Critical Findings", value: stats?.criticalFindings ?? 0, color: (stats?.criticalFindings || 0) > 0 ? "#FB7185" : "#34D399" },
  ];

  return (
    <div>
      {/* Header */}
      <AnimateIn delay={0}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Overview</h1>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/rules/new">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4CBDFA] text-white text-sm font-semibold hover:bg-[#3AAEF0] transition-colors duration-200 shadow-lg shadow-[#4CBDFA]/20 active:scale-[0.97]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                New Rule
              </button>
            </Link>
            <Link href="/dashboard/analysis">
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#111827]/80 text-[#8D99A8] text-sm font-medium hover:text-white transition-colors duration-200 active:scale-[0.97]" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.5"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
                Analyze
              </button>
            </Link>
          </div>
        </div>
      </AnimateIn>

      {/* Stat Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map((s, i) => (
          <AnimateIn key={s.label} delay={50 + i * 60}>
            <div className="bg-[#111827]/80 rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase mb-2">{s.label}</div>
              <div className="flex items-baseline gap-1">
                <span className="text-[26px] font-extrabold tabular-nums leading-none" style={{ color: s.color }}>{s.value}</span>
                {s.suffix && <span className="text-sm text-[#4E5D6E] font-medium">{s.suffix}</span>}
              </div>
            </div>
          </AnimateIn>
        ))}
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Activity Table */}
      <AnimateIn delay={650}>
        <div className="mt-6 bg-[#111827]/80 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[15px] font-semibold text-white">Recent Activity</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#4CBDFA]/10 text-[#4CBDFA] tabular-nums">
                {data?.recentActivity?.length || 0} operations
              </span>
            </div>
            <Link href="/dashboard/analysis/history" className="text-xs text-[#4CBDFA] hover:text-[#3AAEF0] font-medium transition-colors">
              View All →
            </Link>
          </div>

          {data?.recentActivity?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <th className="text-left px-6 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">#</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">Rule</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">Score</th>
                    <th className="text-left px-4 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">Date</th>
                    <th className="text-right px-6 py-3 text-[10px] text-[#4E5D6E] font-medium tracking-[1.5px] uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentActivity.map((a, idx) => {
                    const sc = scoreColor(a.score);
                    return (
                      <tr
                        key={a.id}
                        className="cursor-pointer group transition-colors duration-200 hover:bg-white/[0.015]"
                        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                        onClick={() => window.location.href = `/dashboard/analysis/${a.id}`}
                      >
                        <td className="px-6 py-4 text-sm text-[#4E5D6E] tabular-nums">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#4CBDFA]/8 flex items-center justify-center flex-shrink-0">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="#4CBDFA" opacity="0.7"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
                            </div>
                            <span className="text-sm font-medium text-[#D8DEE9] group-hover:text-white transition-colors">{a.rule?.title || "Raw query"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge preset="info">{TYPE_LABELS[a.analysisType] || a.analysisType}</Badge>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${a.score}%`, background: sc }} />
                            </div>
                            <span className="text-sm font-bold tabular-nums" style={{ color: sc }}>{a.score}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-[#4E5D6E] tabular-nums">{new Date(a.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-[11px] font-semibold px-3.5 py-1.5 rounded-lg bg-[#4CBDFA]/8 text-[#4CBDFA] group-hover:bg-[#4CBDFA]/15 transition-colors">
                            View
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="w-14 h-14 rounded-2xl bg-[#4CBDFA]/8 flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="#4CBDFA" opacity="0.3"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
              </div>
              <p className="text-sm text-[#8D99A8]">No operations yet</p>
              <p className="text-xs text-[#4E5D6E] mt-1">Run your first analysis to see activity here</p>
            </div>
          )}
        </div>
      </AnimateIn>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <AnimateIn delay={750}>
          <div className="bg-[#111827]/80 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="px-6 py-5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white">Threat Distribution</span>
              <span className="text-xs text-[#4E5D6E] tabular-nums">{totalSeverity} findings</span>
            </div>
            <div className="px-6 pb-5 space-y-4">
              {(["critical", "high", "medium", "low"] as const).map((sev) => {
                const count = data?.severityDistribution?.[sev] || 0;
                const pct = Math.round((count / totalSeverity) * 100);
                const color = sevColors[sev];
                return (
                  <div key={sev} className="flex items-center gap-4">
                    <div className="w-16">
                      <span className="text-xs text-[#8D99A8] capitalize">{sev}</span>
                    </div>
                    <div className="flex-1 h-[6px] bg-white/[0.03] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <div className="w-8 text-right">
                      <span className="text-sm font-bold tabular-nums" style={{ color }}>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </AnimateIn>

        <AnimateIn delay={850}>
          <div className="bg-[#111827]/80 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="px-6 py-5">
              <span className="text-[13px] font-semibold text-white">Quick Actions</span>
            </div>
            <div className="px-6 pb-5 grid grid-cols-2 gap-3">
              {[
                { href: "/dashboard/rules/new", label: "Forge Rule", icon: "M12 5v14M5 12h14", color: "#4CBDFA" },
                { href: "/dashboard/analysis", label: "Run Analysis", icon: "M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z", color: "#A78BFA", fill: true },
                { href: "/dashboard/templates", label: "Templates", icon: "M3 3h18v18H3zM3 9h18M9 21V9", color: "#34D399" },
                { href: "/dashboard/mitre", label: "MITRE Map", icon: "M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z", color: "#FBBF24" },
              ].map((item) => (
                <Link key={item.href} href={item.href}>
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#0B0F19]/50 transition-colors duration-200 cursor-pointer group active:scale-[0.97]" style={{ border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${item.color}0C` }}>
                      {item.fill ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={item.color} opacity="0.7"><path d={item.icon} /></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" opacity="0.7"><path d={item.icon} /></svg>
                      )}
                    </div>
                    <span className="text-sm text-[#8D99A8] group-hover:text-white transition-colors font-medium">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </AnimateIn>
      </div>
    </div>
  );
}

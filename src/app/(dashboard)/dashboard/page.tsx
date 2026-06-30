"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-danger",
  high: "bg-severity-high",
  medium: "bg-warning",
  low: "bg-primary",
};

function StatIcon({ type }: { type: string }) {
  const icons: Record<string, { bg: string; svg: React.ReactNode }> = {
    rules: {
      bg: "rgba(76,189,250,0.12)",
      svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="#4CBDFA"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>,
    },
    analyses: {
      bg: "rgba(132,226,158,0.12)",
      svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="#84E29E"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" /></svg>,
    },
    score: {
      bg: "rgba(110,209,202,0.12)",
      svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="#6ED1CA"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" /></svg>,
    },
    critical: {
      bg: "rgba(239,68,68,0.12)",
      svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF4444"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>,
    },
  };
  const icon = icons[type] || icons.rules;
  return (
    <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: icon.bg }}>
      {icon.svg}
    </div>
  );
}

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-warning";
  return "text-danger";
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

  return (
    <div>
      <h1 className="text-[28px] font-extrabold mb-1">Shield Command Center</h1>
      <p className="text-text-muted text-sm mb-7">Defense status overview</p>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <div className="bg-surface border border-border rounded-[10px] p-5 card-hover-glow relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-text-muted font-medium tracking-wider mb-2">TOTAL SHIELDS</div>
              <div className="text-3xl font-extrabold text-primary">{stats?.totalRules ?? 0}</div>
            </div>
            <StatIcon type="rules" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[10px] p-5 card-hover-glow relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-text-muted font-medium tracking-wider mb-2">ANALYSES RUN</div>
              <div className="text-3xl font-extrabold text-success">{stats?.totalAnalyses ?? 0}</div>
            </div>
            <StatIcon type="analyses" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[10px] p-5 card-hover-glow relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-text-muted font-medium tracking-wider mb-2">AVG SHIELD SCORE</div>
              <div className={`text-3xl font-extrabold ${scoreColor(stats?.avgScore || 0)}`}>{stats?.avgScore ?? 0}</div>
            </div>
            <StatIcon type="score" />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-[10px] p-5 card-hover-glow relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-text-muted font-medium tracking-wider mb-2">CRITICAL FINDINGS</div>
              <div className={`text-3xl font-extrabold ${(stats?.criticalFindings || 0) > 0 ? "text-danger" : "text-success"}`}>
                {stats?.criticalFindings ?? 0}
              </div>
            </div>
            <StatIcon type="critical" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <DashboardCharts />

      {/* Recent Operations + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-7">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold text-text">Recent Shield Operations</h2>
                <Link href="/dashboard/analysis/history">
                  <Button variant="ghost" size="sm">View All</Button>
                </Link>
              </div>
            </CardHeader>
            <CardBody>
              {data?.recentActivity?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2.5 text-xs text-text-muted font-medium tracking-wider border-b border-border">RULE</th>
                        <th className="text-left px-3 py-2.5 text-xs text-text-muted font-medium tracking-wider border-b border-border">TYPE</th>
                        <th className="text-left px-3 py-2.5 text-xs text-text-muted font-medium tracking-wider border-b border-border">SCORE</th>
                        <th className="text-left px-3 py-2.5 text-xs text-text-muted font-medium tracking-wider border-b border-border">DATE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentActivity.map((a) => (
                        <tr key={a.id} className="hover:bg-surface-light/50 transition-colors cursor-pointer" onClick={() => window.location.href = `/dashboard/analysis/${a.id}`}>
                          <td className="px-3 py-3 text-sm border-b border-border/50">{a.rule?.title || "Raw query"}</td>
                          <td className="px-3 py-3 border-b border-border/50">
                            <Badge preset="info">{TYPE_LABELS[a.analysisType] || a.analysisType}</Badge>
                          </td>
                          <td className={`px-3 py-3 text-sm font-semibold border-b border-border/50 ${scoreColor(a.score)}`}>{a.score}</td>
                          <td className="px-3 py-3 text-sm text-text-muted border-b border-border/50">{new Date(a.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-8">No shield operations yet. Run your first analysis to see activity here.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><h2 className="text-[15px] font-semibold text-text">Defense Deployment</h2></CardHeader>
            <CardBody>
              <div className="space-y-3.5">
                {(["critical", "high", "medium", "low"] as const).map((sev) => {
                  const count = data?.severityDistribution?.[sev] || 0;
                  const pct = Math.round((count / totalSeverity) * 100);
                  return (
                    <div key={sev}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-text-secondary capitalize">{sev}</span>
                        <span className="text-sm text-text-muted">{count}</span>
                      </div>
                      <div className="w-full bg-surface-light rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full ${SEVERITY_COLORS[sev]} transition-all duration-1000`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="text-[15px] font-semibold text-text">Quick Actions</h2></CardHeader>
            <CardBody className="space-y-2">
              <Link href="/dashboard/rules/new" className="block">
                <Button variant="primary" className="w-full justify-start gap-2">
                  <span className="text-base">+</span> Forge New Rule
                </Button>
              </Link>
              <Link href="/dashboard/analysis" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" /></svg>
                  Engage Shield Analysis
                </Button>
              </Link>
              <Link href="/dashboard/templates" className="block">
                <Button variant="ghost" className="w-full justify-start">Browse Templates</Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

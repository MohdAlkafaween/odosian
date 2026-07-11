"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart,
} from "recharts";

interface ChartData {
  scoreTrend: Array<{ date: string; avgScore: number; count: number }>;
  ruleTimeline: Array<{ date: string; count: number }>;
  analysisTypes: Array<{ type: string; count: number }>;
  rulesByLanguage: Array<{ language: string; count: number }>;
}

const PALETTE = {
  cyan: "#4CBDFA",
  teal: "#38BDF8",
  emerald: "#34D399",
  violet: "#A78BFA",
  amber: "#FBBF24",
  rose: "#FB7185",
  slate: "#94A3B8",
};

const PIE_COLORS = [PALETTE.cyan, PALETTE.violet, PALETTE.emerald, PALETTE.amber];

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Feedback",
};

const LANG_COLORS: Record<string, string> = {
  kuery: PALETTE.cyan,
  eql: PALETTE.violet,
  lucene: PALETTE.amber,
  esql: PALETTE.emerald,
};

function formatDate(d: unknown) {
  return new Date(String(d)).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 py-5">
        {children}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, labelFormatter }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; labelFormatter?: (v: unknown) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#0D1321] border border-border/80 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-text-muted mb-1">{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-xs text-text-secondary">{p.name}:</span>
          <span className="text-xs font-semibold text-text">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/charts")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasScoreData = data.scoreTrend.length > 0;
  const hasRuleData = data.ruleTimeline.length > 0;
  const hasTypeData = data.analysisTypes.length > 0;
  const hasLangData = data.rulesByLanguage.length > 0;

  if (!hasScoreData && !hasRuleData && !hasTypeData && !hasLangData) return null;

  const totalAnalyses = data.analysisTypes.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {hasScoreData && (
        <ChartCard title="Analysis Score Trend" subtitle="Average quality scores over 30 days">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data.scoreTrend}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.cyan} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={PALETTE.cyan} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D3D" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip content={<CustomTooltip labelFormatter={formatDate} />} />
              <Area type="monotone" dataKey="avgScore" stroke={PALETTE.cyan} strokeWidth={2.5} fill="url(#scoreGradient)" name="Avg Score" dot={{ r: 4, fill: PALETTE.cyan, strokeWidth: 0 }} activeDot={{ r: 6, fill: PALETTE.cyan, stroke: "#0B0F19", strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {hasRuleData && (
        <ChartCard title="Rules Created" subtitle="Detection rules added over 30 days">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.ruleTimeline} barCategoryGap="25%">
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.violet} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={PALETTE.violet} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D3D" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} width={25} />
              <Tooltip content={<CustomTooltip labelFormatter={formatDate} />} />
              <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Rules" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {hasTypeData && (
        <ChartCard title="Analysis Distribution" subtitle={`${totalAnalyses} total analyses by type`}>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="50%" height={220}>
              <PieChart>
                <Pie
                  data={data.analysisTypes.map((d) => ({ ...d, name: TYPE_LABELS[d.type] || d.type }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="count"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {data.analysisTypes.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {data.analysisTypes.map((d, i) => {
                const pct = totalAnalyses > 0 ? Math.round((d.count / totalAnalyses) * 100) : 0;
                return (
                  <div key={d.type}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-text-secondary">{TYPE_LABELS[d.type] || d.type}</span>
                      </div>
                      <span className="text-xs font-semibold text-text">{d.count}</span>
                    </div>
                    <div className="w-full bg-surface-light rounded-full h-1">
                      <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>
      )}

      {hasLangData && (
        <ChartCard title="Rules by Language" subtitle="Detection query language distribution">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.rulesByLanguage} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2D3D" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="language" type="category" tick={{ fill: "#94A3B8", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Rules">
                {data.rulesByLanguage.map((entry) => (
                  <Cell key={entry.language} fill={LANG_COLORS[entry.language] || PALETTE.slate} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

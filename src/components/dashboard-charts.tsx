"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";

interface ChartData {
  scoreTrend: Array<{ date: string; avgScore: number; count: number }>;
  ruleTimeline: Array<{ date: string; count: number }>;
  analysisTypes: Array<{ type: string; count: number }>;
  rulesByLanguage: Array<{ language: string; count: number }>;
  ruleStatusCounts: Record<string, number>;
  totalRules: number;
  mitreCoverage: {
    coveredTactics: number;
    coveredTechniques: number;
    totalMappings: number;
    tactics: Array<{ id: string; name: string; techniqueCount: number }>;
  };
}

const CYAN = "#4CBDFA";
const EMERALD = "#34D399";
const AMBER = "#FBBF24";
const ROSE = "#EF4444";
const ORANGE = "#F97316";
const VIOLET = "#A78BFA";

const STATUS_META: Record<string, { color: string; label: string }> = {
  production: { color: EMERALD, label: "Production" },
  reviewed: { color: CYAN, label: "Reviewed" },
  draft: { color: "#64748B", label: "Draft" },
  deprecated: { color: "#475569", label: "Deprecated" },
};

const SEVERITY_META: Record<string, { color: string }> = {
  critical: { color: ROSE },
  high: { color: ORANGE },
  medium: { color: AMBER },
  low: { color: CYAN },
};

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Feedback",
};

const ALL_TACTICS = [
  { id: "TA0043", name: "Reconnaissance", short: "RECON" },
  { id: "TA0042", name: "Resource Development", short: "RES DEV" },
  { id: "TA0001", name: "Initial Access", short: "ACCESS" },
  { id: "TA0002", name: "Execution", short: "EXEC" },
  { id: "TA0003", name: "Persistence", short: "PERSIST" },
  { id: "TA0004", name: "Privilege Escalation", short: "PRIV ESC" },
  { id: "TA0005", name: "Defense Evasion", short: "DEF EVAS" },
  { id: "TA0006", name: "Credential Access", short: "CRED" },
  { id: "TA0007", name: "Discovery", short: "DISCOV" },
  { id: "TA0008", name: "Lateral Movement", short: "LATERAL" },
  { id: "TA0009", name: "Collection", short: "COLLECT" },
  { id: "TA0011", name: "Command and Control", short: "C2" },
  { id: "TA0010", name: "Exfiltration", short: "EXFIL" },
  { id: "TA0040", name: "Impact", short: "IMPACT" },
];

/* ─── Animated number ─── */
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

/* ─── MITRE Kill Chain ─── */
function MitreKillChain({ mitreCoverage }: { mitreCoverage: ChartData["mitreCoverage"] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 200); return () => clearTimeout(t); }, []);

  if (!mitreCoverage?.tactics) return null;

  const tacticMap = new Map(mitreCoverage.tactics.map(t => [t.id, t]));
  const covered = mitreCoverage.coveredTactics;
  const total = ALL_TACTICS.length;
  const pct = Math.round((covered / total) * 100);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="1.5" opacity="0.7">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs font-semibold text-white tracking-wide">MITRE ATT&CK KILL CHAIN</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span className="font-mono text-[11px] tabular-nums" style={{ color: pct >= 50 ? EMERALD : pct >= 25 ? AMBER : ROSE }}>
            {covered}/{total} TACTICS
          </span>
        </div>
        <div className="flex items-center gap-4">
          {[
            { color: "rgba(255,255,255,0.06)", label: "No coverage", border: true },
            { color: `${AMBER}50`, label: "Partial" },
            { color: `${EMERALD}60`, label: "Covered" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ background: item.color, border: item.border ? "1px solid rgba(255,255,255,0.1)" : "none" }} />
              <span className="text-[10px] text-text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kill chain grid */}
      <div className="overflow-x-auto -mx-1">
        <div className="flex gap-[3px] min-w-[700px] px-1">
          {ALL_TACTICS.map((tactic, idx) => {
            const data = tacticMap.get(tactic.id);
            const count = data?.techniqueCount || 0;
            const intensity = count === 0 ? 0 : count >= 3 ? 2 : 1;
            const color = intensity === 0 ? "transparent" : intensity === 1 ? AMBER : EMERALD;
            const bgColor = intensity === 0
              ? "rgba(255,255,255,0.03)"
              : intensity === 1
                ? `${AMBER}20`
                : `${EMERALD}25`;

            return (
              <div
                key={tactic.id}
                className="flex-1 min-w-0"
                style={{
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateY(0)" : "translateY(8px)",
                  transition: `all 0.4s ease ${idx * 40}ms`,
                }}
              >
                {/* Tactic label */}
                <div className="text-center mb-1.5">
                  <div className="font-mono text-[7px] tracking-widest uppercase truncate" style={{ color: count > 0 ? "#8D99A8" : "#3A4555" }}>
                    {tactic.short}
                  </div>
                </div>

                {/* Cell */}
                <div
                  className="relative h-10 rounded flex items-center justify-center"
                  style={{
                    background: bgColor,
                    borderBottom: count > 0 ? `2px solid ${color}` : "2px solid transparent",
                    boxShadow: intensity === 2 ? `0 2px 12px ${EMERALD}15` : "none",
                  }}
                >
                  {count > 0 && (
                    <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color }}>
                      {count}
                    </span>
                  )}
                </div>

                {/* Connector arrow */}
                {idx < ALL_TACTICS.length - 1 && (
                  <div className="flex justify-center mt-1">
                    <div className="w-px h-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer stats */}
      {mitreCoverage.totalMappings > 0 && (
        <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: CYAN }}>{mitreCoverage.coveredTechniques}</span>
              <span className="text-[10px] text-text-muted">techniques</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: VIOLET }}>{mitreCoverage.totalMappings}</span>
              <span className="text-[10px] text-text-muted">rule mappings</span>
            </div>
          </div>
          <Link href="/dashboard/mitre" className="text-[10px] font-semibold text-primary hover:text-primary-hover transition-colors uppercase tracking-wider">
            Full Matrix →
          </Link>
        </div>
      )}
    </div>
  );
}

/* ─── Score Sparkline (Canvas) ─── */
function ScoreSparkline({ data }: { data: Array<{ date: string; avgScore: number; count: number }> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !mounted || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const scores = data.map(d => d.avgScore);
    const min = Math.min(...scores) - 5;
    const max = Math.max(...scores) + 5;
    const range = max - min || 1;

    const pad = { top: 4, bottom: 4, left: 0, right: 0 };
    const graphW = W - pad.left - pad.right;
    const graphH = H - pad.top - pad.bottom;

    const points = scores.map((s, i) => ({
      x: pad.left + (i / (scores.length - 1)) * graphW,
      y: pad.top + (1 - (s - min) / range) * graphH,
    }));

    // Area fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `${CYAN}25`);
    grad.addColorStop(1, `${CYAN}02`);

    ctx.beginPath();
    ctx.moveTo(points[0].x, H);
    ctx.lineTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      ctx.bezierCurveTo(cx, points[i - 1].y, cx, points[i].y, points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      ctx.bezierCurveTo(cx, points[i - 1].y, cx, points[i].y, points[i].x, points[i].y);
    }
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // End dot
    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = CYAN;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = `${CYAN}20`;
    ctx.fill();
  }, [data, mounted]);

  if (data.length < 2) {
    return <div className="h-full flex items-center justify-center text-[10px] text-text-muted">Insufficient data</div>;
  }

  return <canvas ref={canvasRef} className="w-full h-full" />;
}

/* ─── Detection Pipeline ─── */
function DetectionPipeline({ statusCounts, totalRules }: { statusCounts: Record<string, number>; totalRules: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);

  const stages = ["draft", "reviewed", "production", "deprecated"];
  const max = Math.max(...stages.map(s => statusCounts[s] || 0), 1);

  return (
    <div className="space-y-3">
      {stages.map((status, i) => {
        const count = statusCounts[status] || 0;
        const meta = STATUS_META[status];
        const pct = (count / max) * 100;

        return (
          <div key={status} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                <span className="text-[11px] text-text-secondary font-medium">{meta.label}</span>
              </div>
              <span
                className="font-mono text-[12px] font-bold tabular-nums"
                style={{ color: meta.color }}
              >
                {mounted ? count : 0}
              </span>
            </div>
            <div className="h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: mounted ? `${pct}%` : "0%",
                  background: meta.color,
                  transition: `width 1s cubic-bezier(0.16,1,0.3,1) ${i * 100}ms`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Language Breakdown ─── */
function LanguageBreakdown({ data, total }: { data: Array<{ language: string; count: number }>; total: number }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  const langColors: Record<string, string> = { kuery: CYAN, eql: VIOLET, lucene: AMBER, esql: EMERALD };

  return (
    <div className="space-y-2.5">
      {sorted.map((entry) => {
        const color = langColors[entry.language] || "#64748B";
        const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
        return (
          <div key={entry.language} className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-wider w-12 text-text-muted">{entry.language}</span>
            <div className="flex-1 h-[3px] rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: "width 1s ease" }} />
            </div>
            <span className="font-mono text-[11px] font-bold tabular-nums w-6 text-right" style={{ color }}>{entry.count}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Panel ─── */
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface/80 rounded-xl border border-border overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ title, mono, right }: { title: string; mono?: boolean; right?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between border-b border-border">
      <span className={`text-[11px] font-semibold uppercase tracking-[1.5px] ${mono ? "font-mono" : ""} text-text-secondary`}>{title}</span>
      {right}
    </div>
  );
}


/* ─── Main Export ─── */
export function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/charts")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const totalRules = data.totalRules;
  const totalAnalyses = data.analysisTypes.reduce((s, d) => s + d.count, 0);
  const latestScore = data.scoreTrend.length > 0 ? data.scoreTrend[data.scoreTrend.length - 1].avgScore : 0;
  const productionRules = data.ruleStatusCounts?.production || 0;
  const mitrePct = data.mitreCoverage ? Math.round((data.mitreCoverage.coveredTactics / ALL_TACTICS.length) * 100) : 0;

  return (
    <div className="space-y-4">

      {/* ─── Row 1: MITRE Kill Chain (hero) ─── */}
      <Panel>
        <div className="px-5 py-5">
          <MitreKillChain mitreCoverage={data.mitreCoverage} />
        </div>
      </Panel>

      {/* ─── Row 2: Score trend + Pipeline + Languages ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Score trend */}
        <Panel className="lg:col-span-5">
          <PanelHeader title="Detection Score" mono right={
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold tabular-nums" style={{ color: latestScore >= 70 ? EMERALD : latestScore >= 50 ? AMBER : ROSE }}>
                {latestScore}
              </span>
              <span className="text-[10px] text-text-muted">/100</span>
            </div>
          } />
          <div className="px-4 py-3 h-[100px]">
            <ScoreSparkline data={data.scoreTrend} />
          </div>
          <div className="px-4 pb-3 flex items-center justify-between">
            <span className="text-[10px] text-text-muted">30-day trend</span>
            <div className="flex items-center gap-1">
              {data.scoreTrend.length >= 2 && (() => {
                const first = data.scoreTrend[0].avgScore;
                const last = data.scoreTrend[data.scoreTrend.length - 1].avgScore;
                const delta = last - first;
                const color = delta >= 0 ? EMERALD : ROSE;
                return (
                  <>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill={color}>
                      {delta >= 0
                        ? <path d="M5 2L8 6H2L5 2Z" />
                        : <path d="M5 8L2 4H8L5 8Z" />
                      }
                    </svg>
                    <span className="font-mono text-[10px] font-bold tabular-nums" style={{ color }}>
                      {delta >= 0 ? "+" : ""}{delta}
                    </span>
                  </>
                );
              })()}
            </div>
          </div>
        </Panel>

        {/* Detection Pipeline */}
        <Panel className="lg:col-span-4">
          <PanelHeader title="Detection Pipeline" mono right={
            <span className="font-mono text-[10px] tabular-nums text-text-muted">{totalRules} total</span>
          } />
          <div className="px-4 py-4">
            <DetectionPipeline statusCounts={data.ruleStatusCounts} totalRules={totalRules} />
          </div>
        </Panel>

        {/* Language + Operations */}
        <Panel className="lg:col-span-3">
          <PanelHeader title="Languages" mono />
          <div className="px-4 py-4">
            <LanguageBreakdown data={data.rulesByLanguage} total={totalRules} />
          </div>
          <div className="border-t border-border px-4 py-3">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">Operations</div>
            <div className="space-y-1.5">
              {data.analysisTypes.map((d) => (
                <div key={d.type} className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">{TYPE_LABELS[d.type] || d.type}</span>
                  <span className="font-mono text-[11px] font-bold tabular-nums text-text-secondary">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";

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
const VIOLET = "#A78BFA";
const EMERALD = "#34D399";
const AMBER = "#FBBF24";
const ROSE = "#FB7185";

const TYPE_LABELS: Record<string, string> = {
  analyze: "Analysis",
  enhance: "Enhancement",
  generate: "Generation",
  feedback: "Feedback",
};

const LANG_COLORS: Record<string, string> = {
  kuery: CYAN,
  eql: VIOLET,
  lucene: AMBER,
  esql: EMERALD,
};

function AnimateIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0) scale(1)" : "translateY(18px) scale(0.97)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
      {children}
    </div>
  );
}

/* ─── #16 Streaming Counter ─── */
function StreamingCounter({ value, color, label }: { value: number; color: string; label: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const duration = 1800;
    const start = performance.now();
    const from = ref.current;
    const animate = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (value - from) * eased);
      setDisplay(current);
      if (t < 1) requestAnimationFrame(animate);
      else ref.current = value;
    };
    requestAnimationFrame(animate);
  }, [value]);

  const digits = String(display).split("");

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-[2px]">
        {digits.map((d, i) => (
          <span
            key={i}
            className="inline-block text-[28px] font-extrabold tabular-nums leading-none"
            style={{
              color,
              textShadow: `0 0 20px ${color}60, 0 0 40px ${color}30`,
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            }}
          >
            {d}
          </span>
        ))}
      </div>
      <span className="text-[9px] text-[#4E5D6E] uppercase tracking-[2px] font-semibold">{label}</span>
    </div>
  );
}

/* ─── #22 Concentric Activity Rings ─── */
function ActivityRings({ data }: { data: Array<{ type: string; count: number }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 400); return () => clearTimeout(t); }, []);

  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const colors = [CYAN, VIOLET, EMERALD, AMBER];
  const rings = data.slice(0, 4).map((d, i) => ({
    ...d,
    pct: Math.round((d.count / total) * 100),
    color: colors[i],
    r: 52 - i * 13,
  }));

  return (
    <div className="relative flex items-center justify-center" style={{ height: 180 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          {rings.map((ring, i) => (
            <filter key={i} id={`ringGlow${i}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const filled = (ring.pct / 100) * circ;
          return (
            <g key={i}>
              <circle cx="70" cy="70" r={ring.r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
              <circle
                cx="70" cy="70" r={ring.r} fill="none"
                stroke={ring.color} strokeWidth="7"
                strokeDasharray={`${circ}`}
                strokeDashoffset={mounted ? circ - filled : circ}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
                filter={`url(#ringGlow${i})`}
                style={{ transition: `stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1) ${0.2 + i * 0.15}s` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-extrabold text-white tabular-nums leading-none">{total}</div>
          <div className="text-[9px] text-[#4E5D6E] uppercase tracking-[1.5px] mt-1">Total Ops</div>
        </div>
      </div>
    </div>
  );
}

/* ─── #28 Shield Coverage Gauge ─── */
function ShieldGauge({ value, total, color }: { value: number; total: number; color: string; label: string }) {
  const [mounted, setMounted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 400); return () => clearTimeout(t); }, []);

  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = 200;
    const H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const shieldPath = (cx: number, cy: number, scale: number) => {
      const p = new Path2D();
      const s = scale;
      p.moveTo(cx, cy - 48 * s);
      p.lineTo(cx + 40 * s, cy - 32 * s);
      p.lineTo(cx + 40 * s, cy - 4 * s);
      p.bezierCurveTo(cx + 40 * s, cy + 20 * s, cx + 24 * s, cy + 40 * s, cx, cy + 52 * s);
      p.bezierCurveTo(cx - 24 * s, cy + 40 * s, cx - 40 * s, cy + 20 * s, cx - 40 * s, cy - 4 * s);
      p.lineTo(cx - 40 * s, cy - 32 * s);
      p.closePath();
      return p;
    };

    let startTime = 0;
    let currentFill = 0;

    const draw = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / 1600, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      currentFill = mounted ? eased * pct : 0;

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2 + 2;

      const outer = shieldPath(cx, cy, 1);
      ctx.save();
      ctx.strokeStyle = `${color}18`;
      ctx.lineWidth = 1;
      ctx.stroke(outer);
      ctx.restore();

      ctx.save();
      ctx.clip(outer);
      const fillY = cy + 52 - (currentFill / 100) * 100;
      const grad = ctx.createLinearGradient(0, fillY + 60, 0, fillY - 10);
      grad.addColorStop(0, `${color}50`);
      grad.addColorStop(1, `${color}12`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, fillY, W, H);

      const t = elapsed * 0.002;
      ctx.beginPath();
      ctx.moveTo(0, fillY);
      for (let x = 0; x <= W; x += 2) {
        const y = fillY + Math.sin(x * 0.06 + t) * 2.5 + Math.sin(x * 0.03 + t * 0.7) * 1.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      const waveGrad = ctx.createLinearGradient(0, fillY + 40, 0, fillY - 5);
      waveGrad.addColorStop(0, `${color}60`);
      waveGrad.addColorStop(1, `${color}18`);
      ctx.fillStyle = waveGrad;
      ctx.fill();
      ctx.restore();

      const inner = shieldPath(cx, cy, 1);
      ctx.save();
      ctx.strokeStyle = `${color}30`;
      ctx.lineWidth = 2;
      ctx.stroke(inner);
      ctx.restore();

      const pulse = 0.5 + Math.sin(elapsed * 0.003) * 0.2;
      const miniShield = shieldPath(cx, cy - 6, 0.42);
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.5;
      ctx.stroke(miniShield);
      ctx.globalAlpha = pulse * 0.15;
      ctx.fillStyle = color;
      ctx.fill(miniShield);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 7, cy - 4);
      ctx.lineTo(cx - 1.5, cy + 2.5);
      ctx.lineTo(cx + 9, cy - 8);
      ctx.stroke();
      ctx.restore();

      const glowPulse = 0.08 + Math.sin(elapsed * 0.002) * 0.04;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = color;
      ctx.globalAlpha = glowPulse;
      ctx.lineWidth = 3;
      ctx.stroke(outer);
      ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    if (mounted) animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [mounted, pct, color]);

  return (
    <div className="flex items-center gap-5">
      <canvas
        ref={canvasRef}
        style={{ width: 120, height: 120 }}
      />
      <div className="flex flex-col gap-1.5">
        <div className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color, fontFamily: "'JetBrains Mono', 'Courier New', monospace", textShadow: `0 0 16px ${color}40` }}>
          {mounted ? pct : 0}<span className="text-[16px] opacity-60">%</span>
        </div>
        <span className="text-[10px] text-[#4E5D6E] uppercase tracking-[2px] font-semibold">Coverage</span>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="w-[50px] h-[3px] rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: mounted ? `${pct}%` : "0%", background: color, transition: "width 1.6s cubic-bezier(0.16,1,0.3,1)" }} />
          </div>
          <span className="text-[8px] text-[#3A4555] tabular-nums">{pct}/100</span>
        </div>
      </div>
    </div>
  );
}

/* ─── #14 Stream Graph (SVG) ─── */
function StreamGraph({ data }: { data: Array<{ date: string; avgScore: number; count: number }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 300); return () => clearTimeout(t); }, []);

  if (data.length < 2) return null;

  const w = 400;
  const h = 120;
  const mid = h / 2;
  const n = data.length;
  const step = w / (n - 1);

  const buildPath = (values: number[], offset: number, flip: boolean) => {
    const points = values.map((v, i) => {
      const x = i * step;
      const y = flip ? mid + v + offset : mid - v - offset;
      return { x, y };
    });
    let d = `M${points[0].x},${mid}`;
    d += ` L${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2;
      d += ` C${cx},${points[i - 1].y} ${cx},${points[i].y} ${points[i].x},${points[i].y}`;
    }
    d += ` L${points[points.length - 1].x},${mid}`;
    d += ` Z`;
    return d;
  };

  const layer1 = data.map(d => (d.avgScore / 100) * 25);
  const layer2 = data.map(d => (d.count / Math.max(...data.map(x => x.count), 1)) * 15);
  const layer3 = data.map(d => ((100 - d.avgScore) / 100) * 12);

  return (
    <div className="relative overflow-hidden rounded-xl" style={{ opacity: mounted ? 1 : 0, transition: "opacity 1s ease 0.3s" }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="stream1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CYAN} stopOpacity="0.3" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="stream2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.25" />
            <stop offset="100%" stopColor={VIOLET} stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="stream3" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={EMERALD} stopOpacity="0.2" />
            <stop offset="100%" stopColor={EMERALD} stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <path d={buildPath(layer1, 0, false)} fill="url(#stream1)" stroke={CYAN} strokeWidth="1" strokeOpacity="0.3" />
        <path d={buildPath(layer1, 0, true)} fill="url(#stream1)" stroke={CYAN} strokeWidth="1" strokeOpacity="0.3" />
        <path d={buildPath(layer2, 0, false)} fill="url(#stream2)" stroke={VIOLET} strokeWidth="0.5" strokeOpacity="0.2" />
        <path d={buildPath(layer2, 0, true)} fill="url(#stream2)" stroke={VIOLET} strokeWidth="0.5" strokeOpacity="0.2" />
        <path d={buildPath(layer3, 25, false)} fill="url(#stream3)" stroke={EMERALD} strokeWidth="0.5" strokeOpacity="0.15" />
        <path d={buildPath(layer3, 25, true)} fill="url(#stream3)" stroke={EMERALD} strokeWidth="0.5" strokeOpacity="0.15" />
        {/* center line */}
        <line x1="0" y1={mid} x2={w} y2={mid} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
      <div className="absolute bottom-2 right-3 flex items-center gap-3">
        {[{ c: CYAN, l: "Score" }, { c: VIOLET, l: "Volume" }, { c: EMERALD, l: "Risk" }].map(item => (
          <div key={item.l} className="flex items-center gap-1.5">
            <div className="w-[6px] h-[6px] rounded-full" style={{ background: item.c, boxShadow: `0 0 4px ${item.c}50` }} />
            <span className="text-[9px] text-[#4E5D6E]">{item.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── #2 MITRE ATT&CK Heatmap (real data) ─── */
const ALL_TACTICS = [
  { id: "TA0043", short: "Recon" },
  { id: "TA0042", short: "Resrc Dev" },
  { id: "TA0001", short: "Access" },
  { id: "TA0002", short: "Exec" },
  { id: "TA0003", short: "Persist" },
  { id: "TA0004", short: "Priv Esc" },
  { id: "TA0005", short: "Defense" },
  { id: "TA0006", short: "Cred" },
  { id: "TA0007", short: "Discovery" },
  { id: "TA0008", short: "Lateral" },
  { id: "TA0009", short: "Collect" },
  { id: "TA0011", short: "C2" },
  { id: "TA0010", short: "Exfil" },
  { id: "TA0040", short: "Impact" },
];

function MitreHeatmap({ mitreCoverage }: { mitreCoverage: ChartData["mitreCoverage"] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 600); return () => clearTimeout(t); }, []);

  if (!mitreCoverage?.tactics) return <div className="text-center py-8 text-[#4E5D6E] text-xs">Loading MITRE data…</div>;

  const tacticMap = new Map(mitreCoverage.tactics.map(t => [t.id, t]));
  const coveredCount = mitreCoverage.coveredTactics;
  const coveragePct = Math.round((coveredCount / ALL_TACTICS.length) * 100);

  const maxTechniques = Math.max(...mitreCoverage.tactics.map(t => t.techniqueCount), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {[
            { c: "rgba(255,255,255,0.03)", l: "No rules", border: true },
            { c: `${AMBER}35`, l: "1-2 rules" },
            { c: `${EMERALD}40`, l: "3+ rules" },
          ].map(item => (
            <div key={item.l} className="flex items-center gap-1">
              <div className="w-[8px] h-[8px] rounded-[2px]" style={{ background: item.c, border: item.border ? "1px solid rgba(255,255,255,0.06)" : "none" }} />
              <span className="text-[8px] text-[#4E5D6E]">{item.l}</span>
            </div>
          ))}
        </div>
        <span className="text-[11px] font-bold tabular-nums" style={{ color: coveragePct > 50 ? EMERALD : coveragePct > 25 ? AMBER : ROSE }}>
          {coveredCount}/{ALL_TACTICS.length} tactics covered
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${ALL_TACTICS.length}, minmax(48px, 1fr))` }}>
          {ALL_TACTICS.map((tactic, tIdx) => {
            const data = tacticMap.get(tactic.id);
            const techCount = data?.techniqueCount || 0;
            const intensity = techCount === 0 ? 0 : techCount >= 3 ? 2 : 1;

            const bgColor = intensity === 0 ? "rgba(255,255,255,0.03)" : intensity === 1 ? `${AMBER}35` : `${EMERALD}40`;
            const glowShadow = intensity === 2 ? `0 0 8px ${EMERALD}25` : intensity === 1 ? `0 0 6px ${AMBER}15` : "none";

            return (
              <div key={tactic.id} className="text-center">
                <div className="text-[7px] text-[#4E5D6E] uppercase tracking-wider mb-1.5 truncate" title={data?.name || tactic.short}>{tactic.short}</div>
                <div
                  className="h-[32px] rounded-[3px] flex items-center justify-center"
                  style={{
                    background: mounted ? bgColor : "rgba(255,255,255,0.03)",
                    boxShadow: mounted ? glowShadow : "none",
                    transition: `all 0.5s ease ${tIdx * 50}ms`,
                  }}
                >
                  {techCount > 0 && mounted && (
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: intensity >= 2 ? EMERALD : AMBER, opacity: 0.8 }}>
                      {techCount}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {mitreCoverage.totalMappings > 0 && (
        <div className="flex items-center justify-between mt-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <span className="text-[9px] text-[#4E5D6E]">{mitreCoverage.coveredTechniques} techniques mapped across {mitreCoverage.totalMappings} rule-technique links</span>
        </div>
      )}
    </div>
  );
}

/* ─── #8 Treemap ─── */
function Treemap({ data }: { data: Array<{ language: string; count: number }> }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 500); return () => clearTimeout(t); }, []);

  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const sorted = [...data].sort((a, b) => b.count - a.count);

  return (
    <div
      className="grid gap-[3px] h-[120px]"
      style={{
        gridTemplateColumns: sorted.map(d => `${Math.max(d.count / total, 0.1)}fr`).join(" "),
      }}
    >
      {sorted.map((entry, i) => {
        const color = LANG_COLORS[entry.language] || "#64748B";
        const pct = Math.round((entry.count / total) * 100);
        return (
          <div
            key={entry.language}
            className="rounded-lg flex flex-col items-center justify-center relative overflow-hidden cursor-default group"
            style={{
              background: mounted ? `${color}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${mounted ? `${color}25` : "rgba(255,255,255,0.04)"}`,
              transition: `all 0.6s ease ${i * 100}ms`,
            }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}10, transparent 70%)` }} />
            <span className="text-[18px] font-extrabold tabular-nums relative" style={{ color, textShadow: mounted ? `0 0 16px ${color}40` : "none" }}>{entry.count}</span>
            <span className="text-[9px] text-[#4E5D6E] uppercase tracking-wider font-semibold relative">{entry.language}</span>
            <span className="text-[8px] text-[#3A4555] tabular-nums relative mt-0.5">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Card wrapper with neon glow (#24) ─── */
function NeonCard({ children, className = "", delay = 0, glowColor }: { children: React.ReactNode; className?: string; delay?: number; glowColor?: string }) {
  return (
    <AnimateIn delay={delay} className={className}>
      <div
        className="relative bg-[#111827]/80 rounded-2xl overflow-hidden h-full"
        style={{
          border: "1px solid rgba(255,255,255,0.04)",
          boxShadow: glowColor ? `0 0 30px ${glowColor}06, inset 0 1px 0 rgba(255,255,255,0.03)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {children}
      </div>
    </AnimateIn>
  );
}

function CardHeader({ title, badge, rightContent }: { title: string; badge?: string; rightContent?: React.ReactNode }) {
  return (
    <div className="px-5 pt-5 pb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold text-white">{title}</span>
        {badge && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#4CBDFA]/10 text-[#4CBDFA] tabular-nums">{badge}</span>
        )}
      </div>
      {rightContent}
    </div>
  );
}

/* ─── Main Component ─── */
export function DashboardCharts() {
  const [data, setData] = useState<ChartData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/charts")
      .then((r) => r.json())
      .then((d) => { setData(d); setTimeout(() => setMounted(true), 200); })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const hasScoreData = data.scoreTrend.length > 0;
  const hasTypeData = data.analysisTypes.length > 0;
  const hasLangData = data.rulesByLanguage.length > 0;

  if (!hasScoreData && !hasTypeData && !hasLangData) return null;

  const totalAnalyses = data.analysisTypes.reduce((sum, d) => sum + d.count, 0);
  const totalRules = data.totalRules || data.rulesByLanguage.reduce((sum, d) => sum + d.count, 0);
  const latestScore = hasScoreData ? data.scoreTrend[data.scoreTrend.length - 1]?.avgScore ?? 0 : 0;
  const productionRules = data.ruleStatusCounts?.production || 0;
  const mitreCoverage = data.mitreCoverage;

  return (
    <div className="space-y-4">

      {/* Row 1 — Streaming Counters + Activity Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Streaming Counters */}
        <NeonCard delay={60} className="lg:col-span-8" glowColor={CYAN}>
          <CardHeader title="Live Metrics" rightContent={
            <div className="flex items-center gap-1.5">
              <div className="w-[6px] h-[6px] rounded-full" style={{ background: EMERALD, boxShadow: `0 0 8px ${EMERALD}80`, animation: "pulse 2s ease-in-out infinite" }} />
              <span className="text-[9px] text-[#4E5D6E] uppercase tracking-wider">Live</span>
            </div>
          } />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-3">
              <StreamingCounter value={totalRules} color={CYAN} label="Rules" />
              <StreamingCounter value={totalAnalyses} color={VIOLET} label="Analyses" />
              <StreamingCounter value={latestScore} color={latestScore >= 60 ? EMERALD : AMBER} label="Avg Score" />
              <StreamingCounter value={productionRules} color={EMERALD} label="Production" />
            </div>
          </div>
        </NeonCard>

        {/* Activity Rings */}
        {hasTypeData && (
          <NeonCard delay={160} className="lg:col-span-4" glowColor={VIOLET}>
            <CardHeader title="AI Operations" />
            <div className="px-5 pb-4">
              <ActivityRings data={data.analysisTypes} />
              <div className="flex justify-center gap-3 mt-2">
                {data.analysisTypes.slice(0, 4).map((d, i) => (
                  <div key={d.type} className="flex items-center gap-1.5">
                    <div className="w-[6px] h-[6px] rounded-full" style={{ background: [CYAN, VIOLET, EMERALD, AMBER][i] }} />
                    <span className="text-[9px] text-[#4E5D6E]">{TYPE_LABELS[d.type] || d.type}</span>
                  </div>
                ))}
              </div>
            </div>
          </NeonCard>
        )}
      </div>

      {/* Row 2 — Stream Graph + Treemap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Stream Graph */}
        {hasScoreData && (
          <NeonCard delay={260} className="lg:col-span-7" glowColor={CYAN}>
            <CardHeader title="Analysis Trend" badge="30d" rightContent={
              <span className="text-[10px] text-[#4E5D6E] uppercase tracking-wider">Score &middot; Volume</span>
            } />
            <div className="px-4 pb-4">
              <StreamGraph data={data.scoreTrend} />
            </div>
          </NeonCard>
        )}

        {/* Treemap + Waffle */}
        {hasLangData && (
          <NeonCard delay={360} className="lg:col-span-5" glowColor={VIOLET}>
            <CardHeader title="Rule Arsenal" badge={`${totalRules} rules`} />
            <div className="px-5 pb-5 space-y-5">
              <Treemap data={data.rulesByLanguage} />
              <ShieldGauge
                value={mitreCoverage?.coveredTactics || 0}
                total={ALL_TACTICS.length}
                color={mitreCoverage && mitreCoverage.coveredTactics >= ALL_TACTICS.length / 2 ? EMERALD : AMBER}
                label="MITRE Tactic Coverage"
              />
            </div>
          </NeonCard>
        )}
      </div>

      {/* Row 3 — MITRE Heatmap */}
      <NeonCard delay={460} glowColor={ROSE}>
        <CardHeader title="MITRE ATT&CK Coverage" rightContent={
          <div className="flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full" style={{ background: CYAN, boxShadow: `0 0 6px ${CYAN}60`, animation: "pulse 2s ease-in-out infinite" }} />
            <span className="text-[10px] text-[#4E5D6E] uppercase tracking-wider">{ALL_TACTICS.length} Tactics</span>
          </div>
        } />
        <div className="px-5 pb-5">
          {mitreCoverage ? (
            <MitreHeatmap mitreCoverage={mitreCoverage} />
          ) : (
            <div className="text-center py-8 text-[#4E5D6E] text-xs">No MITRE mappings yet</div>
          )}
        </div>
      </NeonCard>

    </div>
  );
}

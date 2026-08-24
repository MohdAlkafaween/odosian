"use client";

import { useEffect, useState, useMemo } from "react";

type OperationType = "analyze" | "enhance" | "generate" | "simulate" | "post_enhance";

interface AILoadingProps {
  operation: OperationType;
  statusMessage?: string;
  onCancel?: () => void;
}

const OPERATION_CONFIG: Record<OperationType, {
  title: string;
  phases: string[];
  color: string;
  glowColor: string;
  icon: string;
}> = {
  analyze: {
    title: "Analyzing Detection Rule",
    phases: [
      "Parsing rule structure...",
      "Evaluating query logic...",
      "Checking MITRE coverage...",
      "Assessing detection gaps...",
      "Scoring rule quality...",
      "Compiling findings...",
    ],
    color: "#3B82F6",
    glowColor: "rgba(59, 130, 246, 0.15)",
    icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  },
  enhance: {
    title: "Enhancing Detection Rule",
    phases: [
      "Studying original query...",
      "Identifying improvement areas...",
      "Expanding detection scope...",
      "Refining field references...",
      "Optimizing performance...",
      "Generating enhanced version...",
    ],
    color: "#6366F1",
    glowColor: "rgba(99, 102, 241, 0.15)",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  },
  generate: {
    title: "Generating Detection Rule",
    phases: [
      "Interpreting requirement...",
      "Mapping threat techniques...",
      "Selecting query language...",
      "Constructing detection logic...",
      "Adding field mappings...",
      "Building complete rule...",
    ],
    color: "#22C55E",
    glowColor: "rgba(34, 197, 94, 0.15)",
    icon: "M12 5v14M5 12h14",
  },
  simulate: {
    title: "Simulating Attack Scenario",
    phases: [
      "Building threat model...",
      "Mapping attack surface...",
      "Generating evasion paths...",
      "Evaluating bypass methods...",
      "Scoring resilience...",
      "Compiling simulation report...",
    ],
    color: "#EF4444",
    glowColor: "rgba(239, 68, 68, 0.15)",
    icon: "M12 9v2m0 4h.01M5.07 19H19a2 2 0 001.75-2.96l-7-12a2 2 0 00-3.5 0l-7 12A2 2 0 005.07 19z",
  },
  post_enhance: {
    title: "Analyzing Enhancement",
    phases: [
      "Comparing rule versions...",
      "Measuring improvements...",
      "Validating changes...",
      "Scoring enhancement...",
      "Finalizing comparison...",
    ],
    color: "#F59E0B",
    glowColor: "rgba(245, 158, 11, 0.15)",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
};

function HexGrid({ color }: { color: string }) {
  const cells = useMemo(() => {
    const result = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        const x = col * 36 + (row % 2) * 18;
        const y = row * 31;
        const delay = (row * 7 + col) * 0.12;
        result.push({ x, y, delay, key: `${row}-${col}` });
      }
    }
    return result;
  }, []);

  return (
    <svg width="270" height="160" viewBox="0 0 270 160" className="absolute opacity-[0.06]">
      {cells.map(({ x, y, delay, key }) => (
        <polygon
          key={key}
          points={hexPoints(x + 18, y + 16, 14)}
          fill="none"
          stroke={color}
          strokeWidth="0.5"
          style={{
            animation: `hexPulse 4s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </svg>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function OrbitRing({ color, size, duration, reverse }: { color: string; size: number; duration: number; reverse?: boolean }) {
  const r = size / 2 - 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="absolute" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray={`${circumference * 0.2} ${circumference * 0.8}`}
        strokeLinecap="round"
        opacity="0.3"
        style={{
          animation: `${reverse ? "orbitReverse" : "orbit"} ${duration}s linear infinite`,
          transformOrigin: "center",
        }}
      />
    </svg>
  );
}

function DataStream({ color }: { color: string }) {
  const particles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 20 + Math.random() * 200,
      delay: Math.random() * 3,
      duration: 1.5 + Math.random() * 2,
      size: 1 + Math.random() * 2,
    })),
  []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: p.x,
            width: p.size,
            height: p.size,
            backgroundColor: color,
            opacity: 0,
            animation: `dataFloat ${p.duration}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export function AILoading({ operation, statusMessage, onCancel }: AILoadingProps) {
  const config = OPERATION_CONFIG[operation] || OPERATION_CONFIG.analyze;
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % config.phases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [config.phases.length]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="relative flex flex-col items-center justify-center py-16 select-none overflow-hidden">
      {/* Background hex grid */}
      <HexGrid color={config.color} />

      {/* Data stream particles */}
      <DataStream color={config.color} />

      {/* Central orb */}
      <div className="relative w-28 h-28 mb-6">
        {/* Glow backdrop */}
        <div
          className="absolute inset-0 rounded-full blur-xl"
          style={{ backgroundColor: config.glowColor, animation: "orbPulse 2s ease-in-out infinite" }}
        />

        {/* Orbit rings */}
        <OrbitRing color={config.color} size={112} duration={6} />
        <OrbitRing color={config.color} size={96} duration={4} reverse />
        <OrbitRing color={config.color} size={80} duration={8} />

        {/* Inner circle */}
        <div
          className="absolute rounded-full border flex items-center justify-center"
          style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 56,
            height: 56,
            borderColor: `color-mix(in srgb, ${config.color} 40%, transparent)`,
            background: `radial-gradient(circle, color-mix(in srgb, ${config.color} 8%, transparent), transparent)`,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={config.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: "iconPulse 2s ease-in-out infinite" }}
          >
            <path d={config.icon} />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-base font-semibold mb-2 tracking-wide"
        style={{ color: config.color }}
      >
        {config.title}
      </h3>

      {/* Phase text */}
      <div className="h-5 mb-3 relative">
        <p
          key={phaseIndex}
          className="text-sm text-text-secondary"
          style={{ animation: "phaseIn 0.5s ease both" }}
        >
          {statusMessage || config.phases[phaseIndex]}
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 mb-4">
        {config.phases.map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all duration-500"
            style={{
              backgroundColor: i === phaseIndex ? config.color : "var(--color-border)",
              transform: i === phaseIndex ? "scale(1.4)" : "scale(1)",
              boxShadow: i === phaseIndex ? `0 0 6px ${config.color}` : "none",
            }}
          />
        ))}
      </div>

      {/* Elapsed time */}
      <p className="text-xs text-text-muted font-mono tabular-nums">{formatTime(elapsed)}</p>

      {/* Cancel button */}
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 px-3 py-1 text-xs text-text-muted border border-border rounded hover:text-text-secondary hover:border-border-focus transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Inline keyframes */}
      <style>{`
        @keyframes orbit {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes orbitReverse {
          from { transform: translate(-50%, -50%) rotate(360deg); }
          to { transform: translate(-50%, -50%) rotate(0deg); }
        }
        @keyframes orbPulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
        @keyframes iconPulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes phaseIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hexPulse {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        @keyframes dataFloat {
          0% { opacity: 0; transform: translateY(100px); }
          20% { opacity: 0.6; }
          80% { opacity: 0.2; }
          100% { opacity: 0; transform: translateY(-80px); }
        }
      `}</style>
    </div>
  );
}

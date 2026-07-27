"use client";

type BadgePreset =
  | "critical" | "high" | "medium" | "low" | "info"
  | "draft" | "reviewed" | "production" | "deprecated"
  | "A+" | "A" | "B" | "C" | "D" | "F"
  | "production_ready" | "needs_tuning" | "needs_rework" | "reject"
  | "ADMIN" | "ANALYST" | "DETECTION_ENG" | "VIEWER"
  | "analyzed" | "enhanced" | "deployed" | "qf" | "generated";

const presetClasses: Record<string, string> = {
  critical: "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
  high: "bg-severity-high/15 text-severity-high border-severity-high/30",
  medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  low: "bg-primary/15 text-primary border-primary/30",
  info: "bg-text-secondary/15 text-text-secondary border-text-secondary/30",
  draft: "bg-text-secondary/15 text-text-secondary border-text-secondary/30",
  reviewed: "bg-accent/15 text-accent border-accent/30",
  production: "bg-success/15 text-success border-success/30",
  deprecated: "bg-severity-high/15 text-severity-high border-severity-high/30",
  "A+": "bg-success/15 text-success border-success/30",
  A: "bg-success/15 text-success border-success/30",
  B: "bg-accent/15 text-accent border-accent/30",
  C: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  D: "bg-severity-high/15 text-severity-high border-severity-high/30",
  F: "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
  production_ready: "bg-success/15 text-success border-success/30",
  needs_tuning: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  needs_rework: "bg-severity-high/15 text-severity-high border-severity-high/30",
  reject: "bg-severity-critical/15 text-severity-critical border-severity-critical/30",
  ADMIN: "bg-primary/15 text-primary border-primary/30",
  ANALYST: "bg-accent/15 text-accent border-accent/30",
  DETECTION_ENG: "bg-accent/15 text-accent border-accent/30",
  VIEWER: "bg-text-secondary/15 text-text-secondary border-text-secondary/30",
  analyzed: "bg-primary/15 text-primary border-primary/30",
  enhanced: "bg-accent/15 text-accent border-accent/30",
  deployed: "bg-success/15 text-success border-success/30",
  qf: "bg-severity-medium/15 text-severity-medium border-severity-medium/30",
  generated: "bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/30",
};

interface BadgeProps {
  preset?: BadgePreset;
  className?: string;
  children?: React.ReactNode;
}

export function Badge({ preset, className = "", children }: BadgeProps) {
  const classes = preset
    ? presetClasses[preset] || presetClasses.info
    : "bg-surface-light text-text-secondary border-border";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${classes} ${className}`}
    >
      {children || preset}
    </span>
  );
}

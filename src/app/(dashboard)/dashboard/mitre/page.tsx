"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";
import { PageLoader } from "@/components/ui/loading";
import { MITRE_TACTICS } from "@/lib/mitre-data";

interface MitreCounts {
  tacticCounts: Record<string, number>;
  techniqueCounts: Record<string, number>;
  totalMappings: number;
  coveredTactics: number;
  coveredTechniques: number;
}

interface LinkedRule {
  id: string;
  title: string;
  severity: string;
  status: string;
  ruleType: string;
  language: string;
  client: string;
  tags: string[];
  query: string;
  updatedAt: string;
  confidence: number;
  author: { id: string; name: string };
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#FB7185",
  high: "#F97316",
  medium: "#FBBF24",
  low: "#34D399",
};

export default function MitrePage() {
  const [counts, setCounts] = useState<MitreCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerSubtitle, setDrawerSubtitle] = useState("");
  const [drawerRules, setDrawerRules] = useState<LinkedRule[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerWidth, setDrawerWidth] = useState(540);
  const resizingRef = useRef(false);
  const portalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    portalRef.current = document.body;
  }, []);

  useEffect(() => {
    fetch("/api/mitre")
      .then((r) => r.json())
      .then(setCounts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleTactic = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openTechniqueDrawer = useCallback(async (techniqueId: string, techniqueName: string, tacticName: string) => {
    setDrawerOpen(true);
    setDrawerTitle(techniqueName);
    setDrawerSubtitle(techniqueId);
    setDrawerRules([]);
    setDrawerLoading(true);

    try {
      const res = await fetch(`/api/mitre/rules?techniqueId=${encodeURIComponent(techniqueId)}`);
      const data = await res.json();
      if (res.ok) {
        setDrawerRules(data.rules || []);
      }
    } catch {
      // silent
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  if (loading) return <PageLoader />;

  const searchLower = search.toLowerCase();
  const filteredTactics = MITRE_TACTICS.filter((t) => {
    if (!searchLower) return true;
    if (t.name.toLowerCase().includes(searchLower) || t.id.toLowerCase().includes(searchLower)) return true;
    return t.techniques.some(
      (tech) => tech.name.toLowerCase().includes(searchLower) || tech.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[28px] font-extrabold text-text">MITRE ATT&CK Shield Map</h1>
        <p className="text-sm text-text-secondary mt-1">
          Explore tactics and techniques with detection rule coverage
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted">Total Mappings</p>
            <p className="text-2xl font-bold text-text">{counts?.totalMappings ?? 0}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted">Covered Tactics</p>
            <p className="text-2xl font-bold text-text">
              {counts?.coveredTactics ?? 0}
              <span className="text-sm text-text-muted font-normal"> / {MITRE_TACTICS.length}</span>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs text-text-muted">Covered Techniques</p>
            <p className="text-2xl font-bold text-text">{counts?.coveredTechniques ?? 0}</p>
          </CardBody>
        </Card>
      </div>

      <div className="mb-6">
        <SearchInput value={search} onSearch={setSearch} placeholder="Search tactics or techniques..." />
      </div>

      <div className="space-y-3">
        {filteredTactics.map((tactic) => {
          const tacticCount = counts?.tacticCounts?.[tactic.id] || 0;
          const isExpanded = expanded.has(tactic.id);
          const hasCoverage = tacticCount > 0;

          const filteredTechniques = searchLower
            ? tactic.techniques.filter(
                (tech) => tech.name.toLowerCase().includes(searchLower) || tech.id.toLowerCase().includes(searchLower) ||
                  tactic.name.toLowerCase().includes(searchLower)
              )
            : tactic.techniques;

          return (
            <Card
              key={tactic.id}
              className={hasCoverage ? "border-primary/30" : ""}
            >
              <button
                onClick={() => toggleTactic(tactic.id)}
                className="w-full text-left"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`text-text-muted transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      <div>
                        <span className="text-sm font-semibold text-text">{tactic.name}</span>
                        <span className="text-xs text-text-muted ml-2">{tactic.id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tacticCount > 0 && (
                        <Badge preset="info">{tacticCount} rule{tacticCount !== 1 ? "s" : ""}</Badge>
                      )}
                      <span className="text-xs text-text-muted">{tactic.techniques.length} techniques</span>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {isExpanded && (
                <CardBody>
                  <p className="text-xs text-text-secondary mb-4">{tactic.description}</p>
                  <div className="space-y-1">
                    {filteredTechniques.map((tech) => {
                      const techCount = counts?.techniqueCounts?.[tech.id] || 0;
                      return (
                        <div key={tech.id}>
                          <button
                            onClick={() => {
                              if (techCount > 0) {
                                openTechniqueDrawer(tech.id, tech.name, tactic.name);
                              }
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                              techCount > 0
                                ? "bg-primary/5 hover:bg-primary/10 cursor-pointer"
                                : "bg-surface-light cursor-default"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <code className={`text-xs font-mono ${techCount > 0 ? "text-primary" : "text-text-muted"}`}>
                                {tech.id}
                              </code>
                              <span className={`text-sm text-left ${techCount > 0 ? "text-text" : "text-text-muted"}`}>
                                {tech.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {techCount > 0 && (
                                <>
                                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                                    {techCount}
                                  </span>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary/50">
                                    <path d="M9 18l6-6-6-6" />
                                  </svg>
                                </>
                              )}
                            </div>
                          </button>
                          {tech.subtechniques?.map((sub) => {
                            const subCount = counts?.techniqueCounts?.[sub.id] || 0;
                            return (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  if (subCount > 0) {
                                    openTechniqueDrawer(sub.id, sub.name, tactic.name);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-3 py-1.5 ml-6 rounded transition-colors ${
                                  subCount > 0
                                    ? "bg-primary/5 hover:bg-primary/10 cursor-pointer"
                                    : "cursor-default"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <code className={`text-xs font-mono ${subCount > 0 ? "text-accent" : "text-text-muted"}`}>
                                    {sub.id}
                                  </code>
                                  <span className={`text-xs text-left ${subCount > 0 ? "text-text-secondary" : "text-text-muted"}`}>
                                    {sub.name}
                                  </span>
                                </div>
                                {subCount > 0 && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-accent">{subCount}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent/50">
                                      <path d="M9 18l6-6-6-6" />
                                    </svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>

      {/* Rules Drawer — portaled to body for independent scroll */}
      {drawerOpen && portalRef.current && createPortal(
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={closeDrawer} />
          <div
            className="fixed top-0 right-0 h-screen bg-[#0d1320] border-l-2 border-primary/20 z-[9999] flex flex-col"
            style={{ width: drawerWidth, boxShadow: "-8px 0 30px rgba(0,0,0,0.5)", animation: "mitre-slide-in 0.25s ease-out" }}
          >
            {/* Resize handle */}
            <div
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-10 group"
              onMouseDown={(e) => {
                e.preventDefault();
                resizingRef.current = true;
                const startX = e.clientX;
                const startWidth = drawerWidth;
                const onMove = (ev: MouseEvent) => {
                  if (!resizingRef.current) return;
                  const delta = startX - ev.clientX;
                  setDrawerWidth(Math.max(360, Math.min(900, startWidth + delta)));
                };
                const onUp = () => {
                  resizingRef.current = false;
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                  document.body.style.cursor = "";
                  document.body.style.userSelect = "";
                };
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            >
              <div className="absolute top-1/2 left-0.5 -translate-y-1/2 w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
            </div>

            <div className="flex items-center justify-between px-6 py-5 border-b border-primary/10 bg-[#111827] shrink-0">
              <div>
                <h2 className="text-lg font-bold text-text">{drawerTitle}</h2>
                <p className="text-xs text-text-muted font-mono">{drawerSubtitle}</p>
              </div>
              <button
                onClick={closeDrawer}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-light transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : drawerRules.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-text-muted text-sm">No detection rules mapped to this technique yet.</p>
                  <Link
                    href="/dashboard/rules/new"
                    className="inline-block mt-3 text-sm text-primary hover:underline"
                  >
                    Create a rule
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-text-muted mb-2">
                    {drawerRules.length} detection rule{drawerRules.length !== 1 ? "s" : ""} covering this technique
                  </p>
                  {drawerRules.map((rule) => (
                    <Link
                      key={rule.id}
                      href={`/dashboard/rules/${rule.id}`}
                      className="block rounded-xl border border-border bg-surface hover:border-primary/40 transition-colors p-4 group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors leading-tight">
                          {rule.title}
                        </h3>
                        <div
                          className="shrink-0 w-2 h-2 rounded-full mt-1.5"
                          style={{ background: SEVERITY_COLORS[rule.severity] || "#6B7280" }}
                          title={rule.severity}
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mb-3">
                        <span
                          className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            background: `${SEVERITY_COLORS[rule.severity] || "#6B7280"}18`,
                            color: SEVERITY_COLORS[rule.severity] || "#6B7280",
                          }}
                        >
                          {rule.severity}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-text-muted">
                          {rule.status}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-light text-text-muted">
                          {rule.language}
                        </span>
                        {rule.client && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {rule.client}
                          </span>
                        )}
                      </div>

                      <div className="bg-[#0B0F19] rounded-lg p-2.5 mb-2 overflow-x-auto">
                        <code className="text-[11px] text-text-secondary font-mono whitespace-pre-wrap break-all leading-relaxed">
                          {rule.query.length > 200 ? rule.query.slice(0, 200) + "..." : rule.query}
                        </code>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(rule.tags) && rule.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-surface-light text-text-muted">
                              {tag}
                            </span>
                          ))}
                          {Array.isArray(rule.tags) && rule.tags.length > 3 && (
                            <span className="text-[9px] text-text-muted">+{rule.tags.length - 3}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {rule.confidence > 0 && (
                            <span className="text-[10px] text-text-muted" title="Mapping confidence">
                              {rule.confidence}%
                            </span>
                          )}
                          <span className="text-[10px] text-text-muted">
                            {rule.author.name}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <style>{`
            @keyframes mitre-slide-in {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </>,
        portalRef.current
      )}
    </div>
  );
}

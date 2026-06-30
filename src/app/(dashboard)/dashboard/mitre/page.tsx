"use client";

import { useCallback, useEffect, useState } from "react";
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

export default function MitrePage() {
  const [counts, setCounts] = useState<MitreCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
                          <div
                            className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                              techCount > 0 ? "bg-primary/5" : "bg-surface-light"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <code className={`text-xs font-mono ${techCount > 0 ? "text-primary" : "text-text-muted"}`}>
                                {tech.id}
                              </code>
                              <span className={`text-sm ${techCount > 0 ? "text-text" : "text-text-muted"}`}>
                                {tech.name}
                              </span>
                            </div>
                            {techCount > 0 && (
                              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                                {techCount}
                              </span>
                            )}
                          </div>
                          {tech.subtechniques?.map((sub) => {
                            const subCount = counts?.techniqueCounts?.[sub.id] || 0;
                            return (
                              <div
                                key={sub.id}
                                className={`flex items-center justify-between px-3 py-1.5 ml-6 rounded ${
                                  subCount > 0 ? "bg-primary/5" : ""
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <code className={`text-xs font-mono ${subCount > 0 ? "text-accent" : "text-text-muted"}`}>
                                    {sub.id}
                                  </code>
                                  <span className={`text-xs ${subCount > 0 ? "text-text-secondary" : "text-text-muted"}`}>
                                    {sub.name}
                                  </span>
                                </div>
                                {subCount > 0 && (
                                  <span className="text-xs text-accent">{subCount}</span>
                                )}
                              </div>
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
    </div>
  );
}

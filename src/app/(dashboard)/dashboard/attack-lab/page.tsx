"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/loading";
import { CodeBlock } from "@/components/ui/code-block";
import { useToastStore } from "@/stores/toast";
import { useAuthStore } from "@/stores/auth";
import { MITRE_TACTICS, type MitreTactic, type MitreTechnique } from "@/lib/mitre-data";

interface SimulationResult {
  explanation: string;
  prerequisites: string[];
  steps: { description: string; command: string; notes: string }[];
  expectedArtifacts: string[];
  detectionRules: { name: string; query: string; language: string }[];
  evasionVariants: { variant: string; detection: string }[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  result?: SimulationResult;
  techniqueId?: string;
  techniqueName?: string;
}

interface SessionState {
  messages: ChatMessage[];
  selectedTechnique: { tech: MitreTechnique; tactic: MitreTactic } | null;
  selectedTacticId: string | null;
  expandedResults: number[];
}

function getSessionKey(userId: string | undefined): string {
  return `attack-lab-session:${userId || "anon"}`;
}

function saveSession(userId: string | undefined, state: SessionState) {
  try {
    sessionStorage.setItem(getSessionKey(userId), JSON.stringify(state));
  } catch {}
}

function loadSession(userId: string | undefined): SessionState | null {
  try {
    const raw = sessionStorage.getItem(getSessionKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export default function AttackLabPage() {
  const { addToast } = useToastStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedTactic, setSelectedTactic] = useState<MitreTactic | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<{ tech: MitreTechnique; tactic: MitreTactic } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [expandedResults, setExpandedResults] = useState<Set<number>>(new Set());
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadSession(user?.id);
    if (!saved) return;
    setMessages(saved.messages);
    setSelectedTechnique(saved.selectedTechnique);
    setExpandedResults(new Set(saved.expandedResults));
    if (saved.selectedTacticId) {
      const tactic = MITRE_TACTICS.find(t => t.id === saved.selectedTacticId);
      if (tactic) setSelectedTactic(tactic);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!restoredRef.current) return;
    saveSession(user?.id, {
      messages,
      selectedTechnique,
      selectedTacticId: selectedTactic?.id || null,
      expandedResults: Array.from(expandedResults),
    });
  }, [messages, selectedTechnique, selectedTactic, expandedResults, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectTechnique = useCallback((tech: MitreTechnique, tactic: MitreTactic) => {
    setSelectedTechnique({ tech, tactic });
    setMessages([{
      role: "assistant",
      content: `Ready to simulate **${tech.name}** (${tech.id}) from the **${tactic.name}** tactic. Describe your lab environment and what you want to test, and I'll generate a simulation plan with commands and detection rules.`,
    }]);
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedTechnique || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/attack-lab/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          techniqueId: selectedTechnique.tech.id,
          userMessage: userMsg,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast("error", data.error || "Simulation failed");
        setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${data.error || "Simulation failed"}` }]);
        return;
      }

      setMessages((prev) => [...prev, {
        role: "assistant",
        content: data.simulation.result.explanation || "Simulation complete.",
        result: data.simulation.result,
        techniqueId: data.simulation.techniqueId,
        techniqueName: data.simulation.techniqueName,
      }]);
    } catch {
      addToast("error", "Simulation failed");
      setMessages((prev) => [...prev, { role: "assistant", content: "Error: Failed to connect to the server." }]);
    } finally {
      setLoading(false);
    }
  }, [input, selectedTechnique, loading, addToast]);

  const toggleResultSection = (idx: number) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const searchLower = search.toLowerCase();
  const filteredTactics = MITRE_TACTICS.filter((t) => {
    if (!searchLower) return true;
    if (t.name.toLowerCase().includes(searchLower) || t.id.toLowerCase().includes(searchLower)) return true;
    return t.techniques.some(
      (tech) => tech.name.toLowerCase().includes(searchLower) || tech.id.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-[28px] font-extrabold text-text">Attack Simulation Lab</h1>
        <p className="text-sm text-text-muted mt-1">
          Select a MITRE ATT&CK technique, then chat with the AI assistant to generate attack simulations
        </p>
      </div>

      <div className="flex gap-4 h-[calc(100%-5rem)]">
        {/* Left Panel: MITRE Technique Browser */}
        <div className="w-80 shrink-0 flex flex-col border border-border rounded-xl bg-surface overflow-hidden">
          <div className="p-3 border-b border-border">
            <SearchInput value={search} onSearch={setSearch} placeholder="Search techniques..." />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredTactics.map((tactic) => {
              const isExpanded = selectedTactic?.id === tactic.id;
              const filteredTechniques = searchLower
                ? tactic.techniques.filter(
                    (tech) =>
                      tech.name.toLowerCase().includes(searchLower) ||
                      tech.id.toLowerCase().includes(searchLower) ||
                      tactic.name.toLowerCase().includes(searchLower)
                  )
                : tactic.techniques;

              return (
                <div key={tactic.id}>
                  <button
                    onClick={() => setSelectedTactic(isExpanded ? null : tactic)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                      isExpanded
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-text-secondary hover:bg-surface-light hover:text-text"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                      <span>{tactic.name}</span>
                    </div>
                    <span className="text-xs text-text-muted">{tactic.techniques.length}</span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {filteredTechniques.map((tech) => {
                        const isSelected = selectedTechnique?.tech.id === tech.id;
                        return (
                          <button
                            key={tech.id}
                            onClick={() => selectTechnique(tech, tactic)}
                            className={`w-full text-left px-3 py-1.5 rounded text-xs transition-all ${
                              isSelected
                                ? "bg-primary text-bg font-semibold"
                                : "text-text-muted hover:bg-surface-light hover:text-text"
                            }`}
                          >
                            <code className="mr-1.5">{tech.id}</code>
                            {tech.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: AI Chat */}
        <div className="flex-1 flex flex-col border border-border rounded-xl bg-surface overflow-hidden">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="2" y1="12" x2="5" y2="12" />
              <line x1="19" y1="12" x2="22" y2="12" />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-text">
                {selectedTechnique ? `${selectedTechnique.tech.name} (${selectedTechnique.tech.id})` : "Attack Simulation Assistant"}
              </h2>
              <p className="text-xs text-text-muted">
                {selectedTechnique ? selectedTechnique.tactic.name : "Select a technique to begin"}
              </p>
            </div>
            {selectedTechnique && (
              <div className="ml-auto flex items-center gap-2">
                <Badge preset="info">{selectedTechnique.tactic.id}</Badge>
                <button
                  onClick={() => {
                    setMessages([]);
                    setSelectedTechnique(null);
                    setSelectedTactic(null);
                    setExpandedResults(new Set());
                    sessionStorage.removeItem(getSessionKey(user?.id));
                  }}
                  className="text-xs text-text-muted hover:text-danger transition-colors px-2 py-1 rounded hover:bg-surface-light"
                  title="Reset session"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedTechnique && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted mb-4">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                  <line x1="12" y1="2" x2="12" y2="5" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="2" y1="12" x2="5" y2="12" />
                  <line x1="19" y1="12" x2="22" y2="12" />
                </svg>
                <h3 className="text-lg font-semibold text-text mb-2">Welcome to the Attack Simulation Lab</h3>
                <p className="text-sm text-text-muted max-w-md">
                  Browse the MITRE ATT&CK techniques on the left panel, select one, then describe your lab environment to generate a simulation plan with Kali commands and detection rules.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-bg"
                    : "bg-surface-light border border-border"
                }`}>
                  <p className={`text-sm whitespace-pre-wrap ${msg.role === "user" ? "text-bg" : "text-text-secondary"}`}>
                    {msg.content}
                  </p>

                  {msg.result && (
                    <div className="mt-3 space-y-3">
                      {/* Prerequisites */}
                      {msg.result.prerequisites?.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleResultSection(idx * 10)}
                            className="text-xs font-semibold text-primary flex items-center gap-1"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${expandedResults.has(idx * 10) ? "rotate-90" : ""}`}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            Prerequisites ({msg.result.prerequisites.length})
                          </button>
                          {expandedResults.has(idx * 10) && (
                            <ul className="mt-1 space-y-0.5 ml-4">
                              {msg.result.prerequisites.map((p, i) => (
                                <li key={i} className="text-xs text-text-muted flex gap-1.5">
                                  <span className="text-primary shrink-0">-</span>{p}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Steps */}
                      {msg.result.steps?.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleResultSection(idx * 10 + 1)}
                            className="text-xs font-semibold text-success flex items-center gap-1"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${expandedResults.has(idx * 10 + 1) ? "rotate-90" : ""}`}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            Simulation Steps ({msg.result.steps.length})
                          </button>
                          {expandedResults.has(idx * 10 + 1) && (
                            <div className="mt-2 space-y-2">
                              {msg.result.steps.map((step, i) => (
                                <div key={i} className="bg-bg rounded-lg p-3 border border-border">
                                  <p className="text-xs text-text mb-1">
                                    <span className="font-semibold text-primary mr-1">Step {i + 1}:</span>
                                    {step.description}
                                  </p>
                                  <CodeBlock code={step.command} language="bash" />
                                  {step.notes && (
                                    <p className="text-xs text-text-muted mt-1 italic">{step.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Detection Rules */}
                      {msg.result.detectionRules?.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleResultSection(idx * 10 + 2)}
                            className="text-xs font-semibold text-accent flex items-center gap-1"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${expandedResults.has(idx * 10 + 2) ? "rotate-90" : ""}`}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            Detection Rules ({msg.result.detectionRules.length})
                          </button>
                          {expandedResults.has(idx * 10 + 2) && (
                            <div className="mt-2 space-y-2">
                              {msg.result.detectionRules.map((rule, i) => (
                                <div key={i} className="bg-bg rounded-lg p-3 border border-border">
                                  <p className="text-xs font-medium text-text mb-1">{rule.name}</p>
                                  <CodeBlock code={rule.query} language={rule.language === "eql" ? "eql" : "kuery"} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expected Artifacts */}
                      {msg.result.expectedArtifacts?.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleResultSection(idx * 10 + 3)}
                            className="text-xs font-semibold text-warning flex items-center gap-1"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${expandedResults.has(idx * 10 + 3) ? "rotate-90" : ""}`}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            Expected Artifacts ({msg.result.expectedArtifacts.length})
                          </button>
                          {expandedResults.has(idx * 10 + 3) && (
                            <ul className="mt-1 space-y-0.5 ml-4">
                              {msg.result.expectedArtifacts.map((a, i) => (
                                <li key={i} className="text-xs text-text-muted flex gap-1.5">
                                  <span className="text-warning shrink-0">-</span>{a}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Evasion Variants */}
                      {msg.result.evasionVariants?.length > 0 && (
                        <div>
                          <button
                            onClick={() => toggleResultSection(idx * 10 + 4)}
                            className="text-xs font-semibold text-danger flex items-center gap-1"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                              className={`transition-transform ${expandedResults.has(idx * 10 + 4) ? "rotate-90" : ""}`}>
                              <path d="M9 18l6-6-6-6" />
                            </svg>
                            Evasion Variants ({msg.result.evasionVariants.length})
                          </button>
                          {expandedResults.has(idx * 10 + 4) && (
                            <div className="mt-2 space-y-2">
                              {msg.result.evasionVariants.map((ev, i) => (
                                <div key={i} className="bg-bg rounded-lg p-2 border border-border">
                                  <p className="text-xs text-danger font-medium">{ev.variant}</p>
                                  <p className="text-xs text-text-muted mt-0.5">{ev.detection}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-light border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-text-muted">Generating simulation plan...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={selectedTechnique
                  ? "Describe your lab environment and what you want to test..."
                  : "Select a technique from the left panel first"
                }
                disabled={!selectedTechnique || loading}
                className="flex-1 bg-bg border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
              <Button
                onClick={handleSend}
                disabled={!selectedTechnique || !input.trim() || loading}
                size="sm"
                className="px-4"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

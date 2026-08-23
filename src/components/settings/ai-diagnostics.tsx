"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DiagnosticsData {
  engine: { available: boolean; pipelineReady: boolean; latencyMs: number };
  provider: { name: string; model: string; baseUrl: string; isActive: boolean } | null;
  performance: { totalToday: number; avgLatencyMs: number };
  mode: "engine" | "direct";
}

type TestState = "idle" | "testing" | "success" | "error";

export function AIDiagnosticsCard() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [engineTest, setEngineTest] = useState<TestState>("idle");
  const [providerTest, setProviderTest] = useState<TestState>("idle");
  const [engineTestMs, setEngineTestMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai-diagnostics");
      if (!res.ok) throw new Error(`${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch diagnostics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDiagnostics(); }, [fetchDiagnostics]);

  const testEngine = async () => {
    setEngineTest("testing");
    try {
      const start = Date.now();
      const res = await fetch("/api/settings/ai-diagnostics");
      const ms = Date.now() - start;
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setEngineTestMs(ms);
      setEngineTest(d.engine.available ? "success" : "error");
    } catch {
      setEngineTest("error");
    }
  };

  const testProvider = async () => {
    setProviderTest("testing");
    try {
      const res = await fetch("/api/settings/ai-diagnostics");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setProviderTest(d.provider ? "success" : "error");
    } catch {
      setProviderTest("error");
    }
  };

  const runFullDiagnostic = async () => {
    setEngineTest("testing");
    setProviderTest("testing");
    const start = Date.now();
    try {
      const res = await fetch("/api/settings/ai-diagnostics");
      const ms = Date.now() - start;
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      setEngineTestMs(ms);
      setEngineTest(d.engine.available ? "success" : "error");
      setProviderTest(d.provider ? "success" : "error");
    } catch {
      setEngineTest("error");
      setProviderTest("error");
    }
  };

  const statusColor = (ok: boolean) => ok ? "bg-success" : "bg-danger";
  const modeColor = data?.mode === "engine" ? "text-success" : "text-warning";
  const modeLabel = data?.mode === "engine" ? "Engine Mode" : "Direct Mode";
  const modeBg = data?.mode === "engine" ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30";

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="flex items-center gap-3 py-4">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-text-secondary">Loading AI diagnostics...</span>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
            <h2 className="font-semibold text-text">AI System Health</h2>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-danger">{error}</p>
          <Button size="sm" className="mt-3" onClick={fetchDiagnostics}>Retry</Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
              <path d="M12 6v6l4 2" />
            </svg>
            <h2 className="font-semibold text-text">AI System Health</h2>
            {data && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${modeBg} ${modeColor}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${data.mode === "engine" ? "bg-success" : "bg-warning"}`} />
                {modeLabel}
              </div>
            )}
          </div>
          <Button size="sm" onClick={runFullDiagnostic} loading={engineTest === "testing" && providerTest === "testing"}>
            Run Diagnostic
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Status Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Engine Status */}
          <div className="bg-surface-light rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                </svg>
                <span className="text-sm font-medium text-text">Engine</span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${data ? statusColor(data.engine.available) : "bg-text-muted"}`} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Status</span>
                <span className={data?.engine.available ? "text-success" : "text-danger"}>
                  {data?.engine.available ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Pipeline</span>
                <span className={data?.engine.pipelineReady ? "text-success" : "text-warning"}>
                  {data?.engine.pipelineReady ? "Ready" : "Not Ready"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Latency</span>
                <span className="text-text-secondary">
                  {data ? `${data.engine.latencyMs}ms` : "—"}
                </span>
              </div>
              {engineTest !== "idle" && engineTest !== "testing" && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Last test</span>
                  <span className={engineTest === "success" ? "text-success" : "text-danger"}>
                    {engineTest === "success" ? `OK (${engineTestMs}ms)` : "Failed"}
                  </span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-3" onClick={testEngine} loading={engineTest === "testing"}>
              Test Engine
            </Button>
          </div>

          {/* Provider Status */}
          <div className="bg-surface-light rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span className="text-sm font-medium text-text">Provider</span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${data?.provider ? "bg-success" : "bg-danger"}`} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Name</span>
                <span className="text-text-secondary truncate ml-2">
                  {data?.provider?.name || "Not configured"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Model</span>
                <span className="text-text-secondary truncate ml-2 font-mono">
                  {data?.provider?.model || "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Status</span>
                <span className={data?.provider?.isActive ? "text-success" : "text-warning"}>
                  {data?.provider ? (data.provider.isActive ? "Active" : "Inactive") : "Missing"}
                </span>
              </div>
              {providerTest !== "idle" && providerTest !== "testing" && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-muted">Last test</span>
                  <span className={providerTest === "success" ? "text-success" : "text-danger"}>
                    {providerTest === "success" ? "Connected" : "Failed"}
                  </span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="w-full mt-3" onClick={testProvider} loading={providerTest === "testing"}>
              Test Provider
            </Button>
          </div>

          {/* Performance */}
          <div className="bg-surface-light rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-secondary">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                <span className="text-sm font-medium text-text">Performance</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Analyses today</span>
                <span className="text-text font-medium">{data?.performance.totalToday ?? 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">Avg latency</span>
                <span className="text-text-secondary">
                  {data?.performance.avgLatencyMs ? `${data.performance.avgLatencyMs}ms` : "—"}
                </span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] text-text-muted">
                The engine validates AI claims against its knowledge base (~9% rejection rate is normal).
              </p>
            </div>
          </div>
        </div>

        {/* Engine offline notice */}
        {data && !data.engine.available && (
          <div className="flex items-start gap-3 bg-warning/5 border border-warning/20 rounded-lg p-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning mt-0.5 shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
            </svg>
            <div>
              <p className="text-sm font-medium text-warning">Engine Offline</p>
              <p className="text-xs text-text-muted mt-0.5">
                The AI engine is not responding. Analysis will use direct LLM calls (no evidence grounding or claim validation).
                Make sure the engine service is running on the configured URL.
              </p>
            </div>
          </div>
        )}

        {data && data.engine.available && !data.engine.pipelineReady && (
          <div className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-primary">Pipeline Building</p>
              <p className="text-xs text-text-muted mt-0.5">
                The engine is online but the knowledge index is still being built (~4s). Analysis requests will queue until ready.
              </p>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

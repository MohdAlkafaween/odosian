import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AnalyzeResult, EnhanceResult, GenerateResult } from "@/lib/ai";

export type TabType =
  | "analyze" | "enhance" | "generate" | "simulate" | "batch_analyze" | "batch_enhance"
  // "Page" tabs — unlike the AI-result types above, these don't carry a
  // fetched-once `result`; they wrap a live, self-fetching view component
  // (the same one the real route renders) so opening one is just "show this
  // page here instead of navigating away." status is always "completed" the
  // instant one of these is created — there's no running/failed phase.
  | "rule_detail" | "mitre";
export type TabStatus = "running" | "completed" | "failed";

export const isPageTabType = (type: TabType) => type === "rule_detail" || type === "mitre";

export interface SimulateResult {
  scenario: string;
  prerequisites: string[];
  steps: { stepNumber: number; action: string; command: string; expectedOutput: string; notes: string }[];
  expectedAlerts: string[];
  validationSteps: string[];
  cleanupCommands: string[];
}

export interface AITab {
  id: string;
  type: TabType;
  title: string;
  ruleId?: string;
  ruleName?: string;
  batchId?: string;
  status: TabStatus;
  statusMessage?: string;
  result?: AnalyzeResult | (EnhanceResult & { inputQuery?: string }) | GenerateResult | SimulateResult;
  error?: string;
  validationRejection?: { category: string; issues: string[]; structuredIssues?: { code: string; severity: string; category: string; path: string; message: string }[] };
  useEngine?: boolean;
  createdAt: number;
}

interface TabState {
  tabs: AITab[];
  activeTabId: string | null;
  addTab: (tab: Omit<AITab, "id" | "createdAt">) => string;
  updateTab: (id: string, updates: Partial<AITab>) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  getTab: (id: string) => AITab | undefined;
}

let tabCounter = 0;

const isBatchType = (type: TabType) => type === "batch_analyze" || type === "batch_enhance";

// Persisted tabs are kept forever unless closed, so this bounds how much
// localStorage grows — each completed tab carries a full AI result (query
// text, findings, suggestions, MITRE mappings...), and those aren't small.
// Oldest non-running tabs are evicted first; a tab still running (only
// possible for a batch — see onRehydrateStorage below) is never evicted.
const MAX_PERSISTED_TABS = 15;

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,

      addTab: (tab) => {
        const id = `tab-${++tabCounter}-${Date.now()}`;
        const newTab: AITab = { ...tab, id, createdAt: Date.now() };
        set((state) => {
          let tabs = [...state.tabs, newTab];
          if (tabs.length > MAX_PERSISTED_TABS) {
            const byAge = [...tabs].sort((a, b) => a.createdAt - b.createdAt);
            while (tabs.length > MAX_PERSISTED_TABS) {
              const victim = byAge.find((t) => t.id !== id && t.status !== "running");
              if (!victim) break;
              tabs = tabs.filter((t) => t.id !== victim.id);
              byAge.splice(byAge.indexOf(victim), 1);
            }
          }
          return { tabs, activeTabId: id };
        });
        return id;
      },

      updateTab: (id, updates) =>
        set((state) => ({
          tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        })),

      removeTab: (id) =>
        set((state) => {
          const filtered = state.tabs.filter((t) => t.id !== id);
          const newActive =
            state.activeTabId === id
              ? filtered.length > 0
                ? filtered[filtered.length - 1].id
                : null
              : state.activeTabId;
          return { tabs: filtered, activeTabId: newActive };
        }),

      setActiveTab: (id) => set({ activeTabId: id }),

      getTab: (id) => get().tabs.find((t) => t.id === id),
    }),
    {
      name: "odosian-ai-tabs",
      storage: createJSONStorage(() => localStorage),
      // A batch tab's actual work happens server-side (processBatch keeps
      // running, and survives its own pod restarts via
      // resumeInterruptedBatches) — BatchProgress re-fetches
      // /api/analysis/batch/[id] the moment this tab remounts, so its
      // "running" status here is just a placeholder until that real check
      // lands and is safe to leave alone.
      //
      // A single analyze/enhance/generate/simulate tab has no such job to
      // reconnect to — it was one in-flight HTTP request tied to the page
      // that no longer exists, so there's no way to recover its real
      // outcome. Marked failed on rehydration instead of spinning forever
      // on a promise that will never resolve.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.tabs = state.tabs.map((t) =>
          t.status === "running" && !isBatchType(t.type)
            ? { ...t, status: "failed" as const, error: "Lost connection to this run when the page reloaded — try again." }
            : t
        );
      },
    }
  )
);

import { create } from "zustand";
import type { AnalyzeResult, EnhanceResult, GenerateResult } from "@/lib/ai";

export type TabType = "analyze" | "enhance" | "generate" | "simulate";
export type TabStatus = "running" | "completed" | "failed";

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
  status: TabStatus;
  statusMessage?: string;
  result?: AnalyzeResult | (EnhanceResult & { inputQuery?: string }) | GenerateResult | SimulateResult;
  error?: string;
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

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) => {
    const id = `tab-${++tabCounter}-${Date.now()}`;
    const newTab: AITab = { ...tab, id, createdAt: Date.now() };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
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
}));

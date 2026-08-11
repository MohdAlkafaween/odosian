"use client";

import { useTabStore, type TabType } from "@/stores/tabs";

const TITLE_PREFIX: Record<string, string> = {
  analyze: "Analyze",
  enhance: "Enhance",
  post_enhance: "Post-Enhancement",
  generate: "Generate",
  feedback: "Simulation",
  simulate: "Simulation",
};

// post_enhance records are structurally an AnalyzeResult (score/rating/
// findings/...) and feedback records are structurally a SimulateResult —
// TabType only has one renderer for each of those shapes, not a separate
// one per analysisType, so both collapse onto the tab type that actually
// matches their result shape.
function toTabType(analysisType: string): TabType {
  if (analysisType === "post_enhance") return "analyze";
  if (analysisType === "feedback") return "simulate";
  return (["analyze", "enhance", "generate", "simulate"].includes(analysisType) ? analysisType : "analyze") as TabType;
}

// Every page that links to a single AI result (History's "View", a rule's
// own AI history "View Full Details", the dashboard's Recent Activity feed)
// used to navigate to the static /dashboard/analysis/[id] page. That page
// is read-only — the interactive tab view (real Apply/Deploy buttons,
// Analyze After Enhancement, etc.) only ever existed for results reached
// via a batch's View button. This makes any analysis result open as that
// same interactive tab, from anywhere.
export function useOpenAnalysisTab() {
  const { addTab, updateTab } = useTabStore();

  return async (analysisId: string, analysisType: string, ruleId?: string, ruleTitle?: string) => {
    const tabId = addTab({
      type: toTabType(analysisType),
      title: `${TITLE_PREFIX[analysisType] || "Analysis"}${ruleTitle ? `: ${ruleTitle}` : ""}`,
      ruleId,
      ruleName: ruleTitle,
      status: "running",
      statusMessage: "Loading result...",
    });
    try {
      const res = await fetch(`/api/analysis/${analysisId}`);
      const data = await res.json();
      if (res.ok) {
        updateTab(tabId, { status: "completed", result: data.analysis });
      } else {
        updateTab(tabId, { status: "failed", error: data.error || "Failed to load result" });
      }
    } catch {
      updateTab(tabId, { status: "failed", error: "Failed to load result" });
    }
  };
}

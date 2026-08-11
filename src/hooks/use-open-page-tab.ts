"use client";

import { useTabStore } from "@/stores/tabs";

// Opens a rule's detail view or the MITRE map as a tab instead of a real
// page navigation — same idea as useOpenAnalysisTab, for the "big rework"
// half of that ask: not just AI results, whole pages too. Reuses an
// existing tab for the same rule/page instead of stacking duplicates, the
// way a browser or an IDE wouldn't open a second tab for a file you already
// have open — clicking the same rule twice just refocuses it.
export function useOpenPageTab() {
  const { tabs, addTab, setActiveTab } = useTabStore();

  const openRule = (ruleId: string, ruleTitle: string) => {
    const existing = tabs.find((t) => t.type === "rule_detail" && t.ruleId === ruleId);
    if (existing) {
      setActiveTab(existing.id);
      return;
    }
    addTab({
      type: "rule_detail",
      title: ruleTitle,
      ruleId,
      ruleName: ruleTitle,
      status: "completed",
    });
  };

  const openMitre = () => {
    const existing = tabs.find((t) => t.type === "mitre");
    if (existing) {
      setActiveTab(existing.id);
      return;
    }
    addTab({
      type: "mitre",
      title: "MITRE ATT&CK",
      status: "completed",
    });
  };

  return { openRule, openMitre };
}

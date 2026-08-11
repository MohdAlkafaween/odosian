"use client";

import { useTabStore, type TabType } from "@/stores/tabs";

const TYPE_ICONS: Record<string, string> = {
  analyze: "M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z",
  enhance: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  generate: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  simulate: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z",
  batch_analyze: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  batch_enhance: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z",
  rule_detail: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z M14 2v6h6",
  mitre: "M3 3h8v8H3zM13 3h8v8h-8zM3 13h8v8H3zM13 13h8v8h-8z",
};

const TYPE_COLORS: Record<string, string> = {
  analyze: "text-primary",
  enhance: "text-accent",
  generate: "text-[#A78BFA]",
  simulate: "text-danger",
  batch_analyze: "text-primary",
  batch_enhance: "text-accent",
  rule_detail: "text-[#4CBDFA]",
  mitre: "text-[#A78BFA]",
};

export function AITabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabStore();

  if (tabs.length === 0) return null;

  return (
    <div className="bg-surface border-b border-border shrink-0">
      <div className="flex items-center overflow-x-auto scrollbar-thin px-2 gap-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`group flex items-center gap-2 px-3 py-2 cursor-pointer border-b-2 transition-all min-w-0 max-w-[240px] shrink-0 ${
                isActive
                  ? "border-primary bg-bg"
                  : "border-transparent hover:bg-surface-light"
              }`}
              onClick={() => setActiveTab(isActive ? null : tab.id)}
            >
              {tab.status === "running" ? (
                <span className="shrink-0 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : tab.status === "failed" ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-danger shrink-0">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className={`shrink-0 ${TYPE_COLORS[tab.type]}`}>
                  <path d={TYPE_ICONS[tab.type]} />
                </svg>
              )}
              <span className={`text-xs font-medium truncate ${isActive ? "text-text" : "text-text-muted"}`}>
                {tab.title}
              </span>
              {tab.status === "completed" && (
                <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                className="shrink-0 ml-auto p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-border/50 transition-all"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-text-muted hover:text-text">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

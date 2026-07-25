"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

interface PaletteItem {
  label: string;
  href: string;
  section: string;
  keywords?: string;
  adminOnly?: boolean;
}

const ITEMS: PaletteItem[] = [
  { label: "Dashboard", href: "/dashboard", section: "Navigation", keywords: "home overview" },
  { label: "Detection Rules", href: "/dashboard/rules", section: "Navigation", keywords: "rules list" },
  { label: "Shield Categories", href: "/dashboard/projects", section: "Navigation", keywords: "project category categories" },
  { label: "AI Analysis", href: "/dashboard/analysis", section: "Navigation", keywords: "analyze score" },
  { label: "Templates", href: "/dashboard/templates", section: "Navigation", keywords: "template" },
  { label: "MITRE ATT&CK", href: "/dashboard/mitre", section: "Navigation", keywords: "mitre tactics techniques" },
  { label: "Audit Logs", href: "/dashboard/audit", section: "Navigation", keywords: "audit log" },
  { label: "Users", href: "/dashboard/users", section: "Navigation", keywords: "user manage", adminOnly: true },
  { label: "Settings", href: "/dashboard/settings", section: "Navigation", keywords: "settings config" },
  { label: "Profile", href: "/dashboard/profile", section: "Navigation", keywords: "profile password account" },
  { label: "Create New Rule", href: "/dashboard/rules/new", section: "Quick Actions", keywords: "create new rule add" },
  { label: "Run Analysis", href: "/dashboard/analysis", section: "Quick Actions", keywords: "analyze run score" },
  { label: "Analysis History", href: "/dashboard/analysis/history", section: "Quick Actions", keywords: "history past" },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = ITEMS.filter((item) => {
    if (item.adminOnly && user?.role !== "ADMIN") return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      item.label.toLowerCase().includes(q) ||
      item.section.toLowerCase().includes(q) ||
      (item.keywords && item.keywords.includes(q))
    );
  });

  const sections = [...new Set(filtered.map((i) => i.section))];
  const ordered = sections.flatMap((s) => filtered.filter((i) => i.section === s));

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, ordered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && ordered[activeIndex]) {
        e.preventDefault();
        navigate(ordered[activeIndex].href);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, ordered, activeIndex, onClose, navigate]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or jump to..."
            className="flex-1 py-3.5 bg-transparent text-text text-sm outline-none placeholder:text-text-muted"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-surface-light border border-border text-[10px] text-text-muted font-mono">
            ESC
          </kbd>
        </div>
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No results found</p>
          ) : (
            sections.map((section) => (
              <div key={section}>
                <p className="text-[10px] uppercase tracking-wider text-text-muted font-semibold px-2 pt-2 pb-1">
                  {section}
                </p>
                {filtered
                  .filter((i) => i.section === section)
                  .map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    return (
                      <button
                        key={item.href}
                        data-index={idx}
                        onClick={() => navigate(item.href)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                          idx === activeIndex
                            ? "bg-primary/10 text-primary"
                            : "text-text-secondary hover:bg-surface-light hover:text-text"
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[10px] text-text-muted">
          <span><kbd className="px-1 py-0.5 rounded bg-surface-light border border-border font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-light border border-border font-mono">↵</kbd> open</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-light border border-border font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

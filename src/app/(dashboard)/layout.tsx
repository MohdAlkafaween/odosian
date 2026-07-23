"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { NotificationBell } from "@/components/notification-bell";
import { useAuthStore } from "@/stores/auth";
import { useToastStore } from "@/stores/toast";
import { useThemeStore } from "@/stores/theme";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { clearAuth } = useAuthStore();
  const { addToast } = useToastStore();
  const { initTheme } = useThemeStore();
  const router = useRouter();

  useEffect(() => { initTheme(); }, [initTheme]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      clearAuth();
      addToast("info", "Signed out successfully");
      router.push("/login");
    } catch {
      addToast("error", "Failed to sign out");
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen((v) => !v);
      return;
    }

    if (e.key === "?" && !paletteOpen) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    }
  }, [paletteOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-bg">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-surface border-b border-border flex items-center justify-between px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-text-muted hover:text-text p-1 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#4CBDFA">
              <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" />
            </svg>
            <span className="text-sm font-extrabold tracking-[3px] text-primary">ODOSIAN</span>
          </div>
          <div className="w-8" />
        </div>

        <Sidebar mobile open={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="hidden md:flex h-14 border-b border-border items-center justify-between px-6 bg-surface shrink-0">
            <Breadcrumb />
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="px-3.5 py-2 bg-bg border border-border rounded-lg text-sm text-text-muted flex items-center gap-2 hover:border-primary transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>
                <span>⌘K</span>
              </button>
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-text-muted hover:bg-surface-light hover:text-danger transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                </svg>
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-bg hex-bg-subtle">
            <div className="p-6 pt-20 md:pt-6 max-w-[1400px] mx-auto animate-fade-in-up">
              <div className="md:hidden mb-4">
                <Breadcrumb />
              </div>
              {children}
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </AuthGuard>
  );
}

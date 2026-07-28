"use client";

import { create } from "zustand";

export type ThemeId = "light" | "obsidian" | "phosphor" | "sentinel";

interface ThemeColors {
  bg: string;
  surface: string;
  surfaceLight: string;
  border: string;
  borderFocus: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  success: string;
  accent: string;
  danger: string;
  warning: string;
  text: string;
  textSecondary: string;
  textMuted: string;
}

export interface ThemeDef {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const THEMES: ThemeDef[] = [
  {
    id: "light",
    name: "Light",
    description: "Clean light interface",
    colors: {
      bg: "#F8FAFC",
      surface: "#FFFFFF",
      surfaceLight: "#F1F5F9",
      border: "#E2E8F0",
      borderFocus: "#3B82F6",
      primary: "#2563EB",
      primaryHover: "#1D4ED8",
      primaryMuted: "#2563EB1A",
      success: "#16A34A",
      accent: "#0891B2",
      danger: "#DC2626",
      warning: "#CA8A04",
      text: "#0F172A",
      textSecondary: "#475569",
      textMuted: "#94A3B8",
    },
  },
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Pure black, high contrast",
    colors: {
      bg: "#000000",
      surface: "#0A0A0A",
      surfaceLight: "#141414",
      border: "#1C1C1C",
      borderFocus: "#3B82F6",
      primary: "#3B82F6",
      primaryHover: "#2563EB",
      primaryMuted: "#3B82F61A",
      success: "#22C55E",
      accent: "#6366F1",
      danger: "#EF4444",
      warning: "#F59E0B",
      text: "#F5F5F5",
      textSecondary: "#A3A3A3",
      textMuted: "#525252",
    },
  },
  {
    id: "phosphor",
    name: "Phosphor",
    description: "Terminal green on dark",
    colors: {
      bg: "#0A100E",
      surface: "#0F1A16",
      surfaceLight: "#162420",
      border: "#1B3029",
      borderFocus: "#22C55E",
      primary: "#22C55E",
      primaryHover: "#16A34A",
      primaryMuted: "#22C55E1A",
      success: "#4ADE80",
      accent: "#2DD4BF",
      danger: "#F87171",
      warning: "#FACC15",
      text: "#E8F5E9",
      textSecondary: "#86EFAC",
      textMuted: "#4A7C5C",
    },
  },
  {
    id: "sentinel",
    name: "Sentinel",
    description: "Warm amber tactical theme",
    colors: {
      bg: "#0F0E0A",
      surface: "#171510",
      surfaceLight: "#211E17",
      border: "#2E2920",
      borderFocus: "#F59E0B",
      primary: "#F59E0B",
      primaryHover: "#D97706",
      primaryMuted: "#F59E0B1A",
      success: "#84CC16",
      accent: "#FB923C",
      danger: "#EF4444",
      warning: "#FBBF24",
      text: "#FFF8E7",
      textSecondary: "#BDB098",
      textMuted: "#6B6356",
    },
  },
];

const THEME_MAP = new Map(THEMES.map((t) => [t.id, t]));

function applyTheme(theme: ThemeDef | undefined) {
  if (!theme) return;
  const root = document.documentElement;
  const c = theme.colors;
  root.style.setProperty("--color-bg", c.bg);
  root.style.setProperty("--color-surface", c.surface);
  root.style.setProperty("--color-surface-light", c.surfaceLight);
  root.style.setProperty("--color-border", c.border);
  root.style.setProperty("--color-border-focus", c.borderFocus);
  root.style.setProperty("--color-primary", c.primary);
  root.style.setProperty("--color-primary-hover", c.primaryHover);
  root.style.setProperty("--color-primary-muted", c.primaryMuted);
  root.style.setProperty("--color-success", c.success);
  root.style.setProperty("--color-accent", c.accent);
  root.style.setProperty("--color-danger", c.danger);
  root.style.setProperty("--color-warning", c.warning);
  root.style.setProperty("--color-text", c.text);
  root.style.setProperty("--color-text-secondary", c.textSecondary);
  root.style.setProperty("--color-text-muted", c.textMuted);
  root.setAttribute("data-theme", theme.id === "light" ? "light" : "dark");
}

interface ThemeState {
  themeId: ThemeId;
  setTheme: (id: ThemeId) => void;
  initTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeId: "obsidian",
  setTheme: (id) => {
    const theme = THEME_MAP.get(id);
    if (!theme) return;
    localStorage.setItem("odosian-theme", id);
    applyTheme(theme);
    set({ themeId: id });
  },
  initTheme: () => {
    const saved = localStorage.getItem("odosian-theme") as ThemeId | null;
    const id = saved && THEME_MAP.has(saved) ? saved : "obsidian";
    const theme = THEME_MAP.get(id);
    if (theme) {
      applyTheme(theme);
      set({ themeId: id });
    }
  },
}));

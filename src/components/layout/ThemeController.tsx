"use client";

import { useEffect } from "react";
import { SystemBars, SystemBarsStyle } from "@capacitor/core";
import { useSettingsStore } from "@/store/useSettingsStore";
import { isNativeApp } from "@/lib/native/files";
import type { AppTheme } from "@/types/workout";

/** Mirrors the theme choice for THEME_SCRIPT, which reads it before the first paint. */
export const THEME_KEY = "abot.theme";

/**
 * Runs in <head> before the page paints: sets data-theme from the last saved choice, so a light
 * page never flashes dark first. Kept tiny and dependency-free.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}")||"system";var l=t==="light"||(t==="system"&&matchMedia("(prefers-color-scheme: light)").matches);document.documentElement.dataset.theme=l?"light":"dark"}catch(e){}`;

const BAR = { dark: "#09090b", light: "#f4f4f2" } as const;

function resolve(theme: AppTheme): "dark" | "light" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Applies Settings > Theme: the page tokens, the browser bar colour, Android's status bar icons. */
export function ThemeController() {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Without storage the first paint uses the phone's mode; the setting still applies here.
    }
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => {
      const mode = resolve(theme);
      document.documentElement.dataset.theme = mode;
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BAR[mode]);
      // DARK = light icons for a dark page.
      if (isNativeApp()) void SystemBars.setStyle({ style: mode === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    };
    apply();
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  return null;
}

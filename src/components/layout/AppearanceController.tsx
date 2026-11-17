"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { accentTokens } from "@/lib/accent";
import { ACCENT_KEY, STYLE_KEY } from "./ThemeController";

/**
 * Applies Settings > General > Appearance: the primary colour as --brand* tokens on <html>
 * (globals.css derives every accent from them) and the component style as data-style. Both are
 * mirrored to localStorage for the pre-paint script, so the next start opens in them at once.
 */
export function AppearanceController() {
  const accent = useSettingsStore((s) => s.accentColor);
  const style = useSettingsStore((s) => s.componentStyle);

  useEffect(() => {
    const tokens = accentTokens(accent);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
    try {
      localStorage.setItem(ACCENT_KEY, JSON.stringify(tokens));
    } catch {
      // Without storage the next start paints Volt for a moment; the colour still applies here.
    }
  }, [accent]);

  useEffect(() => {
    document.documentElement.dataset.style = style;
    try {
      localStorage.setItem(STYLE_KEY, style);
    } catch {
      // As above: only the first paint is affected.
    }
  }, [style]);

  return null;
}

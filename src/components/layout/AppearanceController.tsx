"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { accentTokens } from "@/lib/accent";
import { logoTokens } from "@/lib/app-icons";
import { applyLauncherIcon } from "@/lib/native/app-icon";
import { isNativeApp } from "@/lib/native/files";
import { ACCENT_KEY, STYLE_KEY } from "./ThemeController";

/**
 * Applies Settings > General > Appearance: the primary colour as --brand* tokens on <html>
 * (globals.css derives every accent from them), the app icon's colours as --logo-*, the launcher
 * icon in the Android app, and the component style as data-style. Colours and style are
 * mirrored to localStorage for the pre-paint script, so the next start opens in them at once.
 */
export function AppearanceController() {
  const accent = useSettingsStore((s) => s.accentColor);
  const style = useSettingsStore((s) => s.componentStyle);
  const icon = useSettingsStore((s) => s.appIcon);

  useEffect(() => {
    const tokens = { ...accentTokens(accent), ...logoTokens(icon) };
    const root = document.documentElement;
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v);
    try {
      localStorage.setItem(ACCENT_KEY, JSON.stringify(tokens));
    } catch {
      // Without storage the next start paints Volt for a moment; the colour still applies here.
    }
  }, [accent, icon]);

  // The logo outside the page: the browser tab's icon on the web, the launcher icon in the app.
  useEffect(() => {
    if (isNativeApp()) {
      void applyLauncherIcon(icon);
      return;
    }
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]') ?? document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (link && icon !== "classic") link.href = `/app-icons/${icon}.svg`;
  }, [icon]);

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

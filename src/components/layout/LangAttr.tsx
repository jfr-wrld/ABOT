"use client";

import { useEffect } from "react";
import { LANG_KEY, loadIndonesian, resolveLang, useLang } from "@/i18n";
import { useHydration } from "@/store/hydration";
import { useSettingsStore } from "@/store/useSettingsStore";

/**
 * Keeps <html lang> on the chosen language, for screen readers and hyphenation. Also loads the
 * Indonesian dictionary when it is chosen, and remembers the choice for the next start.
 */
export function LangAttr() {
  const lang = useLang();
  const setting = useSettingsStore((s) => s.language);
  const hydrated = useHydration((s) => s.hydrated);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    if (resolveLang(setting) === "id") void loadIndonesian();
    // Before hydration the setting is the default, not the saved choice.
    if (!hydrated) return;
    try {
      // "auto" is the default: nothing to remember, as on a fresh install.
      if (setting === "auto") localStorage.removeItem(LANG_KEY);
      else localStorage.setItem(LANG_KEY, setting);
    } catch {}
  }, [setting, hydrated]);
  return null;
}

"use client";

import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { readDeviceHints, resolveEffects } from "@/lib/effects";

/** Settings > Visual effects, resolved for this phone ("full" or "lite"). */
export function useEffectsMode(): "full" | "lite" {
  const choice = useSettingsStore((s) => s.visualEffects);
  // Device hints are read after mount (they do not exist during the static render).
  const [hints, setHints] = useState<ReturnType<typeof readDeviceHints> | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setHints(readDeviceHints()), 0);
    return () => window.clearTimeout(id);
  }, []);
  return resolveEffects(choice, hints ?? {});
}

/** Puts the mode on <html data-effects>, where the CSS swaps the glass for solid surfaces. */
export function EffectsController() {
  const mode = useEffectsMode();
  useEffect(() => {
    document.documentElement.dataset.effects = mode;
  }, [mode]);
  return null;
}

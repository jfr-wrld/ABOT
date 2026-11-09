"use client";

import { useEffect, useRef } from "react";
import { isNativeApp } from "./files";

/**
 * Calls `fn` when the user comes back to ABOT: Android's resume event in the app (its WebView
 * never fires visibilitychange), visibilitychange in a browser. For re-reading anything the
 * user may have changed in the phone's settings meanwhile.
 */
export function useAppResumed(fn: () => void): void {
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });

  useEffect(() => {
    if (!isNativeApp()) {
      const onVisible = () => document.visibilityState === "visible" && latest.current();
      document.addEventListener("visibilitychange", onVisible);
      return () => document.removeEventListener("visibilitychange", onVisible);
    }
    let remove: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("resume", () => latest.current());
      if (cancelled) void h.remove();
      else remove = () => void h.remove();
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
}

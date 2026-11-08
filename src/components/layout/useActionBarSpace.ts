"use client";

import { useEffect } from "react";

/**
 * A page with its own bottom action bar reports the bar's height here, so the workout capsule
 * sits above it instead of covering its buttons. Cleared when the page goes.
 */
export function useActionBarSpace(px: number): void {
  useEffect(() => {
    document.documentElement.style.setProperty("--action-bar", `${px}px`);
    return () => document.documentElement.style.setProperty("--action-bar", "0px");
  }, [px]);
}

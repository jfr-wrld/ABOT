"use client";

import { useEffect, useState } from "react";
import { useAppActive } from "./native/app-active";

/**
 * Re-renders on an interval so elapsed/remaining times stay live. Stops while ABOT is in the
 * background, where nobody sees the clock, and catches up once on return.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  const active = useAppActive();
  useEffect(() => {
    if (!enabled || !active) return;
    // Catch up at once on return, then tick.
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs, enabled, active]);
  return now;
}

"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A save button that says it worked: `saved` is true for 1.2 s after `flash()`, long enough to
 * read a check, short enough not to block the next entry.
 */
export function useSavedFlash(ms = 1200): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);
  const flash = () => {
    if (timer.current) window.clearTimeout(timer.current);
    setSaved(true);
    timer.current = window.setTimeout(() => setSaved(false), ms);
  };
  return [saved, flash];
}

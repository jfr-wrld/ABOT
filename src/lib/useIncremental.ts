"use client";

import { useEffect, useState } from "react";

/**
 * Long lists rendered a page at a time: the first `page` rows at once, the next page when the
 * sentinel element comes near the screen. The library holds over 1,000 exercises; drawing every
 * row (with its photo) each time the picker opened made it slow on phones.
 * `resetKey` (the search and filters) starts again from the first page.
 */
export function useIncremental(total: number, resetKey: string, page = 60) {
  const [shown, setShown] = useState(page);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setShown(page);
  }
  // A callback ref (the state setter), so the observer follows the sentinel as it mounts.
  const [el, sentinel] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!el || shown >= total || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + page);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [el, shown, total, page]);
  return [shown, shown < total, sentinel] as const;
}

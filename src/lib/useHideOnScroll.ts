"use client";

import { useEffect, useState } from "react";

/** Scroll this far down in one go before the control hides; less is a jitter of the finger. */
const DOWN_BY = 12;
/** Near the top of the page the control always shows. */
const TOP = 120;

/**
 * True while the page is being scrolled down past its first screenful, so a floating control
 * can step aside from the list; false again on any scroll up, near the top, or at the bottom.
 * Reads the scroll once per frame.
 */
export function useHideOnScroll(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    let frame = 0;
    const read = () => {
      frame = 0;
      const y = window.scrollY;
      const atBottom = y + window.innerHeight >= document.documentElement.scrollHeight - 4;
      if (y < TOP || atBottom || y < last) setHidden(false);
      else if (y - last >= DOWN_BY) setHidden(true);
      else return; // a small move down: keep the last position as the reference
      last = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return hidden;
}

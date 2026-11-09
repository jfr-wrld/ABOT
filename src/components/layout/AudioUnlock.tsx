"use client";

import { useEffect } from "react";
import { unlockAudio } from "@/lib/sound-effects";

/**
 * Browsers start Web Audio suspended until a tap. The rest-over beep is fired by a timer, not a
 * tap, so the first touch anywhere unlocks audio for it, even with tap sounds switched off.
 */
export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return null;
}

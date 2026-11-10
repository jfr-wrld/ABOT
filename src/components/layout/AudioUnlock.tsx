"use client";

import { useEffect } from "react";
import { suspendAudio, unlockAudio } from "@/lib/sound-effects";
import { onAppPause } from "@/lib/native/app-active";

/**
 * Browsers start Web Audio suspended until a tap. The rest-over beep is fired by a timer, not a
 * tap, so the first touch anywhere unlocks audio for it, even with tap sounds switched off.
 * In the background the context is suspended: the rest-over alarm there is native.
 */
export function AudioUnlock() {
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    const offPause = onAppPause(suspendAudio);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      offPause();
    };
  }, []);
  return null;
}

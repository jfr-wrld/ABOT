import { isNativeApp } from "./files";

/**
 * Vibrates in a pattern of [on, off, on, ...] milliseconds. Browsers use the Vibration API (and
 * only after a tap on the page); the Android app goes through @capacitor/haptics, since the
 * WebView ignores navigator.vibrate.
 */
export function buzz(pattern: number[]): void {
  if (isNativeApp()) {
    void import("@capacitor/haptics").then(({ Haptics }) => {
      let at = 0;
      pattern.forEach((ms, i) => {
        if (i % 2 === 0) setTimeout(() => void Haptics.vibrate({ duration: ms }), at);
        at += ms;
      });
    });
    return;
  }
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  // Browsers refuse vibration until the page has been tapped.
  if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive === false) return;
  navigator.vibrate(pattern);
}

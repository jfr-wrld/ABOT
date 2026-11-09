import { buzz } from "./native/haptics";

/**
 * Graduated vibration patterns (Phase 2 spec). `buzz` uses Capacitor Haptics in the Android app
 * and navigator.vibrate in a browser, and does nothing where neither exists.
 */

/** A light touch for micro buttons. */
export function hapticTick(): void {
  buzz([8]);
}

/** A set ticked off. */
export function hapticLock(): void {
  buzz([15, 30, 25]);
}

/** A new personal record. */
export function hapticPR(): void {
  buzz([30, 40, 60, 40, 100]);
}

import { useSettingsStore } from "@/store/useSettingsStore";
import { hapticLock, hapticPR, hapticTick } from "./haptics";
import { buzz } from "./native/haptics";
import { playMechanicalTick, playPRUnlocked, playRestTimerZero, playSetComplete } from "./sound-effects";

/**
 * Sound plus vibration for each tactile moment, behind Settings > Workout > Sounds & vibration
 * (the rest-over alarm follows Rest alert instead). Call these from the tap itself.
 */
const on = () => useSettingsStore.getState().tapFeedback;

export const feedback = {
  /** Steppers, filter chips, Story Studio layouts. */
  tick(): void {
    if (!on()) return;
    playMechanicalTick();
    hapticTick();
  },
  /** A set ticked off. */
  setComplete(): void {
    if (!on()) return;
    playSetComplete();
    hapticLock();
  },
  /** A set that broke a record. */
  pr(): void {
    if (!on()) return;
    playPRUnlocked();
    hapticPR();
  },
  /** Rest timer reached zero; the caller checks Rest alert. */
  restZero(): void {
    playRestTimerZero();
    // Longer than the tap patterns: it has to reach a lifter who is not looking.
    buzz([200, 100, 200]);
  },
};

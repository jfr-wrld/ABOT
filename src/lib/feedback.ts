import { useSettingsStore } from "@/store/useSettingsStore";
import { hapticLock, hapticPR, hapticTick } from "./haptics";
import { buzz } from "./native/haptics";
import {
  playMechanicalTick,
  playPRUnlocked,
  playProUnlocked,
  playRestCountdown,
  playRestTimerZero,
  playSetComplete,
  playWorkoutComplete,
  playWorkoutStart,
} from "./sound-effects";

/**
 * Sound plus vibration for each tactile moment, behind Settings > Workout > Sounds & vibration
 * (the rest countdown and rest-over alarm follow Rest alert instead). Call these from the tap itself.
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
  /** A purchase landed: the celebration sting, with a pulse on the plate's impact (0.42 s). */
  subscribed(): void {
    if (!on()) return;
    playProUnlocked();
    setTimeout(() => buzz([60, 50, 30, 50, 30, 90, 120]), 420);
  },
  /** A workout started. */
  start(): void {
    if (!on()) return;
    playWorkoutStart();
    buzz([15, 40, 15]);
  },
  /** The finish summary opened; `record` when a record fell in the workout. */
  finish(record: boolean): void {
    if (!on()) return;
    playWorkoutComplete(record);
    buzz(record ? [30, 60, 30, 60, 60] : [30]);
  },
  /** 3, 2, 1 seconds of rest left; the caller checks Rest alert. Sound only. */
  restCountdown(): void {
    playRestCountdown();
  },
  /** Rest timer reached zero; the caller checks Rest alert. */
  restZero(): void {
    playRestTimerZero();
    // Longer than the tap patterns: it has to reach a lifter who is not looking.
    buzz([200, 100, 200]);
  },
};

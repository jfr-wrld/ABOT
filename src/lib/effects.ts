import type { VisualEffects } from "@/types/workout";

/** What the phone tells about itself, as far as the browser lets it. */
export interface DeviceHints {
  /** navigator.hardwareConcurrency: CPU cores. */
  cores?: number;
  /** navigator.deviceMemory: RAM in GB, rounded down to a power of two (Chromium only). */
  memoryGb?: number;
  /** navigator.connection.saveData: the owner asked to save data. */
  saveData?: boolean;
  /** prefers-reduced-transparency or prefers-reduced-motion is on. */
  reduced?: boolean;
}

/**
 * Settings > Visual effects resolved for this phone. "full" keeps the glass dock and every
 * animation; "lite" drops the glass blur and movement (fades stay). "auto" is lite on modest
 * phones: 4 cores or fewer, 4 GB of memory or less, Data Saver, or reduced transparency/motion.
 * Unknown hints count as capable, so a phone is not downgraded on a guess.
 */
export function resolveEffects(choice: VisualEffects, hints: DeviceHints): "full" | "lite" {
  if (choice !== "auto") return choice;
  const modest =
    (hints.cores !== undefined && hints.cores <= 4) ||
    (hints.memoryGb !== undefined && hints.memoryGb <= 4) ||
    hints.saveData === true ||
    hints.reduced === true;
  return modest ? "lite" : "full";
}

/** Reads the hints from the running browser. */
export function readDeviceHints(): DeviceHints {
  if (typeof navigator === "undefined") return {};
  // An automated browser (the e2e suite) reports the test machine, not a phone: no hints, so
  // Auto stays Full and the tests see the full interface.
  if (navigator.webdriver) return {};
  const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const media = (q: string) => typeof matchMedia === "function" && matchMedia(q).matches;
  return {
    cores: n.hardwareConcurrency || undefined,
    memoryGb: n.deviceMemory,
    saveData: n.connection?.saveData,
    reduced: media("(prefers-reduced-transparency: reduce)") || media("(prefers-reduced-motion: reduce)"),
  };
}

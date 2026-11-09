import { create } from "zustand";
import { dayKey } from "@/lib/bodyweight";

/**
 * Today's protein and water, ticked off with one tap from the phase card. Per device and per
 * day, like a paper tally: it starts again at zero the next day and is not training data.
 */
interface FuelPacer {
  day: string;
  proteinG: number;
  waterMl: number;
  add(patch: { proteinG?: number; waterMl?: number }): void;
  reset(): void;
}

const KEY = "abot.fuelPacer";
const empty = (day: string) => ({ day, proteinG: 0, waterMl: 0 });

function load(): Pick<FuelPacer, "day" | "proteinG" | "waterMl"> {
  const today = dayKey(Date.now());
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<FuelPacer> | null;
    if (v && v.day === today) return { day: today, proteinG: Math.max(0, Number(v.proteinG) || 0), waterMl: Math.max(0, Number(v.waterMl) || 0) };
  } catch {
    // Unreadable: start from zero.
  }
  return empty(today);
}

function save(s: Pick<FuelPacer, "day" | "proteinG" | "waterMl">) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Without storage the tally lasts until the app closes.
  }
}

export const useFuelPacer = create<FuelPacer>((set, get) => ({
  ...(typeof window === "undefined" ? empty("") : load()),
  add({ proteinG = 0, waterMl = 0 }) {
    const today = dayKey(Date.now());
    const base = get().day === today ? get() : empty(today);
    const next = { day: today, proteinG: Math.max(0, base.proteinG + proteinG), waterMl: Math.max(0, base.waterMl + waterMl) };
    set(next);
    save(next);
  },
  reset() {
    const next = empty(dayKey(Date.now()));
    set(next);
    save(next);
  },
}));

/** Today's tally, read so a value kept from yesterday shows as zero. */
export function useTodayFuel(now: number): { proteinG: number; waterMl: number } {
  const { day, proteinG, waterMl } = useFuelPacer();
  return day === dayKey(now) ? { proteinG, waterMl } : { proteinG: 0, waterMl: 0 };
}

import { dayOf, isWater, proteinEntry, useFoodLog, waterEntry } from "./useFoodLog";

/**
 * Today's protein and water. Both come from the food log, the one place food is counted: the
 * +25 g and +0.5 L taps on the phase card add entries to it, so a logged meal and a tap never
 * count twice, and water is backed up with the rest of the day.
 */
export function useTodayFuel(now: number): { proteinG: number; waterMl: number } {
  const today = dayOf(now);
  const proteinG = useFoodLog((s) => Math.round(s.entries.reduce((n, e) => (e.day === today ? n + e.protein : n), 0)));
  const waterMl = useFoodLog((s) => s.entries.reduce((n, e) => (e.day === today && isWater(e) ? n + (e.waterMl ?? 0) : n), 0));
  return { proteinG, waterMl };
}

export const addProtein = (grams: number) => useFoodLog.getState().add([proteinEntry(grams)]);
export const addWater = (ml: number) => useFoodLog.getState().add([waterEntry(ml)]);

/** Where the taps used to be kept, per device, before they went into the food log. */
const OLD_KEY = "abot.fuelPacer";

/**
 * Moves today's taps from the old per-device tally into the food log, once. Older days are
 * dropped, as the tally itself dropped them each morning.
 */
export function migrateFuelTally(storage: Pick<Storage, "getItem" | "removeItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage): void {
  if (!storage) return;
  try {
    const raw = storage.getItem(OLD_KEY);
    if (!raw) return;
    storage.removeItem(OLD_KEY);
    const v = JSON.parse(raw) as { day?: unknown; proteinG?: unknown; waterMl?: unknown };
    if (v.day !== dayOf(Date.now())) return;
    const protein = Math.max(0, Math.round(Number(v.proteinG) || 0));
    const water = Math.max(0, Math.round(Number(v.waterMl) || 0));
    const add = [...(protein > 0 ? [proteinEntry(protein)] : []), ...(water > 0 ? [waterEntry(water)] : [])];
    if (add.length) useFoodLog.getState().add(add);
  } catch {
    // An unreadable tally is simply left behind.
  }
}

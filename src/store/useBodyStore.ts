import { create } from "zustand";
import type { BodyweightEntry } from "@/types/workout";
import { dayKey, upsertEntry } from "@/lib/bodyweight";
import { useSettingsStore } from "./useSettingsStore";

export interface BodyState {
  /** Daily weigh-ins, oldest first. */
  entries: BodyweightEntry[];
  /**
   * Records today's (or `date`'s) weight, with body fat and waist when measured; a second
   * weigh-in on the same day replaces its weight and keeps measurements it does not repeat.
   */
  logWeight: (weightKg: number, date?: number, extra?: Pick<BodyweightEntry, "bodyFatPercent" | "waistCm">) => void;
  remove: (id: string) => void;
  /** Puts a deleted weigh-in back (Undo); a newer one logged that day meanwhile is kept. */
  restore: (entry: BodyweightEntry) => void;
}

/** The profile's current bodyweight always follows the latest weigh-in. */
function syncCurrent(entries: BodyweightEntry[]) {
  const latest = entries[entries.length - 1];
  if (latest) useSettingsStore.getState().update({ bodyweightKg: latest.weightKg });
}

export const useBodyStore = create<BodyState>()((set, get) => ({
  entries: [],
  logWeight: (weightKg, date = Date.now(), extra = {}) => {
    // A weight-only update keeps the body fat and waist measured earlier that day.
    const prev = get().entries.find((e) => e.id === dayKey(date));
    const kept = { ...(prev?.bodyFatPercent !== undefined ? { bodyFatPercent: prev.bodyFatPercent } : {}), ...(prev?.waistCm !== undefined ? { waistCm: prev.waistCm } : {}) };
    const entries = upsertEntry(get().entries, { id: dayKey(date), date, weightKg, ...kept, ...extra });
    set({ entries });
    syncCurrent(entries);
  },
  remove: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    syncCurrent(entries);
  },
  restore: (entry) => {
    if (get().entries.some((e) => e.id === entry.id)) return;
    const entries = upsertEntry(get().entries, entry);
    set({ entries });
    syncCurrent(entries);
  },
}));

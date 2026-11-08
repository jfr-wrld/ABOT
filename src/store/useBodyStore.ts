import { create } from "zustand";
import type { BodyweightEntry } from "@/types/workout";
import { dayKey, upsertEntry } from "@/lib/bodyweight";
import { useSettingsStore } from "./useSettingsStore";

export interface BodyState {
  /** Daily weigh-ins, oldest first. */
  entries: BodyweightEntry[];
  /** Records today's (or `date`'s) weight; a second weigh-in on the same day replaces it. */
  logWeight: (weightKg: number, date?: number) => void;
  remove: (id: string) => void;
}

/** The profile's current bodyweight always follows the latest weigh-in. */
function syncCurrent(entries: BodyweightEntry[]) {
  const latest = entries[entries.length - 1];
  if (latest) useSettingsStore.getState().update({ bodyweightKg: latest.weightKg });
}

export const useBodyStore = create<BodyState>()((set, get) => ({
  entries: [],
  logWeight: (weightKg, date = Date.now()) => {
    const entries = upsertEntry(get().entries, { id: dayKey(date), date, weightKg });
    set({ entries });
    syncCurrent(entries);
  },
  remove: (id) => {
    const entries = get().entries.filter((e) => e.id !== id);
    set({ entries });
    syncCurrent(entries);
  },
}));

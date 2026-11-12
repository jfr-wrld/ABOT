import { create } from "zustand";
import { DEFAULT_SETTINGS, type UserSettings } from "@/types/workout";
import { setPhaseSource } from "@/lib/phase-engine";

export interface SettingsState extends UserSettings {
  showRpe: boolean;
  update: (patch: Partial<Omit<SettingsState, "update">>) => void;
}

export const useSettingsStore = create<SettingsState>()(
    (set) => ({
      ...DEFAULT_SETTINGS,
      // Off for new lifters: most never rate sets, and the column costs width on a phone.
      showRpe: false,
      update: (patch) => set(patch),
    }),
);

// The phase engine reads the active body phase from here (lib/phase-engine has no store import).
setPhaseSource(() => useSettingsStore.getState().bodyPhase ?? null);

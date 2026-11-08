import { create } from "zustand";
import { DEFAULT_SETTINGS, type UserSettings } from "@/types/workout";

export interface SettingsState extends UserSettings {
  showRpe: boolean;
  update: (patch: Partial<Omit<SettingsState, "update">>) => void;
}

export const useSettingsStore = create<SettingsState>()(
    (set) => ({
      ...DEFAULT_SETTINGS,
      showRpe: true,
      update: (patch) => set(patch),
    }),
);

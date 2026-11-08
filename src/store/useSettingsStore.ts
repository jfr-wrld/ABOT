import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_SETTINGS, type UserSettings } from "@/types/workout";

interface SettingsState extends UserSettings {
  showRpe: boolean;
  update: (patch: Partial<Omit<SettingsState, "update">>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      showRpe: true,
      update: (patch) => set(patch),
    }),
    {
      name: "heavy.settings",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

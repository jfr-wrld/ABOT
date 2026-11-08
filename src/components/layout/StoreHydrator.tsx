"use client";

import { useEffect } from "react";
import { useHydration } from "@/store/hydration";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useSettingsStore } from "@/store/useSettingsStore";

export function StoreHydrator() {
  const setHydrated = useHydration((s) => s.setHydrated);
  useEffect(() => {
    Promise.all([
      useWorkoutStore.persist.rehydrate(),
      useRoutineStore.persist.rehydrate(),
      useExerciseStore.persist.rehydrate(),
      useSettingsStore.persist.rehydrate(),
    ])
      .then(() => setHydrated())
      .catch((e: unknown) =>
        setHydrated(e instanceof Error ? e.message : "Saved data could not be read from this browser."),
      );
  }, [setHydrated]);
  return null;
}

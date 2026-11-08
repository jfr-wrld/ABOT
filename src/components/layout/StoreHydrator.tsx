"use client";

import { useEffect } from "react";
import { onTabStarted, startApp } from "@/store/appSession";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { wireSyncTriggers } from "@/store/useSyncStore";

/** Starts storage, hydration, persistence and cloud sync once per tab (see store/appSession). */
export function StoreHydrator() {
  useEffect(() => {
    wireSyncTriggers(onTabStarted, (fn) =>
      useWorkoutStore.subscribe((next, prev) => {
        if (prev.active && !next.active && next.sessions.some((s) => s.id === prev.active!.id)) fn();
      }),
    );
    void startApp();
  }, []);
  return null;
}

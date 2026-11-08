"use client";

import { useEffect } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useLocationStore } from "@/store/useLocationStore";
import { nearestGym } from "@/lib/gym-nearby";
import { checkAccess, currentPosition } from "@/lib/native/permissions";

/**
 * When a workout starts and some gym is pinned, picks the gym the lifter is standing in. Only
 * with location already allowed: it never asks on its own (Settings and the permissions step
 * do). A gym chosen by hand in the meantime is left alone.
 */
export function AutoGym() {
  const activeId = useWorkoutStore((s) => s.active?.id ?? null);

  useEffect(() => {
    if (!activeId) return;
    const pinned = useLocationStore.getState().locations.filter((l) => l.lat !== undefined && l.lng !== undefined);
    if (pinned.length === 0) return;
    const active = useWorkoutStore.getState().active;
    // Only a workout that just started: reopening ABOT mid-workout keeps the gym it has.
    if (!active || Date.now() - active.startedAt > 2 * 60_000) return;
    const startedWith = active.locationId;
    let cancelled = false;
    void (async () => {
      if ((await checkAccess("location")) !== "granted") return;
      const gym = nearestGym(pinned, await currentPosition());
      const now = useWorkoutStore.getState().active;
      if (cancelled || !gym || !now || now.id !== activeId) return;
      if (now.locationId === startedWith && now.locationId !== gym.id) useWorkoutStore.getState().setLocation(gym.id);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  return null;
}

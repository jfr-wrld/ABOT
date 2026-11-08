"use client";

import { useEffect, useRef } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { LIVE_TAG, liveContent } from "./live-workout";
import { notificationPermission, registerReminderWorker } from "./reminder-service";

/** Per-device choice, like the intro flag: a convenience, not training data. */
const PREF = "abot.liveStatus";

export function liveStatusEnabled(): boolean {
  try {
    return localStorage.getItem(PREF) !== "0";
  } catch {
    return false;
  }
}

export function setLiveStatusEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF, on ? "1" : "0");
  } catch {
    // Without storage the default (on) applies.
  }
}

async function clearLive(): Promise<void> {
  const reg = await registerReminderWorker();
  const shown = (await reg?.getNotifications({ tag: LIVE_TAG })) ?? [];
  for (const n of shown) n.close();
}

/**
 * While a workout runs, leaving ABOT (home screen, another app, screen off) posts one status
 * notification; coming back removes it. If the page is still allowed to run when rest ends it
 * swaps the text to "rest over" with a buzz; browsers often pause background pages, so the first
 * notification already says when rest ends.
 */
export function useLiveWorkoutNotification(): void {
  const active = useWorkoutStore((s) => s.active);
  const timer = useWorkoutStore((s) => s.restTimer);
  const { byId } = useAllExercises();
  const latest = useRef({ active, timer, byId });
  useEffect(() => {
    latest.current = { active, timer, byId };
  });

  useEffect(() => {
    let restOver: ReturnType<typeof setTimeout> | undefined;

    async function show(over: boolean) {
      const { active: a, timer: t, byId: ids } = latest.current;
      if (!a || !liveStatusEnabled() || notificationPermission() !== "granted") return;
      const reg = await registerReminderWorker();
      if (!reg) return;
      const c = liveContent(a, ids, t, Date.now());
      await reg.showNotification(c.title, {
        body: c.body,
        tag: LIVE_TAG,
        silent: !over,
        data: { url: "/workout" },
        icon: "/icon.svg",
        badge: "/icon.svg",
        ...(over ? { renotify: true, vibrate: [200, 100, 200] } : {}),
      } as NotificationOptions);
    }

    function onVisibility() {
      clearTimeout(restOver);
      if (document.visibilityState === "hidden") {
        void show(false);
        const t = latest.current.timer;
        if (t && t.endsAt > Date.now()) restOver = setTimeout(() => void show(true), t.endsAt - Date.now());
      } else {
        void clearLive();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(restOver);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Finishing or discarding the workout takes the status away.
  useEffect(() => {
    if (!active && notificationPermission() === "granted") void clearLive();
  }, [active]);
}

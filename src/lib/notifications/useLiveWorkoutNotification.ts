"use client";

import { useEffect, useRef } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { LIVE_TAG, liveContent } from "./live-workout";
import { capsuleContent, capsulePhoto, useCapsulePrefs } from "@/lib/live-capsule";
import { exercisePhoto } from "@/components/exercise/ExerciseThumb";
import { notificationPermission, registerReminderWorker } from "./reminder-service";
import { useReminderStore } from "@/store/useReminderStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { isNativeApp } from "@/lib/native/files";
import { clearNativeLive, showNativeLive } from "@/lib/native/notify";

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
 * Browser: while a workout runs, leaving ABOT (home screen, another app, screen off) posts one
 * status notification; coming back removes it. If the page is still allowed to run when rest
 * ends it swaps the text to "rest over" with a buzz; browsers often pause background pages, so
 * the first notification already says when rest ends.
 *
 * Android app: the notification stays up for the whole workout and follows every change (next
 * set, rest, pause). Android ticks its clock and rings the end of a rest itself (when Rest alert
 * is on and ABOT is not on screen), so nothing depends on the app still running once it is left.
 */
export function useLiveWorkoutNotification(): void {
  const active = useWorkoutStore((s) => s.active);
  const timer = useWorkoutStore((s) => s.restTimer);
  const { byId } = useAllExercises();
  const permission = useReminderStore((s) => s.permission);
  const ring = useSettingsStore((s) => s.restTimerAlert);
  const unit = useSettingsStore((s) => s.weightUnit);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { mode, detail } = useCapsulePrefs();
  const handoff = useWorkoutStore((s) => s.handoff);
  const latest = useRef({ active, timer, byId });
  useEffect(() => {
    latest.current = { active, timer, byId };
  });

  // Android app: mirror the workout into the notification, a second after it settles (typing a
  // weight changes the session on every key). An update that would show the same thing is not
  // sent: each one rewrites the stored state, reschedules the alarm and redraws the notification.
  const lastSent = useRef<string | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    if (!active || !liveStatusEnabled() || permission !== "granted") {
      lastSent.current = null;
      void clearNativeLive().catch(() => {});
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      const content = capsuleContent({ session: active, sessions, byId, rest: timer, now: Date.now(), unit, mode, detail, ring, handoff });
      const key = JSON.stringify(content);
      if (key === lastSent.current) return;
      const ex = content.photoKey ? byId[content.photoKey] : undefined;
      void capsulePhoto(content.photoKey ?? "", ex && exercisePhoto(ex))
        .then((photo) => {
          if (!live) return;
          lastSent.current = key;
          return showNativeLive({ ...content, photo });
        })
        .catch(() => {});
    }, 1000);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [active, timer, byId, permission, ring, sessions, unit, mode, detail, handoff]);

  // Browser only.
  useEffect(() => {
    if (isNativeApp()) return;
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

  // Browser: finishing or discarding the workout takes the status away.
  useEffect(() => {
    if (!active && !isNativeApp() && notificationPermission() === "granted") void clearLive();
  }, [active]);
}

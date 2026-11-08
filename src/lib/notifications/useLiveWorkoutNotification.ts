"use client";

import { useEffect, useRef } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { LIVE_TAG, liveContent, nativeLiveContent } from "./live-workout";
import { askPermission, notificationPermission, refreshPermission, registerReminderWorker } from "./reminder-service";
import { isNativeApp } from "@/lib/native/files";
import { clearNativeLive, showNativeLive } from "@/lib/native/notify";

/** Per-device choice, like the intro flag: a convenience, not training data. */
const PREF = "abot.liveStatus";
const ASKED = "abot.notificationsAsked";

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
  if (isNativeApp()) return clearNativeLive().catch(() => {});
  const reg = await registerReminderWorker();
  const shown = (await reg?.getNotifications({ tag: LIVE_TAG })) ?? [];
  for (const n of shown) n.close();
}

/**
 * While a workout runs, leaving ABOT (home screen, another app, screen off) posts one status
 * notification; coming back removes it. If the page is still allowed to run when rest ends it
 * swaps the text to "rest over" with a buzz; browsers often pause background pages, so the first
 * notification already says when rest ends. The Android app schedules the "rest over" alarm with
 * the system when ABOT is left, so it rings on time even with the app frozen.
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
      if (isNativeApp()) {
        // Permission may have changed in Android settings since the app started.
        if (!a || !liveStatusEnabled() || (await refreshPermission()) !== "granted") return;
        const ring = t ? liveContent(a, ids, t, t.endsAt) : null;
        await showNativeLive(nativeLiveContent(a, ids, t, Date.now()), ring && { title: ring.title, body: ring.body }).catch(() => {});
        return;
      }
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

    // The app's WebView keeps reporting "visible" in the background, so Android's own
    // pause/resume decide there.
    if (isNativeApp()) {
      let remove: (() => void) | undefined;
      let cancelled = false;
      void import("@capacitor/app").then(async ({ App }) => {
        const h = await App.addListener("appStateChange", ({ isActive }) => void (isActive ? clearLive() : show(false)));
        if (cancelled) void h.remove();
        else remove = () => void h.remove();
      });
      return () => {
        cancelled = true;
        remove?.();
      };
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(restOver);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // In the app, the first workout is when ABOT asks to post notifications: that is when the
  // status and the rest alarm start to matter. Asked once; Settings can ask again later.
  const activeId = active?.id ?? null;
  useEffect(() => {
    if (!activeId || !isNativeApp() || notificationPermission() !== "default") return;
    try {
      if (localStorage.getItem(ASKED) === "1") return;
      localStorage.setItem(ASKED, "1");
    } catch {
      return;
    }
    void askPermission();
  }, [activeId]);

  // Finishing or discarding the workout takes the status away.
  useEffect(() => {
    if (!active && notificationPermission() === "granted") void clearLive();
  }, [active]);
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native/files";
import { onLiveAction, setupNativeNotifications } from "@/lib/native/notify";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { applyCapsuleAction } from "@/lib/live-capsule";
import { useExerciseStore } from "@/store/useExerciseStore";
import { buildExerciseIndex } from "@/lib/sets";
import { syncPermission } from "@/store/useReminderStore";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { withPermissionsStep } from "@/lib/native/permissions-step";
import { finishNativeSignIn } from "@/store/useSyncStore";
import { startApp } from "@/store/appSession";
import { runBack } from "@/lib/native/back-stack";

/**
 * Android-only wiring, mounted once:
 * - Back (button or edge swipe) closes the open sheet or full-screen moment (back-stack), then
 *   goes to the previous page. On the
 *   first page it sends ABOT to the background instead of closing it.
 * - Notification channels, and a tap on a notification (or its Start button) opens that page.
 * - Google sign-in coming back through the app.abot.gym://auth deep link, also when Android
 *   started ABOT fresh for it.
 */
/** Every exercise, read when a notification button needs a name or a previous set. */
const exerciseIndex = () => {
  const { custom, catalog } = useExerciseStore.getState();
  return buildExerciseIndex(custom, catalog);
};

export function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    const cleanups: (() => void)[] = [];
    let cancelled = false;
    const keep = (fn: () => void) => (cancelled ? fn() : cleanups.push(fn));

    void import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        const top = dialogs[dialogs.length - 1];
        if (top) top.close();
        else if (runBack()) return;
        else if (closeMenu()) return;
        else if (canGoBack) window.history.back();
        else void App.minimizeApp();
      }).then((h) => keep(() => void h.remove())),
    );
    const signInReturn = async (url: string | undefined) => {
      if (!url) return;
      // Back from the payment page (payment-done.html): close the browser; PaymentReturn checks
      // the order when the app resumes.
      if (url.startsWith("app.abot.gym://auth/payment")) {
        void import("@capacitor/browser").then(({ Browser }) => Browser.close()).catch(() => {});
        return;
      }
      // Storage must be open before the session can be recorded.
      await startApp();
      const to = await finishNativeSignIn(url);
      if (to) router.push(to);
    };
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("appUrlOpen", ({ url }) => void signInReturn(url));
      keep(() => void h.remove());
      void signInReturn((await App.getLaunchUrl())?.url);
    });
    void setupNativeNotifications((url) => router.push(url))
      .then(keep)
      .catch(() => {});
    // +30s, Skip rest, Log set, Pause and Resume tapped on the workout notification.
    // A tap on the notification itself opens the workout, whatever page ABOT was left on.
    void onLiveAction((id) => (id === "open" ? router.push("/workout") : applyCapsuleAction(id, useWorkoutStore.getState(), exerciseIndex().byId)))
      .then(keep)
      .catch(() => {});
    // Installs from before the permissions step see it once, on top of where they are.
    const here = window.location.pathname;
    if (hasSeenOnboarding() && !/^\/(onboarding|permissions|login)/.test(here)) {
      const to = withPermissionsStep(here + window.location.search);
      if (to.startsWith("/permissions")) router.push(to);
    }
    // Back in the app: notification access may have changed in Android settings.
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("resume", () => void syncPermission());
      keep(() => void h.remove());
    });

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [router]);

  return null;
}

/** An open pop-up menu (aria-expanded trigger) closes on back, like a sheet. */
function closeMenu(): boolean {
  const trigger = document.querySelector<HTMLElement>('[aria-haspopup][aria-expanded="true"]');
  if (!trigger) return false;
  trigger.click();
  return true;
}

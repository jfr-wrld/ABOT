"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native/files";
import { setupNativeNotifications } from "@/lib/native/notify";

/**
 * Android-only wiring, mounted once:
 * - Back (button or edge swipe) closes the open sheet, then goes to the previous page. On the
 *   first page it sends ABOT to the background instead of closing it.
 * - Notification channels, and a tap on a notification (or its Start button) opens that page.
 */
export function NativeShell() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const cleanups: (() => void)[] = [];
    let cancelled = false;
    const keep = (fn: () => void) => (cancelled ? fn() : cleanups.push(fn));

    void import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        const top = dialogs[dialogs.length - 1];
        if (top) top.close();
        else if (closeMenu()) return;
        else if (canGoBack) window.history.back();
        else void App.minimizeApp();
      }).then((h) => keep(() => void h.remove())),
    );
    void setupNativeNotifications((url) => router.push(url))
      .then(keep)
      .catch(() => {});

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

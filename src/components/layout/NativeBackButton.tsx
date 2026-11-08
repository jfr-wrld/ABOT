"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/files";

/**
 * Android back (button or edge swipe) in the app: closes the open sheet first, then goes to the
 * previous page. On the first page it sends ABOT to the background instead of closing it.
 */
export function NativeBackButton() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
        const top = dialogs[dialogs.length - 1];
        if (top) top.close();
        else if (canGoBack) window.history.back();
        else void App.minimizeApp();
      }).then((handle) => {
        if (cancelled) void handle.remove();
        else remove = () => void handle.remove();
      }),
    );
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
  return null;
}

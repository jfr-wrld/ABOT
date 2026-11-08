"use client";

import { useEffect } from "react";
import { useHydration } from "@/store/hydration";
import { getRepository } from "@/data/repo";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { bootstrapStores } from "@/store/persistence";

export function StoreHydrator() {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      const opened = await getRepository();
      if (cancelled) return; // StrictMode re-runs effects in dev; the second run does the work
      const { persistence } = await bootstrapStores(opened, window.localStorage);
      if (!persistence) return;
      if (cancelled) {
        persistence.detach();
        return;
      }
      // Failed writes are retried when the app comes back to the foreground or online, and
      // queued writes get a chance to finish before the page is hidden or closed.
      const retry = () => void persistence.retryFailed();
      const onVisibility = () => (document.visibilityState === "visible" ? retry() : void persistence.flush());
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("online", retry);
      window.addEventListener("pagehide", onVisibility);
      cleanup = () => {
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("online", retry);
        window.removeEventListener("pagehide", onVisibility);
        persistence.detach();
      };
      // Not awaited by anything: logging never waits on the browser's answer.
      if (opened.durable) {
        void requestPersistentStorage().then((s) => useHydration.getState().setPersistStatus(s));
      }
    })();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);
  return null;
}

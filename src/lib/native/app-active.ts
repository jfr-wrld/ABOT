"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "./files";

/**
 * Whether ABOT is in the foreground. Android's WebView never fires visibilitychange, and the
 * workout's foreground service keeps the process awake, so without this every interval and
 * animation would keep running with the screen off. The app listens to Capacitor's pause and
 * resume; a browser uses visibilitychange.
 */
let active = true;
let started = false;
const listeners = new Set<() => void>();
const pauseHooks = new Set<() => void>();

function set(next: boolean): void {
  if (next === active) return;
  active = next;
  if (!next) for (const fn of pauseHooks) fn();
  for (const fn of listeners) fn();
}

function start(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!isNativeApp()) {
    active = document.visibilityState !== "hidden";
    document.addEventListener("visibilitychange", () => set(document.visibilityState !== "hidden"));
    return;
  }
  void import("@capacitor/app").then(({ App }) => {
    void App.addListener("pause", () => set(false));
    void App.addListener("resume", () => set(true));
  });
}

export function isAppActive(): boolean {
  start();
  return active;
}

export function subscribeAppActive(fn: () => void): () => void {
  start();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Runs `fn` each time the app goes to the background. */
export function onAppPause(fn: () => void): () => void {
  start();
  pauseHooks.add(fn);
  return () => pauseHooks.delete(fn);
}

export function useAppActive(): boolean {
  return useSyncExternalStore(subscribeAppActive, isAppActive, () => true);
}

/** For tests: drive the state by hand. */
export function setAppActiveForTest(next: boolean): void {
  started = true;
  set(next);
}

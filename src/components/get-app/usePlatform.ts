"use client";

import { useSyncExternalStore } from "react";
import { detectPlatform, type GetAppPlatform } from "@/lib/get-app";
import { isNativeApp } from "@/lib/native/files";

const noSubscribe = () => () => {};
const read = () => detectPlatform(navigator.userAgent, isNativeApp(), navigator.maxTouchPoints);

/** The platform in the browser; null during the static render, so nothing mismatches. */
export function usePlatform(): GetAppPlatform | null {
  return useSyncExternalStore(noSubscribe, read, () => null);
}

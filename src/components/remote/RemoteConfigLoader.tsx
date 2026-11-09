"use client";

import { useEffect } from "react";
import { useRemoteConfig } from "@/lib/remote-config";
import { useAppResumed } from "@/lib/native/useAppResumed";

/** Cached config at once, then a background refresh at start and on return to the app. */
export function RemoteConfigLoader() {
  useEffect(() => {
    useRemoteConfig.getState().load();
    void useRemoteConfig.getState().refresh();
  }, []);
  useAppResumed(() => void useRemoteConfig.getState().refresh());
  return null;
}

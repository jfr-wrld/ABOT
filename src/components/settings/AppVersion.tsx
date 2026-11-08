"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/files";

/** "1.0.15 (build 15)" in the Android app; null on the web. */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => setVersion(`${info.version} (build ${info.build})`))
      .catch(() => {});
  }, []);
  return version;
}

/** The installed Android build, so a bug report can name it. Nothing on the web. */
export function AppVersion() {
  const version = useAppVersion();
  if (!version) return null;
  return <p className="num text-center text-xs text-text-muted">ABOT {version}</p>;
}

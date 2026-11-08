"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native/files";

/** The installed Android build, so a bug report can name it. Nothing on the web. */
export function AppVersion() {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => setVersion(`ABOT ${info.version} (build ${info.build})`))
      .catch(() => {});
  }, []);
  if (!version) return null;
  return <p className="num text-center text-xs text-text-muted">{version}</p>;
}

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useAppVersion } from "./AppVersion";
import { feedback } from "@/lib/feedback";

/**
 * "ABOT v1.0.15 // TELEMETRY BUILD" at the foot of Settings: the installed version for bug
 * reports. Five taps within three seconds open Mission Control (/admin), which asks for the
 * founder PIN.
 */
export function BuildTag() {
  const version = useAppVersion();
  const router = useRouter();
  const taps = useRef<number[]>([]);
  return (
    <button
      type="button"
      onClick={() => {
        const now = Date.now();
        taps.current = [...taps.current.filter((t) => now - t < 3000), now];
        feedback.tick();
        if (taps.current.length >= 5) {
          taps.current = [];
          router.push("/admin");
        }
      }}
      className="mx-auto min-h-11 px-3 font-mono text-[10px] uppercase tabular-nums tracking-[0.14em] text-text-muted"
    >
      ABOT {version ? `v${version}` : "web"} // TELEMETRY BUILD
    </button>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { useGetApp } from "@/store/useGetApp";
import { markSession, readMemory, shouldNudge, shownThisSession, writeMemory, type NudgeTrigger } from "@/lib/get-app";
import { usePlatform } from "./usePlatform";
import { useT } from "@/i18n";

/**
 * A one-time card at the moment the app would have helped: after the first workout, when turning
 * on reminders, when setting the rest alarm. Android and desktop web only (iPhone has no app).
 * Shown once per trigger and once per visit; "Don't show again" silences every nudge.
 */
export function GetAppNudge({ trigger, line }: { trigger: Exclude<NudgeTrigger, "banner">; line: string }) {
  const t = useT();
  const platform = usePlatform();
  const show = useGetApp((s) => s.show);
  const [allowed] = useState(() => typeof window !== "undefined" && shouldNudge(readMemory(), trigger, Date.now(), shownThisSession()));
  const [hidden, setHidden] = useState(false);
  const visible = allowed && !hidden && (platform === "android" || platform === "desktop");
  useEffect(() => {
    if (!visible) return;
    // Counted as seen the moment it appears, so it never repeats.
    const m = readMemory();
    writeMemory({ ...m, shown: { ...m.shown, [trigger]: true } });
    markSession();
  }, [visible, trigger]);
  if (!visible) return null;

  return (
    <aside aria-label={t("ABOT app")} className="flex flex-col gap-2 rounded-xl border border-accent/30 bg-accent-tint p-3">
      <div className="flex items-start gap-2">
        <Smartphone aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-accent" />
        <p className="min-w-0 flex-1 text-sm">{line}</p>
        <button type="button" onClick={() => setHidden(true)} aria-label={t("Close")} className="-m-2 flex size-10 shrink-0 items-center justify-center rounded-lg text-text-muted">
          <X aria-hidden="true" size={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <button type="button" onClick={show} className="tap min-h-10 rounded-lg bg-accent px-3 text-sm font-bold text-on-accent">
          {t("Get the Android app")}
        </button>
        <button
          type="button"
          onClick={() => {
            writeMemory({ ...readMemory(), never: true });
            setHidden(true);
          }}
          className="min-h-10 rounded-lg px-2 text-xs font-semibold text-text-muted hover:text-text"
        >
          {t("Don't show again")}
        </button>
      </div>
    </aside>
  );
}

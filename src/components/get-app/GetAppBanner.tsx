"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { useGetApp } from "@/store/useGetApp";
import { BANNER_LATER_MS, markSession, readMemory, shouldNudge, shownThisSession, writeMemory } from "@/lib/get-app";
import { usePlatform } from "./usePlatform";
import { useT } from "@/i18n";

/**
 * A slim strip on Home for web visitors: one native benefit and "Get the app". Closing it hides
 * it for 14 days; it never shows inside the app, and only once per visit with other nudges.
 */
export function GetAppBanner() {
  const t = useT();
  const platform = usePlatform();
  const show = useGetApp((s) => s.show);
  const [hidden, setHidden] = useState(false);
  // Read at render: the decision is stable for the visit, and storage is fine to read here.
  const [allowed] = useState(() => typeof window !== "undefined" && shouldNudge(readMemory(), "banner", Date.now(), shownThisSession()));
  const visible = !!platform && platform !== "native" && !hidden && allowed;
  // One nudge per visit: the banner on screen counts.
  useEffect(() => {
    if (visible) markSession("banner");
  }, [visible]);
  if (!visible) return null;

  const line = platform === "ios" ? t("Add ABOT to your Home Screen: full screen, offline, one tap away.") : t("The app rings your rest timer with the screen off.");
  const cta = platform === "ios" ? t("How") : t("Get the app");

  function later() {
    writeMemory({ ...readMemory(), bannerUntil: Date.now() + BANNER_LATER_MS });
    markSession("closed");
    setHidden(true);
  }

  return (
    <section aria-label={t("ABOT app")} className="flex items-center gap-3 rounded-xl border border-line bg-surface py-2 pl-2 pr-1">
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-black text-accent">
        <AbotMark size={22} />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-snug">{line}</p>
      <button
        type="button"
        onClick={show}
        className="tap min-h-10 shrink-0 rounded-lg bg-accent px-3 text-sm font-bold text-on-accent"
      >
        {cta}
      </button>
      <button type="button" onClick={later} aria-label={t("Hide for now")} className="tap flex size-10 shrink-0 items-center justify-center rounded-lg text-text-muted hover:bg-ink/[0.05]">
        <X aria-hidden="true" size={16} />
      </button>
    </section>
  );
}

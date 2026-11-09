"use client";

import { useState, useSyncExternalStore } from "react";
import { Megaphone, X } from "lucide-react";
import { useRemoteConfig } from "@/lib/remote-config";
import { useT } from "@/i18n";

const DISMISSED = "abot.announcement-dismissed";
const noop = () => () => {};
function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED);
  } catch {
    return null;
  }
}

/**
 * The broadcast line from Mission Control, at the top of Home. Dismissing hides that text only;
 * a new announcement shows again.
 */
export function AnnouncementBanner() {
  const t = useT();
  const text = useRemoteConfig((s) => s.config.announcement);
  // What was dismissed before (read after hydration; the prerendered page has none).
  const stored = useSyncExternalStore(noop, readDismissed, () => null);
  const [dismissedNow, setDismissed] = useState<string | null>(null);
  const dismissed = dismissedNow ?? stored;
  if (!text || dismissed === text) return null;
  return (
    <aside aria-label={t("Announcement")} className="force-dark flex items-start gap-2 rounded-ctl border border-[#ccff00]/40 bg-black py-1.5 pl-3 pr-1 text-text">
      <Megaphone aria-hidden="true" size={16} className="mt-2.5 shrink-0 text-[#ccff00]" />
      <p className="min-w-0 flex-1 py-2 text-sm">{text}</p>
      <button
        type="button"
        aria-label={t("Dismiss announcement")}
        onClick={() => {
          setDismissed(text);
          try {
            localStorage.setItem(DISMISSED, text);
          } catch {
            // Hidden for this visit only.
          }
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </aside>
  );
}

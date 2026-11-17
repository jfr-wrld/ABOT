"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useHydration } from "@/store/hydration";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useT } from "@/i18n";

/**
 * Storage trouble, in words the lifter can act on, on every page (mounted once in the layout).
 * The browser's own error text sits folded under Details, for support.
 *
 * When saved data could not be read, nothing logged now is saved. Starting a workout then asks
 * first, so a whole session is never logged into memory without the lifter knowing.
 */
export function StorageAlert() {
  const t = useT();
  const error = useHydration((s) => s.error);
  const writeError = useHydration((s) => s.writeError);
  const activeId = useWorkoutStore((s) => s.active?.id ?? null);
  const unreadable = error?.kind === "unreadable";
  const [noted, setNoted] = useState(false);

  // Ask once per workout started while nothing can be saved.
  const [askFor, setAskFor] = useState<string | null>(null);
  const answered = useRef<string | null>(null);
  useEffect(() => {
    if (unreadable && activeId && answered.current !== activeId) setAskFor(activeId);
  }, [unreadable, activeId]);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (askFor && !el.open) el.showModal();
    else if (!askFor && el.open) el.close();
    if (!askFor) return;
    // Starting a workout often opens another dialog right after (the exercise picker). The
    // newest modal draws on top, so lift this one back above it until it is answered.
    const watch = new MutationObserver((changes) => {
      if (changes.some((c) => c.target !== el && (c.target as HTMLDialogElement).open)) {
        el.close();
        el.showModal();
      }
    });
    watch.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => watch.disconnect();
  }, [askFor]);
  const logAnyway = () => {
    answered.current = askFor;
    setAskFor(null);
  };

  // Private browsing does not change while the tab is open: once read, the lifter can put it away.
  const issue = error && !(noted && !unreadable)
    ? {
        text:
          error.kind === "unreadable"
            ? t("Your saved workouts could not be read, so nothing you log now will be saved. Reload ABOT to try again; your earlier workouts are still on this device.")
            : t("This browser does not let ABOT save data (private browsing, or storage turned off). Workouts stay only until this tab closes. Export a backup from Settings to keep a copy."),
        detail: error.detail,
      }
    : null;
  const write = writeError
    ? {
        text:
          writeError.kind === "full"
            ? t("This device is out of storage, so your last change was not saved. Free up some space; ABOT keeps your changes and tries again when you come back. Export a backup from Settings to keep a copy now.")
            : t("Your last change could not be saved to this device. ABOT keeps your changes and tries again when you come back. Export a backup from Settings to keep a copy now."),
        detail: writeError.detail,
      }
    : null;

  return (
    <>
      {[issue, write].map(
        (m, i) =>
          m && (
            <div key={i} role="alert" className="mx-4 mt-3 flex flex-col gap-2 rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
              <p>{m.text}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {i === 0 && unreadable && (
                  <button type="button" onClick={() => location.reload()} className="min-h-11 font-semibold underline underline-offset-4">
                    {t("Reload ABOT")}
                  </button>
                )}
                {/* The banner says "Export a backup from Settings": the way there is one tap. */}
                {!(i === 0 && unreadable) && (
                  <Link href="/settings?section=data" className="flex min-h-11 items-center font-semibold underline underline-offset-4">
                    {t("Export a backup")}
                  </Link>
                )}
                {i === 0 && !unreadable && (
                  <button type="button" onClick={() => setNoted(true)} className="min-h-11 font-semibold">
                    {t("Got it")}
                  </button>
                )}
                <details className="text-xs text-text-muted">
                  <summary className="flex min-h-11 cursor-pointer items-center">{t("Details")}</summary>
                  <span className="block pb-1 [overflow-wrap:anywhere]">{m.detail}</span>
                </details>
              </div>
            </div>
          ),
      )}
      <dialog
        ref={dialog}
        aria-labelledby="storage-ask-title"
        onCancel={(e) => {
          e.preventDefault();
          logAnyway();
        }}
        className="m-auto w-[calc(100%-32px)] max-w-sm rounded-card border border-ink/[0.08] bg-surface p-5 text-text backdrop:bg-black/80"
      >
        <h2 id="storage-ask-title" className="text-xl font-bold tracking-tight">
          {t("This workout will not be saved")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {t("ABOT could not read your saved workouts, so anything you log now is lost when the app closes. Reload first; your earlier workouts are still on this device.")}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={() => location.reload()} className="min-h-12 rounded-xl bg-accent text-base font-bold text-on-accent">
            {t("Reload ABOT")}
          </button>
          <button type="button" onClick={logAnyway} className="min-h-12 rounded-xl text-base font-semibold text-text-muted hover:text-text">
            {t("Log anyway")}
          </button>
        </div>
      </dialog>
    </>
  );
}

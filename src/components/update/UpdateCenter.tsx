"use client";

import { useEffect } from "react";
import { Download, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { usePagePath } from "@/components/layout/usePagePath";
import { useAppUpdate } from "@/store/useAppUpdate";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useHydration } from "@/store/hydration";
import { changelogLines, type LatestRelease } from "@/lib/app-update";
import { isNativeApp } from "@/lib/native/files";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/** Pages where a pop-up would get in the way of something the lifter must finish first. */
const QUIET = ["/onboarding", "/login", "/permissions", "/workout"];
/** Releases the changelog lists, newest first. */
const MAX_VERSIONS = 5;

/**
 * Android only. Asks GitHub for a newer build when the app opens or comes back (at most every
 * 12 hours), then shows what is new in a sheet: Update now starts the download in the background
 * (Android's download notification shows its progress), Later puts that version off for a day.
 * Once the APK is in, a banner offers Install. The pop-up waits while a workout runs.
 */
export function UpdateCenter() {
  const hydrated = useHydration((s) => s.hydrated);
  const init = useAppUpdate((s) => s.init);
  const check = useAppUpdate((s) => s.check);

  useEffect(() => {
    if (!isNativeApp()) return;
    let live = true;
    void import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (!live) return;
        init(Number(info.build) || 0);
        void check(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [init, check]);
  useAppResumed(() => void check(true));

  if (!hydrated || !isNativeApp()) return null;
  return (
    <>
      <WhatsNew />
      <ReadyBanner />
    </>
  );
}

export function WhatsNew() {
  const t = useT();
  const path = usePagePath();
  const working = useWorkoutStore((s) => s.active !== null);
  const { modal, result, later, start } = useAppUpdate();
  const open = modal && !working && !QUIET.some((p) => path.startsWith(p)) && result?.kind === "available";
  if (result?.kind !== "available") return null;
  const { release, changes } = result;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long" }) : "");

  return (
    <Sheet
      open={open}
      onClose={later}
      title={t("New version")}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={later}>{t("Later")}</Button>
          <Button
            variant="primary"
            onClick={() => {
              feedback.tick();
              void start();
            }}
          >
            <Download aria-hidden="true" size={16} />
            {t("Update now")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles size={22} />
          </span>
          <div className="min-w-0">
            <p className="num text-xl font-extrabold tracking-tight">ABOT {release.version}</p>
            <p className="text-xs text-text-muted">
              {changes.length > 1
                ? t.n(changes.length, "{n} update since yours", "{n} updates since yours")
                : date(release.publishedAt)}
            </p>
          </div>
        </div>
        <section aria-labelledby="whats-new" className="flex flex-col gap-3">
          <h3 id="whats-new" className="label-caps">
            {t("What's new")}
          </h3>
          <ol className="flex flex-col gap-3">
            {changes.slice(0, MAX_VERSIONS).map((c) => (
              <Change key={c.build} release={c} date={date(c.publishedAt)} />
            ))}
          </ol>
        </section>
        <p className="text-xs text-text-muted">{t("It downloads in the background while you use ABOT. Your data stays on the phone.")}</p>
      </div>
    </Sheet>
  );
}

function Change({ release, date }: { release: LatestRelease; date: string }) {
  const lines = changelogLines(release.notes);
  return (
    <li className="border-l-2 border-line pl-3">
      <p className="num text-[11px] text-text-muted">
        {release.version}
        {date && ` · ${date}`}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {lines.map((l, i) => (
          <li key={i} className="text-sm">
            {l}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** The APK is in (or Android needs the install permission first): one tap to install. */
export function ReadyBanner() {
  const t = useT();
  const { phase, build, bannerClosed, install, closeBanner } = useAppUpdate();
  const shown = (phase === "ready" || phase === "permission") && !bannerClosed;
  return (
    <AnimatePresence>
      {shown && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-50 mx-auto w-[min(560px,calc(100%-32px))]"
        >
          <div role="status" className="flex items-center gap-2 rounded-ctl border border-accent bg-surface py-2 pr-1.5 pl-3 shadow-lg">
            <p className="min-w-0 flex-1 text-sm">
              {phase === "permission"
                ? t("Allow installs from ABOT in the screen that opened, then tap Install.")
                : t("ABOT {version} is downloaded.", { version: build ? `1.0.${build}` : "" })}
            </p>
            <Button variant="primary" className="!min-h-9 shrink-0 !px-3" onClick={() => void install()}>
              {t("Install")}
            </Button>
            <button
              type="button"
              onClick={closeBanner}
              aria-label={t("Dismiss")}
              className="flex size-9 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:text-text"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

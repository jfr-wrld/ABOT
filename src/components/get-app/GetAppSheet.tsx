"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, ChevronDown, Copy, Download, LockKeyhole, Share, SquarePlus, Timer, type LucideIcon } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useGetApp } from "@/store/useGetApp";
import { APK_URL, MIN_ANDROID } from "@/lib/get-app";
import { usePlatform } from "./usePlatform";
import { useT } from "@/i18n";
import { CONTACT_EMAIL } from "@/lib/social";

/** What the app does that a browser tab cannot: each line is a real native feature. */
export const APP_PERKS: { icon: LucideIcon; title: string }[] = [
  { icon: LockKeyhole, title: "Your set and rest timer on the lock screen" },
  { icon: Timer, title: "Rest alarm with the screen off" },
  { icon: BellRing, title: "Reminders that arrive even when ABOT is closed" },
];

/**
 * The one place every "Get the app" button leads, kept short: the download (or, on desktop, a QR
 * code to scan), one line of facts with the beta, three things only the app does, and the install
 * steps folded away. iPhone has no app, so it shows Add to Home Screen instead. Never in the app.
 */
export function GetAppSheet() {
  const t = useT();
  const platform = usePlatform();
  const { open, hide } = useGetApp();
  if (!platform || platform === "native") return null;

  const title = platform === "ios" ? t("ABOT on your iPhone") : t("ABOT for Android (beta)");
  return (
    <Sheet open={open} onClose={hide} title={title}>
      <div className="flex flex-col gap-4 pb-2">
        {platform === "ios" ? (
          <IosSteps />
        ) : (
          <>
            {platform === "android" ? <AndroidDownload /> : <DesktopQr />}
            <Perks />
            <InstallHelp />
          </>
        )}
      </div>
    </Sheet>
  );
}

function Perks() {
  const t = useT();
  return (
    <ul aria-label={t("Only in the app")} className="flex flex-col gap-2">
      {APP_PERKS.map((p) => (
        <li key={p.title} className="flex items-center gap-3 text-sm">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-ctl bg-accent-tint text-accent">
            <p.icon size={16} />
          </span>
          {t(p.title)}
        </li>
      ))}
    </ul>
  );
}

/** One line of facts, the beta included: what testers should know before they tap. */
function Facts() {
  const t = useT();
  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-text-muted">
      <span className="rounded-full bg-warmup/15 px-2 py-0.5 font-semibold text-warmup">{t("Beta")}</span>
      {t("Free · Android {v}+ · no account", { v: MIN_ANDROID })}
    </p>
  );
}

function AndroidDownload() {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <a
        href={APK_URL}
        rel="noopener"
        className="tap flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent"
      >
        <Download aria-hidden="true" size={18} />
        {t("Download for Android")}
      </a>
      <Facts />
    </div>
  );
}

/** Install steps, moving data, signing and feedback: there for whoever needs them, folded away. */
function InstallHelp() {
  const t = useT();
  const hide = useGetApp((s) => s.hide);
  return (
    <details className="group rounded-xl border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold">
        {t("How to install, and moving your data")}
        <ChevronDown aria-hidden="true" size={16} className="text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-3 text-sm">
        <ol className="flex flex-col gap-2">
          {[
            t("Tap Download. Your browser saves abot.apk."),
            t("Open the file. If Android asks, allow your browser to install apps, once."),
            t("Open ABOT. From now on it updates itself in the app."),
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span aria-hidden="true" className="num flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-bold">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-text-muted">
          {t("Moving from the web: back up in")}{" "}
          <Link href="/settings?section=data" onClick={hide} className="font-semibold text-text underline underline-offset-2">
            {t("Settings > Data")}
          </Link>
          {t(", then restore in the app.")}
        </p>
        <p className="text-xs text-text-muted">
          {t("Something broken or missing in the beta? Settings > Send beta feedback in the app, or")}{" "}
          <span className="select-all font-semibold text-text">{CONTACT_EMAIL}</span>
        </p>
      </div>
    </details>
  );
}

function DesktopQr() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(APK_URL);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {/* Generated once at build time for the fixed link (scripts/make-get-app-qr.mjs). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/get-app-qr.svg" alt={t("QR code to download ABOT for Android")} width={184} height={184} className="rounded-xl bg-white p-3" />
      <p className="text-sm font-semibold">{t("Scan with your Android phone")}</p>
      <Facts />
      <div className="flex w-full items-center gap-2 rounded-xl border border-line bg-surface-2 p-2">
        <span className="min-w-0 flex-1 select-all truncate text-left font-mono text-xs">{APK_URL}</span>
        <button type="button" onClick={() => void copy()} className="tap flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold hover:bg-ink/[0.05]">
          <Copy aria-hidden="true" size={14} />
          {copied ? t("Copied") : t("Copy link")}
        </button>
      </div>
    </div>
  );
}

function IosSteps() {
  const t = useT();
  return (
    <>
      <p className="text-sm text-text-muted">{t("There is no iPhone app yet. Add ABOT to your Home Screen and it opens full screen, like an app, and works offline.")}</p>
      <ol className="flex flex-col gap-2.5">
        {[
          { icon: Share, text: t("In Safari, tap Share.") },
          { icon: SquarePlus, text: t("Choose Add to Home Screen.") },
          { icon: Download, text: t("Tap Add. ABOT is now on your Home Screen.") },
        ].map((s, i) => (
          <li key={i} className="flex items-center gap-3 text-sm">
            <span aria-hidden="true" className="num flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs font-bold">
              {i + 1}
            </span>
            <s.icon aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
            <span className="min-w-0">{s.text}</span>
          </li>
        ))}
      </ol>
    </>
  );
}


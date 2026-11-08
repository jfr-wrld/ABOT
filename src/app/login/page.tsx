"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { Button } from "@/components/ui/Button";
import { SyncError } from "@/components/sync/SyncError";
import { useSyncStore } from "@/store/useSyncStore";
import { useNow } from "@/lib/useNow";
import { syncStatus } from "@/lib/syncStatus";
import { useT } from "@/i18n";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const stack: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const rise: Variants = { hidden: { y: 28, opacity: 0 }, shown: { y: 0, opacity: 1, transition: SPRING } };

const PRIMARY_LINK =
  "flex min-h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent transition-[filter] hover:brightness-110";
const SECONDARY_LINK =
  "flex min-h-12 w-full items-center justify-center rounded-xl border border-ink/[0.12] bg-surface-2 text-base font-semibold transition-colors hover:border-ink/25";
const QUIET_LINK =
  "flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text";

/** Only in-app paths, so ?from= cannot send anyone off the site. */
function useFrom(): string | null {
  const from = useSearchParams().get("from");
  return from && from.startsWith("/") && !from.startsWith("//") ? from : null;
}

const LABELS: Record<string, string> = { "/profile": "Profile", "/profile?tab=about": "Profile", "/settings": "Settings" };

/**
 * Sign-in for the optional cloud backup and sync (Supabase, Google). The page has no dock, so it
 * carries its own way back to where the lifter came from.
 */
export default function LoginPage() {
  const from = useFrom();
  const t = useT();
  return (
    <main className="flex min-h-[calc(100dvh-var(--dock-h,96px))] flex-1 flex-col px-5 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <div className="pt-4">
        <Link
          href={from ?? "/"}
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-ctl pr-3 pl-1 text-sm text-text-muted hover:bg-surface hover:text-text"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          {t((from && LABELS[from]) ?? "Back")}
        </Link>
      </div>
      <motion.div variants={stack} initial="hidden" animate="shown" className="mt-auto flex flex-col">
        <motion.span variants={rise} className="text-accent">
          <AbotMark size={48} />
        </motion.span>
        <motion.h1 variants={rise} className="mt-6 text-3xl font-bold leading-tight tracking-tight">
          {t("Back up and sync")}
        </motion.h1>
        <motion.p variants={rise} className="mt-3 max-w-[36ch] text-base leading-relaxed text-text-muted">
          {t("ABOT works fully without an account. Signing in will copy your workouts to your own cloud space, so a new phone can restore them.")}
        </motion.p>

        <motion.div variants={rise} className="mt-8 flex flex-col gap-3">
          <GoogleSignIn from={from} />
        </motion.div>
      </motion.div>
    </main>
  );
}

function ExportLink() {
  const t = useT();
  return (
    <Link href="/settings" className="font-semibold text-text underline underline-offset-4 hover:text-accent">
      {t("Export backup in Settings")}
    </Link>
  );
}

/**
 * One Volt action per state: signing in when it is possible, carrying on when it is not, and
 * going back once signed in.
 */
function GoogleSignIn({ from }: { from: string | null }) {
  const s = useSyncStore();
  const now = useNow(30_000);
  const away = from ?? "/";
  const t = useT();

  if (s.phase === "unconfigured") {
    return (
      <>
        <div className="rounded-card border border-ink/[0.08] bg-surface p-4">
          <button
            type="button"
            disabled
            aria-describedby="google-status"
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-ink/[0.12] bg-surface-2 text-base font-semibold text-text disabled:opacity-60"
          >
            {t("Sign in with Google")}
          </button>
          <p id="google-status" className="mt-3 text-sm text-text-muted">
            {t("Cloud sync is not set up for this build. Keep a copy with")} <ExportLink />.
          </p>
        </div>
        <Link href={away} className={PRIMARY_LINK}>
          {t("Continue without an account")}
        </Link>
      </>
    );
  }

  if (s.userId && s.phase !== "signed_out" && s.phase !== "signing_in") {
    const status = syncStatus(s, now, t);
    return (
      <>
        <div className="rounded-card border border-ink/[0.08] bg-surface p-4">
          <p className="text-sm">
            {t("Signed in as")} <span className="break-all font-semibold">{s.email ?? t("your Google account")}</span>
          </p>
          <p role="status" className={`mt-1 text-sm ${status.tone === "error" ? "text-failure" : "text-text-muted"}`}>
            {status.text}
          </p>
          {status.tone === "error" && s.lastError && (
            <SyncError stage={s.errorStage ?? "sync"} raw={s.lastError} className="mt-2" />
          )}
        </div>
        <Link href={away} className={PRIMARY_LINK}>
          {t("Done")}
        </Link>
        <Link href="/settings?section=data" className={SECONDARY_LINK}>
          {t("Backup & Sync settings")}
        </Link>
      </>
    );
  }

  return (
    <>
      <Button
        variant="primary"
        onClick={() => void s.signIn(away)}
        disabled={s.phase === "signing_in"}
        className="min-h-12 w-full text-base"
      >
        {s.phase === "signing_in" ? t("Opening Google") : t("Sign in with Google")}
      </Button>
      {s.phase === "error" && s.lastError ? (
        <SyncError stage={s.errorStage ?? "sign_in"} raw={s.lastError} />
      ) : (
        <p className="text-sm text-text-muted">{t("Google opens to confirm it is you, then brings you back to ABOT.")}</p>
      )}
      <Link href={away} className={QUIET_LINK}>
        {t("Continue without an account")}
      </Link>
    </>
  );
}

"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { AbotMark } from "@/components/brand/AbotMark";
import { useSyncStore } from "@/store/useSyncStore";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
const stack: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
const rise: Variants = { hidden: { y: 28, opacity: 0 }, shown: { y: 0, opacity: 1, transition: SPRING } };

/**
 * Sign-in for the optional cloud backup and sync (Supabase, Google). Without the Supabase
 * settings in this build, the page says so instead of offering a button that cannot work.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100dvh-96px)] flex-1 flex-col justify-end px-5 pb-[calc(16px+env(safe-area-inset-bottom))]">
      <motion.div variants={stack} initial="hidden" animate="shown" className="flex flex-col">
        <motion.span variants={rise} className="text-accent">
          <AbotMark size={48} />
        </motion.span>
        <motion.h1 variants={rise} className="mt-6 text-3xl font-bold leading-tight tracking-tight">
          Back up and sync
        </motion.h1>
        <motion.p variants={rise} className="mt-3 max-w-[36ch] text-base leading-relaxed text-text-muted">
          ABOT works fully without an account. Signing in will copy your workouts to your own cloud space,
          so a new phone can restore them.
        </motion.p>

        <motion.div variants={rise} className="mt-8 rounded-card border border-white/[0.08] bg-surface p-4">
          <GoogleSignIn />
        </motion.div>

        <motion.div variants={rise}>
          <Link
            href="/"
            className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-accent text-base font-bold text-on-accent transition-[filter] hover:brightness-110"
          >
            Continue without an account
          </Link>
        </motion.div>
      </motion.div>
    </main>
  );
}

const exportLink = (
  <Link href="/settings" className="font-semibold text-text underline underline-offset-4 hover:text-accent">
    Export backup in Settings
  </Link>
);

function GoogleSignIn() {
  const { phase, email, lastError, userId, signIn } = useSyncStore();
  if (phase === "unconfigured") {
    return (
      <>
        <button
          type="button"
          disabled
          aria-describedby="google-status"
          className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 text-base font-semibold text-text disabled:opacity-60"
        >
          Sign in with Google
        </button>
        <p id="google-status" className="mt-3 text-sm text-text-muted">
          Cloud sync is not set up for this build. Keep a copy with {exportLink}.
        </p>
      </>
    );
  }
  if (userId && phase !== "signed_out" && phase !== "signing_in") {
    return (
      <>
        <p className="text-sm">
          Signed in as <span className="font-semibold">{email ?? "your Google account"}</span>
        </p>
        <Link
          href="/settings#sync"
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 text-base font-semibold"
        >
          Backup &amp; Sync settings
        </Link>
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={phase === "signing_in"}
        className="flex min-h-12 w-full items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 text-base font-semibold text-text transition-colors hover:border-white/25 disabled:opacity-60"
      >
        {phase === "signing_in" ? "Opening Google" : "Sign in with Google"}
      </button>
      {lastError ? (
        <p role="alert" className="mt-3 text-sm text-failure">
          {lastError}
        </p>
      ) : (
        <p className="mt-3 text-sm text-text-muted">Google opens to confirm it is you, then brings you back to ABOT.</p>
      )}
    </>
  );
}

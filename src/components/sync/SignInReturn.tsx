"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CloudAlert, CloudCheck, X } from "lucide-react";
import { takeSignInReturn, useSyncStore } from "@/store/useSyncStore";
import { friendlyError } from "@/lib/syncStatus";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

/** The part of each page that shows the account, scrolled to so the result is in view. */
const ANCHORS: Record<string, string> = { "/profile?tab=about": "account", "/settings": "sync" };

/** Waits for the page to render after navigating, then scrolls; returns a cancel. */
function revealAccount(id: string | undefined): () => void {
  if (!id) return () => {};
  let frame = 0;
  let tries = 0;
  const look = () => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: "center" });
    else if (tries++ < 120) frame = requestAnimationFrame(look);
  };
  frame = requestAnimationFrame(look);
  return () => cancelAnimationFrame(frame);
}

/**
 * Google always sends the lifter back to /settings (the one redirect URL the Supabase project
 * allows). This takes them on to the page they started from and says how it went, above the dock
 * where it is seen without scrolling.
 */
export function SignInReturn() {
  const router = useRouter();
  const notice = useSyncStore((s) => s.notice);
  const email = useSyncStore((s) => s.email);
  const lastError = useSyncStore((s) => s.lastError);
  const clearNotice = useSyncStore((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const here = window.location.pathname + window.location.search;
    const to = takeSignInReturn() ?? here;
    if (to !== here) router.replace(to);
    return revealAccount(ANCHORS[to]);
  }, [notice, router]);

  // Success clears itself; a failure stays until it is read and dismissed.
  useEffect(() => {
    if (notice?.kind !== "signed_in") return;
    const t = setTimeout(clearNotice, 6000);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  const ok = notice?.kind === "signed_in";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+var(--live-bar,0px)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[640px] px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.kind}
            role={ok ? "status" : "alert"}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={SPRING}
            className={`pointer-events-auto flex items-start gap-3 rounded-card border bg-surface-2 p-3 pr-1 shadow-lg ${
              ok ? "border-accent/40" : "border-failure/50"
            }`}
          >
            {ok ? (
              <CloudCheck aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-accent" />
            ) : (
              <CloudAlert aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-failure" />
            )}
            <p className="min-w-0 flex-1 self-center text-sm">
              {ok ? (
                <>
                  Signed in as <span className="break-all font-semibold">{email ?? "your Google account"}</span>. Backing up
                  this phone now.
                </>
              ) : (
                friendlyError("sign_in", lastError ?? "")
              )}
            </p>
            <button
              type="button"
              onClick={clearNotice}
              aria-label="Dismiss"
              className="flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:bg-white/[0.06] hover:text-text"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

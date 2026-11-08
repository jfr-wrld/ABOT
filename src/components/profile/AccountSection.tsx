"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { useSyncStore } from "@/store/useSyncStore";
import { useNow } from "@/lib/useNow";
import { syncStatus, type SyncTone } from "@/lib/syncStatus";
import { Button } from "@/components/ui/Button";
import { SyncError } from "@/components/sync/SyncError";

const LINK =
  "flex min-h-11 items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 px-3 text-center text-sm font-semibold transition-colors hover:border-white/25";

/**
 * Profile > Account. The same status Settings shows, so "backed up" is only said when it is
 * true: a failed or pending backup is the thing a lifter most needs to see here.
 */
export function AccountSection() {
  const s = useSyncStore();
  const now = useNow(30_000);
  const signedIn = s.userId !== null && s.phase !== "signed_out" && s.phase !== "signing_in" && s.phase !== "unconfigured";

  useEffect(() => {
    void useSyncStore.getState().refreshCounts();
  }, []);

  return (
    <section id="account" aria-labelledby="account-heading" className="panel scroll-mt-16 p-3">
      <h2 id="account-heading" className="label-caps">
        Account
      </h2>
      {signedIn ? <SignedIn now={now} /> : <Guest />}
    </section>
  );
}

function StatusIcon({ tone }: { tone: SyncTone }) {
  const cls = "mt-0.5 shrink-0";
  if (tone === "ok") return <CloudCheck aria-hidden="true" size={20} className={`${cls} text-accent`} />;
  if (tone === "error") return <CloudAlert aria-hidden="true" size={20} className={`${cls} text-failure`} />;
  if (tone === "offline") return <CloudOff aria-hidden="true" size={20} className={`${cls} text-text-muted`} />;
  if (tone === "busy")
    return <RefreshCw aria-hidden="true" size={20} className={`${cls} animate-spin text-text-muted motion-reduce:animate-none`} />;
  return <CloudUpload aria-hidden="true" size={20} className={`${cls} text-text-muted`} />;
}

function SignedIn({ now }: { now: number }) {
  const s = useSyncStore();
  const status = syncStatus(s, now);
  const retry = status.tone === "error" || status.tone === "pending" || status.tone === "never";

  return (
    <>
      <div className="mt-2 flex items-start gap-3">
        <StatusIcon tone={status.tone} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{s.email ?? "Google account"}</p>
          <p role="status" className={`text-sm ${status.tone === "error" ? "text-failure" : "text-text-muted"}`}>
            {status.text}
          </p>
        </div>
      </div>
      {status.tone === "error" && s.lastError && (
        <SyncError stage={s.errorStage ?? "sync"} raw={s.lastError} className="mt-2 pl-8" />
      )}
      <div className={`mt-3 grid gap-2 ${retry ? "grid-cols-2" : "grid-cols-1"}`}>
        {retry && (
          <Button onClick={() => void s.syncNow()}>{status.tone === "error" ? "Try again" : "Back up now"}</Button>
        )}
        <Link href="/settings#sync" className={LINK}>
          Backup &amp; Sync settings
        </Link>
      </div>
    </>
  );
}

function Guest() {
  const s = useSyncStore();
  return (
    <>
      <div className="mt-2 flex items-start gap-3">
        <CloudOff aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-text-muted" />
        <div>
          <p className="text-sm font-semibold">Guest on this device</p>
          <p className="text-sm text-text-muted">
            Your workouts live on this phone only. Export a backup in Settings to keep a copy.
          </p>
        </div>
      </div>
      {s.phase === "error" && s.lastError && (
        <SyncError stage={s.errorStage ?? "sign_in"} raw={s.lastError} className="mt-2 pl-8" />
      )}
      <Link href="/login?from=/profile" className={`mt-3 ${LINK}`}>
        Back up with an account
      </Link>
    </>
  );
}

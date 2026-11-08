"use client";

import { useEffect } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSyncStore } from "@/store/useSyncStore";
import { useNow } from "@/lib/useNow";
import { Button } from "@/components/ui/Button";

const rtf = typeof Intl !== "undefined" ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }) : null;

function ago(t: number, now: number): string {
  const s = Math.round((t - now) / 1000);
  if (Math.abs(s) < 45) return "just now";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf?.format(m, "minute") ?? `${-m} min ago`;
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf?.format(h, "hour") ?? `${-h} h ago`;
  return rtf?.format(Math.round(h / 24), "day") ?? `${-Math.round(h / 24)} days ago`;
}

/** Settings > Backup & Sync: the optional Google sign-in and the sync status in plain words. */
export function SyncSection() {
  const s = useSyncStore();
  const now = useNow(30_000);
  const signedIn = s.phase === "idle" || s.phase === "syncing" || s.phase === "offline" || (s.phase === "error" && s.userId !== null);

  useEffect(() => {
    void useSyncStore.getState().refreshCounts();
  }, []);

  let status: string;
  if (s.phase === "syncing") status = "Syncing";
  else if (s.phase === "offline") status = "Offline, will sync when back online";
  else if (s.pendingCount > 0) status = `${s.pendingCount} ${s.pendingCount === 1 ? "change" : "changes"} waiting to sync`;
  else if (s.lastSyncedAt) status = `Synced ${ago(s.lastSyncedAt, now)}`;
  else status = "Not synced yet";

  return (
    <section aria-labelledby="sync-heading" className="panel p-3">
      <h2 id="sync-heading" className="flex items-center gap-2 text-sm font-semibold">
        <Cloud aria-hidden="true" size={16} className="text-text-muted" />
        Backup &amp; Sync
      </h2>

      {s.phase === "unconfigured" && (
        <p className="mt-2 text-sm text-text-muted">
          Cloud sync is not set up for this build. Your training is saved on this device; use Export backup below to keep a
          copy.
        </p>
      )}

      {(s.phase === "signed_out" || s.phase === "signing_in" || (s.phase === "error" && s.userId === null)) && (
        <>
          <p className="mt-2 text-sm text-text-muted">
            Optional. Sign in to copy your training to your own cloud space and keep your phones in step. ABOT works the same
            without it.
          </p>
          <Button
            variant="primary"
            onClick={() => void s.signIn()}
            disabled={s.phase === "signing_in"}
            className="mt-3 w-full"
          >
            {s.phase === "signing_in" ? "Opening Google" : "Sign in with Google to Backup & Sync"}
          </Button>
        </>
      )}

      {signedIn && (
        <>
          <p className="mt-2 text-sm">
            Signed in as <span className="font-semibold">{s.email ?? "your Google account"}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted" role="status">
            {s.phase === "offline" ? (
              <CloudOff aria-hidden="true" size={14} />
            ) : (
              <RefreshCw aria-hidden="true" size={14} className={s.phase === "syncing" ? "animate-spin motion-reduce:animate-none" : ""} />
            )}
            {status}
          </p>
          {s.conflictCount > 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {s.conflictCount} older {s.conflictCount === 1 ? "version was" : "versions were"} replaced by newer edits from
              another device and kept on this phone.
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="primary" onClick={() => void s.syncNow()} disabled={s.phase === "syncing"}>
              Sync now
            </Button>
            <Button onClick={() => void s.signOut()}>Sign out</Button>
          </div>
          <p className="mt-2 text-xs text-text-muted">Signing out keeps everything on this device.</p>
        </>
      )}

      {s.phase === "error" && s.lastError && (
        <p role="alert" className="mt-2 text-sm text-failure">
          {s.userId ? `Sync failed: ${s.lastError}` : s.lastError}
        </p>
      )}
    </section>
  );
}

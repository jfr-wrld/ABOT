"use client";

import { useEffect } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSyncStore } from "@/store/useSyncStore";
import { useNow } from "@/lib/useNow";
import { Button } from "@/components/ui/Button";
import { SyncError } from "@/components/sync/SyncError";
import { syncStatus } from "@/lib/syncStatus";
import { InfoTip } from "@/components/ui/InfoTip";
import { useT } from "@/i18n";

/** Settings > Backup & Sync: the optional Google sign-in and the sync status in plain words. */
export function SyncSection() {
  const s = useSyncStore();
  const now = useNow(30_000);
  const t = useT();
  const signedIn = s.phase === "idle" || s.phase === "syncing" || s.phase === "offline" || (s.phase === "error" && s.userId !== null);

  useEffect(() => {
    void useSyncStore.getState().refreshCounts();
  }, []);

  const status = syncStatus(s, now, t);

  return (
    <section aria-labelledby="sync-heading" className="panel p-3">
      <InfoTip
        title={
          <h2 id="sync-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Cloud aria-hidden="true" size={16} className="text-text-muted" />
            {t("Backup & Sync")}
          </h2>
        }
        name={t("backup and sync")}
      >
        {t(
          "Optional. Sign in to copy your training to your own cloud space and keep your phones in step. ABOT works the same without it. Signing out keeps everything on this device.",
        )}
      </InfoTip>

      {s.phase === "unconfigured" && (
        <p className="mt-2 text-sm text-text-muted">
          {t("Cloud sync is not set up for this build. Your training is saved on this device; use Export backup below to keep a copy.")}
        </p>
      )}

      {(s.phase === "signed_out" || s.phase === "signing_in" || (s.phase === "error" && s.userId === null)) && (
        <>
          <Button
            variant="primary"
            onClick={() => void s.signIn()}
            disabled={s.phase === "signing_in"}
            className="mt-3 w-full"
          >
            {s.phase === "signing_in" ? t("Opening Google") : t("Sign in with Google to Backup & Sync")}
          </Button>
        </>
      )}

      {signedIn && (
        <>
          <p className="mt-2 text-sm">
            {t("Signed in as")} <span className="font-semibold">{s.email ?? t("your Google account")}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted" role="status">
            {s.phase === "offline" ? (
              <CloudOff aria-hidden="true" size={14} />
            ) : (
              <RefreshCw aria-hidden="true" size={14} className={s.phase === "syncing" ? "animate-spin motion-reduce:animate-none" : ""} />
            )}
            {status.text}
          </p>
          {s.conflictCount > 0 && (
            <p className="mt-1 text-xs text-text-muted">
              {t.n(
                s.conflictCount,
                "{n} older version was replaced by newer edits from another device and kept on this phone.",
                "{n} older versions were replaced by newer edits from another device and kept on this phone.",
              )}
            </p>
          )}
          {/* Sign out lives at the bottom of the Settings list. */}
          <Button variant="primary" onClick={() => void s.syncNow()} disabled={s.phase === "syncing"} className="mt-3 w-full">
            {s.phase === "error" ? t("Try again") : t("Sync now")}
          </Button>
        </>
      )}

      {s.phase === "error" && s.lastError && (
        <SyncError stage={s.errorStage ?? "sync"} raw={s.lastError} className="mt-2" />
      )}
    </section>
  );
}

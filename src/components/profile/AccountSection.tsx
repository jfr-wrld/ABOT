"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw } from "lucide-react";
import { useSyncStore } from "@/store/useSyncStore";
import { useNow } from "@/lib/useNow";
import { syncStatus, type SyncTone } from "@/lib/syncStatus";
import { Button } from "@/components/ui/Button";
import { SyncError } from "@/components/sync/SyncError";
import { useT, type T } from "@/i18n";

/** Where the Account section lives, and where sign-in comes back to. */
/** Edit profile, where the account section lives. */
export const EDIT_PROFILE = "/profile/edit";

const LINK =
  "flex min-h-11 items-center justify-center rounded-xl border border-ink/[0.12] bg-surface-2 px-3 text-center text-sm font-semibold transition-colors hover:border-ink/25";

/**
 * Profile > Account. The same status Settings shows, so "backed up" is only said when it is
 * true: a failed or pending backup is the thing a lifter most needs to see here.
 */
export function AccountSection() {
  const s = useSyncStore();
  const now = useNow(30_000);
  const signedIn = s.userId !== null && s.phase !== "signed_out" && s.phase !== "signing_in" && s.phase !== "unconfigured";
  const t = useT();

  useEffect(() => {
    void useSyncStore.getState().refreshCounts();
  }, []);

  return (
    <section id="account" aria-labelledby="account-heading" className="panel scroll-mt-16 p-3">
      <h2 id="account-heading" className="label-caps">
        {t("Account")}
      </h2>
      {signedIn ? <SignedIn now={now} /> : <Guest />}
    </section>
  );
}

function chipText(tone: SyncTone | "guest", t: T): string {
  if (tone === "ok") return t("Backed up");
  if (tone === "busy") return t("Backing up");
  if (tone === "pending") return t("Waiting to back up");
  if (tone === "offline") return t("Offline");
  if (tone === "error") return t("Backup failed");
  if (tone === "never") return t("Not backed up yet");
  return t("Guest, not backed up");
}

/** The backup state in two or three words under the name; it jumps to the Account section. */
export function AccountChip() {
  const s = useSyncStore();
  const now = useNow(30_000);
  const signedIn = s.userId !== null && s.phase !== "signed_out" && s.phase !== "signing_in" && s.phase !== "unconfigured";
  const tone: SyncTone | "guest" = signedIn ? syncStatus(s, now).tone : "guest";
  const t = useT();
  return (
    <Link
      href={`${EDIT_PROFILE}#account`}
      className={`-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-1 text-sm font-semibold hover:bg-ink/[0.05] ${
        tone === "error" ? "text-failure" : tone === "ok" ? "text-text" : "text-text-muted"
      }`}
    >
      {tone === "guest" ? (
        <CloudOff aria-hidden="true" size={16} />
      ) : (
        <StatusIcon tone={tone} size={16} />
      )}
      {chipText(tone, t)}
    </Link>
  );
}

function StatusIcon({ tone, size = 20 }: { tone: SyncTone; size?: number }) {
  const cls = size === 20 ? "mt-0.5 shrink-0" : "shrink-0";
  if (tone === "ok") return <CloudCheck aria-hidden="true" size={size} className={`${cls} text-accent`} />;
  if (tone === "error") return <CloudAlert aria-hidden="true" size={size} className={`${cls} text-failure`} />;
  if (tone === "offline") return <CloudOff aria-hidden="true" size={size} className={`${cls} text-text-muted`} />;
  if (tone === "busy")
    return <RefreshCw aria-hidden="true" size={size} className={`${cls} animate-spin text-text-muted motion-reduce:animate-none`} />;
  return <CloudUpload aria-hidden="true" size={size} className={`${cls} text-text-muted`} />;
}

function SignedIn({ now }: { now: number }) {
  const s = useSyncStore();
  const t = useT();
  const status = syncStatus(s, now, t);
  const retry = status.tone === "error" || status.tone === "pending" || status.tone === "never";

  return (
    <>
      <div className="mt-2 flex items-start gap-3">
        <StatusIcon tone={status.tone} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{s.email ?? t("Google account")}</p>
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
          <Button onClick={() => void s.syncNow()}>{status.tone === "error" ? t("Try again") : t("Back up now")}</Button>
        )}
        <Link href="/settings?section=data" className={LINK}>
          {t("Backup & Sync settings")}
        </Link>
      </div>
    </>
  );
}

function Guest() {
  const s = useSyncStore();
  const t = useT();
  return (
    <>
      <div className="mt-2 flex items-start gap-3">
        <CloudOff aria-hidden="true" size={20} className="mt-0.5 shrink-0 text-text-muted" />
        <div>
          <p className="text-sm font-semibold">{t("Guest on this device")}</p>
          <p className="text-sm text-text-muted">{t("Saved on this phone only.")}</p>
        </div>
      </div>
      {s.phase === "error" && s.lastError && (
        <SyncError stage={s.errorStage ?? "sign_in"} raw={s.lastError} className="mt-2 pl-8" />
      )}
      <Link href={`/login?from=${encodeURIComponent(EDIT_PROFILE)}`} className={`mt-3 ${LINK}`}>
        {t("Back up with an account")}
      </Link>
    </>
  );
}

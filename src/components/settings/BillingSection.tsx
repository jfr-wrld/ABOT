"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useRedeemStore } from "@/components/paywall/RedeemCodeModal";
import { useEntitlements, updateEntitlement } from "@/store/useEntitlements";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSyncStore } from "@/store/useSyncStore";
import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { DEFAULT_ENTITLEMENT, SIMULATOR } from "@/lib/entitlements";
import { restoreEntitlementFromAccount, type RestoreResult } from "@/lib/entitlement-sync";
import { PLAN_NAME, billingStatus, type PlanKind } from "@/lib/billing-status";
import { useNow } from "@/lib/useNow";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/** A week or less of PRO left: the card says so in words, not only in colour. */
const ENDS_SOON_DAYS = 7;

const BADGE: Record<PlanKind, string> = {
  pro: "bg-[#ccff00] text-black",
  lifetime: "bg-[#ccff00] text-black",
  beta: "border border-[#ccff00]/60 text-[#ccff00]",
  core: "border border-white/20 text-zinc-300",
};

/**
 * Plan & billing in Settings: what this phone holds now (plan, end date, days left) and the three
 * ways to change it. Reads useEntitlements(), so the simulator and a redeemed code show at once.
 * There is no app store purchase to restore: "Restore from account" brings down a licence held on
 * the signed-in ABOT account, and only shows in builds with cloud sync.
 */
export function BillingSection() {
  const t = useT();
  const e = useEntitlements();
  // A minute is enough for a figure counted in days.
  const now = useNow(60_000);
  const s = billingStatus(e, e.proExpiresAt, now);
  const date = (iso: string) => new Date(iso).toLocaleDateString(t.locale, { day: "2-digit", month: "short", year: "numeric" });
  const simulator = e.devOverrideMode !== "AUTO" && e.devOverrideMode !== "FORCE_BETA" ? SIMULATOR.find((m) => m.mode === e.devOverrideMode) : undefined;

  const badge = { pro: t("Active"), lifetime: t("Active"), beta: t("Beta access"), core: t("PRO locked") }[s.plan];
  const primary = { core: t("Upgrade to Black Pro"), beta: t("Upgrade to Black Pro"), pro: t("Manage plan"), lifetime: t("View plan details") }[s.plan];
  const note =
    s.plan === "beta"
      ? t("Every PRO feature is open while the founders beta runs.")
      : s.plan === "core"
        ? t("PRO features are locked on this phone.")
        : s.plan === "pro" && s.daysLeft !== null && s.daysLeft <= ENDS_SOON_DAYS
          ? t("PRO ends soon. Redeem a code or upgrade to keep it.")
          : null;

  return (
    <section aria-labelledby="billing-heading" className="force-dark rounded-card border border-white/10 bg-[#121215] p-4 text-text">
      <div className="flex items-center justify-between gap-3">
        <h2 id="billing-heading" className="label-caps text-zinc-400">
          {t("Plan & billing")}
        </h2>
        <span className={`shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${BADGE[s.plan]}`}>{badge}</span>
      </div>

      <p className="mt-2 text-2xl font-black tracking-tight text-white">{PLAN_NAME[s.plan]}</p>

      {s.plan === "pro" && (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
          <div>
            <dt className="text-xs text-zinc-400">{t("Expires")}</dt>
            <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">{s.expiresAt ? date(s.expiresAt) : t("No end date")}</dd>
          </div>
          {s.daysLeft !== null && (
            <div>
              <dt className="text-xs text-zinc-400">{t("Days left")}</dt>
              <dd className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${s.daysLeft <= ENDS_SOON_DAYS ? "text-[#f59e0b]" : "text-[#ccff00]"}`}>{s.daysLeft}</dd>
            </div>
          )}
        </dl>
      )}
      {s.plan === "lifetime" && (
        <dl className="mt-3 border-t border-white/10 pt-3">
          <dt className="text-xs text-zinc-400">{t("Expires")}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-white">{t("Does not expire")}</dd>
        </dl>
      )}
      {note && <p className="mt-3 text-sm text-zinc-300">{note}</p>}
      {simulator && <p className="mt-1 text-xs text-zinc-400">{t("Simulator on: {mode}", { mode: t(simulator.label) })}</p>}

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="primary" className="w-full" onClick={() => e.openPaywall()}>
          {primary}
        </Button>
        <Button className="w-full" onClick={() => useRedeemStore.getState().show()}>
          {t("Redeem VIP / activation code")}
        </Button>
        {isCloudSyncConfigured() && <RestoreFromAccount />}
      </div>
    </section>
  );
}

function useSignedIn(): boolean {
  return useSyncStore((s) => s.userId !== null && (s.phase === "idle" || s.phase === "syncing" || s.phase === "offline" || s.phase === "error"));
}

/** Brings the signed-in account's licence to this phone; signed out, it leads to sign-in. */
function RestoreFromAccount() {
  const t = useT();
  const signedIn = useSignedIn();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreResult["kind"] | null>(null);

  if (!signedIn) {
    return (
      <Link
        href="/login?from=/settings"
        className="flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white active:bg-white/[0.08]"
      >
        {t("Sign in to restore from your account")}
      </Link>
    );
  }

  async function restore() {
    setBusy(true);
    setResult(null);
    const r = await restoreEntitlementFromAccount(useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT);
    if (r.kind === "restored") {
      updateEntitlement(r.next);
      feedback.tick();
    }
    setResult(r.kind);
    setBusy(false);
  }

  const message: Record<RestoreResult["kind"], string> = {
    restored: t("License restored from your account."),
    "up-to-date": t("This phone already has your account's license."),
    none: t("No license found on this account."),
    "signed-out": t("Sign in again to restore your license."),
    unavailable: t("Cloud sync is not set up in this build."),
    error: t("Could not reach your account. Check the connection and try again."),
  };

  return (
    <>
      <Button variant="ghost" className="w-full text-zinc-300" onClick={() => void restore()} disabled={busy} aria-busy={busy}>
        {busy ? t("Checking your account...") : t("Restore from account")}
      </Button>
      {result === "error" ? (
        <p role="alert" className="text-center text-xs text-[#f87171]">
          {message.error}
        </p>
      ) : (
        <p role="status" className="min-h-4 text-center text-xs text-zinc-300">
          {result ? message[result] : ""}
        </p>
      )}
    </>
  );
}

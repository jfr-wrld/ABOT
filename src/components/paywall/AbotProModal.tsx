"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Minus, X, Zap } from "@/components/icons";
import { useEntitlements, usePaywallStore, updateEntitlement, autoClaimFounder } from "@/store/useEntitlements";
import Link from "next/link";
import { founderLabel, PRO_FEATURE_LABEL, PRO_MATRIX as MATRIX, annualSaving, planPrice, plansFor, rupiah, type PlanId } from "@/lib/entitlements";
import { CHECKOUT_MESSAGE, checkoutBlock, openPaymentTab, startMidtransCheckout } from "@/lib/checkout";
import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { isNativeApp } from "@/lib/native/files";
import { useRemoteConfig } from "@/lib/remote-config";
import { useRedeemStore } from "./RedeemCodeModal";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { DEV_TOOLS } from "@/lib/dev-tools";

/**
 * ABOT Pro: the upgrade screen, full height, always dark. During the founders beta it
 * says PRO is already open and lets the lifter simulate a plan; in commercial mode the button
 * opens the Midtrans checkout (lib/checkout) when payments are switched on. Midtrans sells one-off
 * payments, so the monthly plan is hidden while it is the checkout, and founders get lifetime at
 * the founder price.
 */
/** What "Simulate activating this plan" writes: the plan's tier and term from now, simulator on Pro. */
function simulatePlan(plan: PlanId) {
  updateEntitlement({
    tier: plan === "lifetime" ? "lifetime" : "pro",
    proExpiresAt: plan === "lifetime" ? null : new Date(Date.now() + (plan === "annual" ? 365 : 30) * 86_400_000).toISOString(),
    devOverrideMode: "FORCE_PRO",
  });
}

export function AbotProModal() {
  const t = useT();
  const open = usePaywallStore((s) => s.open);
  const feature = usePaywallStore((s) => s.feature);
  const close = usePaywallStore((s) => s.close);
  const { isBetaUnlocked, tier, isFounder, founderUnitCode, proExpiresAt } = useEntitlements();
  const paid = tier === "pro" || tier === "lifetime";
  const [plan, setPlan] = useState<PlanId>("annual");
  // Prices from Mission Control (remote config), the built-in ones until it answers.
  const prices = useRemoteConfig((s) => s.config.prices);
  const checkoutOn = useRemoteConfig((s) => s.config.checkoutEnabled && (!isNativeApp() || s.config.checkoutOnAndroid)) && isCloudSyncConfigured();
  const ALL_PLANS = plansFor(prices);
  const PLANS = ALL_PLANS.filter((p) => !checkoutOn || p.id !== "monthly");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const showRedeem = useRedeemStore((s) => s.show);
  const [note, setNote] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Prices and the checkout switch can change in Mission Control at any time; the background read
  // runs only every 6 hours, so the paywall reads the row fresh each time it opens.
  useEffect(() => {
    if (open) void useRemoteConfig.getState().refresh(true);
  }, [open]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const done = () => {
    setNote(null);
    close();
  };

  async function checkout() {
    // First thing in the tap, before any await: browsers only allow a new tab from the tap itself.
    const tab = openPaymentTab();
    feedback.tick();
    setNeedsSignIn(false);
    // The fresh read may still be on its way: wait for it once before saying payments are off.
    if (!checkoutOn) await useRemoteConfig.getState().refresh(true);
    const blocked = checkoutBlock();
    if (blocked || plan === "monthly") {
      tab?.close();
      setNote(t(CHECKOUT_MESSAGE[blocked ?? "checkout_off"]));
      return;
    }
    setBusy(true);
    const r = await startMidtransCheckout(plan === "lifetime" && isFounder ? "founders" : plan, tab);
    setBusy(false);
    // The paywall steps aside so the waiting line, then the celebration, can show.
    if (r.ok) done();
    else {
      setNeedsSignIn(r.reason === "sign_in");
      // The technical detail (status, Midtrans' own words) helps the owner debug a failed setup.
      setNote(t(CHECKOUT_MESSAGE[r.reason]) + (r.detail && r.reason === "gateway" ? ` (${r.detail})` : ""));
    }
  }

  function simulate() {
    feedback.setComplete();
    simulatePlan(plan);
    setNote(t("Simulated: {plan} active on this device. Switch back in Settings, Founder pass.", { plan: t(PLANS.find((p) => p.id === plan)!.name) }));
  }

  // Against twelve months of the monthly price, even while monthly is not on sale here.
  const saving = annualSaving(ALL_PLANS);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={done}
      onCancel={done}
      className="force-dark m-0 h-[100dvh] max-h-none w-full max-w-none bg-bg p-0 text-text backdrop:bg-black/80"
    >
      <div className="relative mx-auto flex min-h-full max-w-[560px] flex-col gap-5 px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
        {/* One soft Volt light behind the title. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64"
          style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, color-mix(in oklab, var(--color-accent) 14%, transparent), transparent 65%)" }}
        />
        <header className="relative flex items-center justify-between gap-3 pt-2">
          <h2 id={titleId} className="text-3xl font-extrabold leading-[1.05] tracking-tight">
            {t("ABOT Pro")}
          </h2>
          <button type="button" onClick={done} aria-label={t("Close")} className="glass-icon flex size-11 shrink-0 items-center justify-center rounded-full text-text">
            <X aria-hidden="true" size={22} />
          </button>
        </header>

        {feature && (
          <p className="raised-card relative flex items-center gap-2.5 rounded-card bg-surface px-3 py-2.5 text-sm font-semibold">
            <span className="tile flex size-8 shrink-0 items-center justify-center rounded-full text-accent">
              <Zap aria-hidden="true" size={16} />
            </span>
            {t("Unlock feature: {name}", { name: t(PRO_FEATURE_LABEL[feature]) })}
          </p>
        )}

        <div className="raised-card relative rounded-card bg-surface px-3 pb-1 pt-3">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{t("ABOT Free against ABOT Pro")}</caption>
            <thead>
              <tr className="text-xs text-text-muted">
                <th scope="col" className="pb-2 font-semibold" />
                <th scope="col" className="w-20 pb-2 text-center font-semibold">
                  {t("Free")}
                </th>
                <th scope="col" className="w-24 pb-2 text-center font-bold text-accent">
                  Pro
                </th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.feature} className="border-t border-line">
                  <th scope="row" className="py-2.5 pr-2 text-left text-[13px] font-medium">
                    {t(row.feature)}
                  </th>
                  {[row.core, row.pro].map((v, i) => (
                    <td key={i} className="num py-2.5 text-center text-xs">
                      {v === true ? (
                        <Check aria-label={t("Included")} size={16} className={`mx-auto ${i ? "text-accent" : "text-text"}`} />
                      ) : v === false ? (
                        <Minus aria-label={t("Not included")} size={16} className="mx-auto text-text-muted opacity-50" />
                      ) : (
                        <span className={i ? "font-semibold text-accent" : "text-text-muted"}>{t(v)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Plans in the app's chip material: raised to pick, sunk with a Volt edge once picked. */}
        <fieldset className="relative flex flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-text-muted">{t("Choose a plan")}</legend>
          {PLANS.map((p) => {
            const price = planPrice(p, isFounder);
            const selected = plan === p.id;
            const best = p.id === "annual";
            return (
              <label
                key={p.id}
                className={`chip tap relative flex min-h-16 cursor-pointer items-center gap-3 rounded-card px-3 py-3 ${selected ? "border border-accent bg-accent/[0.07]" : ""}`}
              >
                <input type="radio" name="abot-plan" value={p.id} checked={selected} onChange={() => setPlan(p.id)} className="peer sr-only" />
                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-accent" : "border-text-muted/60"}`}>
                  {selected && <span className="size-2.5 rounded-full bg-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{t(p.name)}</span>
                  <span className="block text-xs text-text-muted">
                    {p.id === "annual"
                      ? t("Save {pct}% · about {month} a month", { pct: saving, month: rupiah(p.idr / 12) })
                      : p.id === "lifetime" && isFounder
                        ? t("Founder price: 50% off")
                        : t(p.note)}
                  </span>
                </span>
                <span className="num shrink-0 text-right">
                  {price.was && <span className="block text-[11px] text-text-muted line-through">{rupiah(price.was.idr)}</span>}
                  <span className="block text-base font-bold">{rupiah(price.idr)}</span>
                  <span className="block text-[11px] text-text-muted">
                    {p.per === "month" ? t("per month") : p.per === "year" ? t("per year") : t("once")} · ${price.usd.toFixed(2)}
                  </span>
                </span>
                {best && (
                  <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-px text-[11px] font-bold text-on-accent">
                    {t("Best value · save {pct}%", { pct: saving })}
                  </span>
                )}
                {p.id === "lifetime" && (
                  <span className="absolute -top-2.5 right-3 rounded-full border border-accent/60 bg-bg px-2 py-px text-[11px] font-bold text-accent">
                    {t("Limited edition")}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        <div className="relative flex flex-col gap-2">
          {paid ? (
            <>
              {/* A paid licence outranks the beta: say what was bought, and until when. */}
              <p role="status" className="raised-card rounded-card border border-accent/50 bg-surface px-3 py-3 text-sm font-semibold text-accent">
                {tier === "lifetime" ? t("Active: lifetime license") : t("Active: ABOT Pro")}
                {tier === "pro" && proExpiresAt && (
                  <span className="mt-1 block font-normal text-text-muted">{t("Until {date}", { date: new Date(proExpiresAt).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" }) })}</span>
                )}
              </p>
              {tier === "pro" && checkoutOn && plan !== "monthly" && (
                <BuyButton busy={busy} onClick={() => void checkout()} label={plan === "lifetime" ? t("Upgrade to lifetime") : t("Add another year")} />
              )}
            </>
          ) : isBetaUnlocked ? (
            <>
              <p role="status" className="raised-card rounded-card border border-accent/50 bg-surface px-3 py-3 text-sm font-semibold text-accent">
                {t("Founders beta: every Pro feature is free for now.")}
                {founderUnitCode && <span className="num mt-1 block font-normal text-text-muted">{founderLabel(founderUnitCode)}</span>}
              </p>
              <button
                type="button"
                onClick={() => {
                  autoClaimFounder();
                  feedback.tick();
                  setNote(t("Founder pass verified on this device."));
                }}
                className="raised min-h-12 rounded-xl font-semibold text-text"
              >
                {isFounder ? t("Verify Founder Pass") : t("Claim Founder Pass")}
              </button>
              {checkoutOn && plan !== "monthly" && <BuyButton busy={busy} onClick={() => void checkout()} label={t("Buy {plan}", { plan: t(PLANS.find((p) => p.id === plan)?.name ?? "") })} />}
              {DEV_TOOLS && (
                <button type="button" onClick={simulate} className="min-h-11 rounded-ctl text-sm font-semibold text-text-muted underline-offset-4 hover:text-text hover:underline">
                  {t("Simulate activating this plan")}
                </button>
              )}
            </>
          ) : (
            <>
              <BuyButton busy={busy} onClick={() => void checkout()} label={t("Activate {plan}", { plan: t(PLANS.find((p) => p.id === plan)?.name ?? "") })} />
              {DEV_TOOLS && (
                <button type="button" onClick={simulate} className="min-h-11 rounded-ctl text-sm font-semibold text-text-muted underline-offset-4 hover:text-text hover:underline">
                  {t("Simulate activating this plan")}
                </button>
              )}
            </>
          )}
          {note && (
            <p role="status" className="text-center text-xs text-text-muted">
              {note}
            </p>
          )}
          {needsSignIn && (
            <Link href="/login?from=/settings" onClick={done} className="raised min-h-11 rounded-xl px-4 py-3 text-center text-sm font-semibold text-text">
              {t("Sign in to buy")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              done();
              showRedeem();
            }}
            className="min-h-11 rounded-xl text-sm font-semibold text-accent underline-offset-4 hover:underline"
          >
            {t("Redeem a code")}
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** The one Volt action: opens the payment page, or says what is missing. */
function BuyButton({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className="min-h-14 rounded-xl bg-accent text-base font-bold text-on-accent hover:brightness-105 disabled:opacity-60"
    >
      {busy ? t("Opening payment...") : label}
    </button>
  );
}

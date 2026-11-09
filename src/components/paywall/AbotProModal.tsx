"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Minus, X, Zap } from "lucide-react";
import { useEntitlements, usePaywallStore, updateEntitlement, autoClaimFounder } from "@/store/useEntitlements";
import Link from "next/link";
import { PRO_FEATURE_LABEL, PRO_MATRIX as MATRIX, annualSaving, planPrice, plansFor, rupiah, type PlanId } from "@/lib/entitlements";
import { CHECKOUT_MESSAGE, checkoutBlock, startMidtransCheckout } from "@/lib/checkout";
import { isCloudSyncConfigured } from "@/data/sync/supabase";
import { isNativeApp } from "@/lib/native/files";
import { useRemoteConfig } from "@/lib/remote-config";
import { useRedeemStore } from "./RedeemCodeModal";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * ABOT // BLACK PRO: the upgrade screen, full height, always dark. During the founders beta it
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
  const { isBetaUnlocked, proActive, tier, isFounder, founderUnitCode } = useEntitlements();
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
    feedback.tick();
    setNeedsSignIn(false);
    // The fresh read may still be on its way: wait for it once before saying payments are off.
    if (!checkoutOn) await useRemoteConfig.getState().refresh(true);
    const blocked = checkoutBlock();
    if (blocked || plan === "monthly") {
      setNote(t(CHECKOUT_MESSAGE[blocked ?? "checkout_off"]));
      return;
    }
    setBusy(true);
    const r = await startMidtransCheckout(plan === "lifetime" && isFounder ? "founders" : plan);
    setBusy(false);
    if (r.ok) setNote(t("Payment page opened. PRO turns on here once Midtrans confirms the payment."));
    else {
      setNeedsSignIn(r.reason === "sign_in");
      setNote(t(CHECKOUT_MESSAGE[r.reason]));
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
      className="force-dark m-0 h-[100dvh] max-h-none w-full max-w-none bg-[#09090b] p-0 text-text backdrop:bg-black/80"
    >
      <div className="relative mx-auto flex min-h-full max-w-[560px] flex-col gap-5 px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(12px+env(safe-area-inset-top))]">
        {/* Technical grid and a Volt glow behind the header. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 50% 0%, rgb(204 255 0 / 0.16), transparent 60%), linear-gradient(rgb(255 255 255 / 0.04) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.04) 1px, transparent 1px)",
            backgroundSize: "100% 100%, 24px 24px, 24px 24px",
          }}
        />
        <div className="relative flex items-center justify-between">
          <span className="rounded-[4px] border border-[#ccff00]/50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#ccff00]">
            ABOT // BLACK TELEMETRY SYSTEM
          </span>
          <button type="button" onClick={done} aria-label={t("Close")} className="flex size-11 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white">
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <header className="relative">
          <h2 id={titleId} className="text-3xl font-extrabold uppercase leading-[1.05] tracking-tight">
            {t("Precision engineered for serious lifters.")}
          </h2>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">ABOT // BLACK PRO</p>
        </header>

        {feature && (
          <p className="relative flex items-center gap-2 rounded-ctl border border-[#ccff00]/40 bg-[#ccff00]/[0.06] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-[#ccff00]">
            <Zap aria-hidden="true" size={14} className="shrink-0 fill-[#ccff00]" />
            {t("Unlock feature: {name}", { name: t(PRO_FEATURE_LABEL[feature]) })}
          </p>
        )}

        <table className="relative w-full border-collapse text-left text-xs">
          <caption className="sr-only">{t("ABOT Core against ABOT // BLACK PRO")}</caption>
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              <th scope="col" className="pb-2 font-semibold" />
              <th scope="col" className="w-20 pb-2 text-center font-semibold">
                {t("Core (free)")}
              </th>
              <th scope="col" className="w-24 pb-2 text-center font-semibold text-[#ccff00]">
                BLACK PRO
              </th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.feature} className="border-t border-[#27272a]">
                <th scope="row" className="py-2.5 pr-2 text-left text-[13px] font-medium text-zinc-200">
                  {t(row.feature)}
                </th>
                {[row.core, row.pro].map((v, i) => (
                  <td key={i} className="py-2.5 text-center font-mono tabular-nums">
                    {v === true ? (
                      <Check aria-label={t("Included")} size={16} className={`mx-auto ${i ? "text-[#ccff00]" : "text-zinc-300"}`} />
                    ) : v === false ? (
                      <Minus aria-label={t("Not included")} size={16} className="mx-auto text-zinc-600" />
                    ) : (
                      <span className={i ? "text-[#ccff00]" : "text-zinc-400"}>{t(v)}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <fieldset className="relative flex flex-col gap-2">
          <legend className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">{t("Choose a plan")}</legend>
          {PLANS.map((p) => {
            const price = planPrice(p, isFounder);
            const selected = plan === p.id;
            const best = p.id === "annual";
            return (
              <label
                key={p.id}
                className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-ctl border bg-[#121215] px-3 py-3 transition-colors ${
                  selected ? (best ? "border-[#ccff00] shadow-[0_0_18px_rgb(204_255_0/0.18)]" : "border-zinc-300") : best ? "border-[#ccff00]/50" : "border-[#27272a]"
                }`}
              >
                <input type="radio" name="abot-plan" value={p.id} checked={selected} onChange={() => setPlan(p.id)} className="peer sr-only" />
                <span aria-hidden="true" className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[#ccff00]" : "border-zinc-600"}`}>
                  {selected && <span className="size-2.5 rounded-full bg-[#ccff00]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-white">{t(p.name)}</span>
                  <span className="block text-xs text-zinc-400">
                    {p.id === "annual"
                      ? t("Save {pct}% · about {month} a month", { pct: saving, month: rupiah(p.idr / 12) })
                      : p.id === "lifetime" && isFounder
                        ? t("Founder 50% off privilege applied")
                        : t(p.note)}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono tabular-nums">
                  {price.was && <span className="block text-[11px] text-zinc-400 line-through">{rupiah(price.was.idr)}</span>}
                  <span className="block text-sm font-bold text-white">{rupiah(price.idr)}</span>
                  <span className="block text-[10px] uppercase text-zinc-400">
                    {p.per === "month" ? t("per month") : p.per === "year" ? t("per year") : t("once")} · ${price.usd.toFixed(2)}
                  </span>
                </span>
                {best && (
                  <span className="absolute -top-2.5 right-3 rounded-[4px] bg-[#ccff00] px-1.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-black">
                    {t("Best value · save {pct}%", { pct: saving })}
                  </span>
                )}
                {p.id === "lifetime" && (
                  <span className="absolute -top-2.5 right-3 rounded-[4px] border border-[#ccff00]/60 bg-black px-1.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[#ccff00]">
                    {t("Limited edition")}
                  </span>
                )}
              </label>
            );
          })}
        </fieldset>

        <div className="relative flex flex-col gap-2">
          {isBetaUnlocked ? (
            <>
              <p role="status" className="rounded-ctl border border-[#ccff00] bg-[#ccff00]/10 px-3 py-3 font-mono text-[11px] font-bold uppercase leading-relaxed tracking-[0.08em] text-[#ccff00]">
                ⚡ {t("Active: Founders Beta Pass. All PRO features unlocked free.")}
                {founderUnitCode && <span className="mt-1 block text-zinc-300">{founderUnitCode}</span>}
              </p>
              <button
                type="button"
                onClick={() => {
                  autoClaimFounder();
                  feedback.tick();
                  setNote(t("Founder pass verified on this device."));
                }}
                className="min-h-12 rounded-ctl border border-[#27272a] bg-[#121215] font-semibold text-white hover:border-zinc-500"
              >
                {isFounder ? t("Verify Founder Pass") : t("Claim Founder Pass")}
              </button>
              {checkoutOn && plan !== "monthly" && <BuyButton busy={busy} onClick={() => void checkout()} label={t("Buy {plan}", { plan: t(PLANS.find((p) => p.id === plan)?.name ?? "") })} />}
              <button type="button" onClick={simulate} className="min-h-11 rounded-ctl text-sm font-semibold text-zinc-400 underline-offset-4 hover:text-white hover:underline">
                {t("Simulate activating this plan")}
              </button>
            </>
          ) : proActive ? (
            <p role="status" className="rounded-ctl border border-[#ccff00] px-3 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#ccff00]">
              {tier === "lifetime" ? t("Active: lifetime license") : t("Active: ABOT // BLACK PRO")}
            </p>
          ) : (
            <>
              <BuyButton busy={busy} onClick={() => void checkout()} label={t("Activate {plan}", { plan: t(PLANS.find((p) => p.id === plan)?.name ?? "") })} />
              <button type="button" onClick={simulate} className="min-h-11 rounded-ctl text-sm font-semibold text-zinc-400 underline-offset-4 hover:text-white hover:underline">
                {t("Simulate activating this plan")}
              </button>
            </>
          )}
          {note && (
            <p role="status" className="text-center text-xs text-zinc-300">
              {note}
            </p>
          )}
          {needsSignIn && (
            <Link href="/login?from=/settings" onClick={done} className="min-h-11 rounded-ctl border border-[#27272a] px-4 py-3 text-center text-sm font-semibold text-white hover:border-zinc-500">
              {t("Sign in to buy")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              done();
              showRedeem();
            }}
            className="min-h-11 rounded-ctl border border-dashed border-[#ccff00]/50 font-mono text-xs font-bold uppercase tracking-[0.1em] text-[#ccff00] hover:bg-[#ccff00]/10"
          >
            {t("Redeem VIP / activation code")}
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
      className="min-h-14 rounded-ctl bg-[#ccff00] font-mono text-sm font-black uppercase tracking-[0.1em] text-black hover:brightness-95 disabled:opacity-60"
    >
      {busy ? t("Opening payment...") : label}
    </button>
  );
}

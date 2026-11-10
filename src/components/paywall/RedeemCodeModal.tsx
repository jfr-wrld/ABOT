"use client";

import { useEffect, useId, useRef, useState } from "react";
import { create } from "zustand";
import { KeyRound, X, Zap } from "lucide-react";
import { redeemLicenseCode, type Grant } from "@/lib/redeem-service";
import { applyGrant } from "@/lib/entitlements";
import { useSettingsStore } from "@/store/useSettingsStore";
import { updateEntitlement } from "@/store/useEntitlements";
import { DEFAULT_ENTITLEMENT } from "@/lib/entitlements";
import { feedback } from "@/lib/feedback";
import { newId } from "@/lib/id";
import { useT } from "@/i18n";
import { motion } from "framer-motion";
import { useShake } from "@/lib/useShake";

/** One redeem sheet for the app: opened from the paywall and from the founder card. */
export const useRedeemStore = create<{ open: boolean; show: () => void; close: () => void }>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false }),
}));

/** Checks the code, applies what it grants to this device, and plays the record chord. */
export async function redeemAndApply(input: string): Promise<{ ok: true; grant: Grant } | { ok: false; reason: string }> {
  const r = await redeemLicenseCode(input);
  if (!r.ok) return r;
  const current = useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT;
  updateEntitlement(applyGrant(current, r.grant, `${newId()}-${r.code}`, Date.now(), r.onAccount ? "account" : "device"));
  feedback.pr();
  return { ok: true, grant: r.grant };
}

/**
 * Enter a VIP, influencer or promo code. A valid one unlocks at once, with the record chord and
 * a Volt confirmation; a wrong one says so without clearing what was typed.
 */
export function RedeemCodeModal() {
  const t = useT();
  const open = useRedeemStore((s) => s.open);
  const close = useRedeemStore((s) => s.close);
  if (!open) return null;
  return <RedeemDialog onClose={close} t={t} />;
}

function RedeemDialog({ onClose, t }: { onClose: () => void; t: ReturnType<typeof useT> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { controls, shake } = useShake();
  const [granted, setGranted] = useState<Grant | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await redeemAndApply(code);
    setBusy(false);
    if (r.ok) setGranted(r.grant);
    else {
      setError(t(r.reason));
      shake();
    }
  }

  const access = granted
    ? granted.tier === "lifetime"
      ? t("Lifetime access")
      : t("{n} days access", { n: granted.days ?? 30 })
    : "";

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className="force-dark m-auto w-[calc(100%-32px)] max-w-md rounded-card border border-[#ccff00]/40 bg-[#09090b] p-0 text-text backdrop:bg-black/80"
    >
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-[#ccff00]">
            <KeyRound aria-hidden="true" size={16} /> {t("Redeem license code")}
          </h2>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-white">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        {granted ? (
          <div role="status" className="flex flex-col items-center gap-3 rounded-ctl border border-[#ccff00] bg-[#ccff00]/10 px-4 py-6 text-center motion-safe:animate-[pulse_1.2s_ease-out_1]">
            <Zap aria-hidden="true" size={32} className="fill-[#ccff00] text-[#ccff00]" />
            <p className="font-mono text-sm font-black uppercase leading-relaxed tracking-[0.1em] text-[#ccff00]">
              {t("License activated: ABOT // BLACK PRO")}
              <span className="block text-white">[{access}]</span>
            </p>
            {granted.founder && <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-300">{t("Founder badge unlocked")}</p>}
            <button type="button" onClick={onClose} className="mt-1 min-h-11 rounded-ctl bg-[#ccff00] px-6 font-mono text-xs font-black uppercase tracking-[0.12em] text-black">
              {t("Done")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <label htmlFor="redeem-code" className="text-sm text-zinc-300">
              {t("VIP, influencer or promo code")}
            </label>
            <motion.input
              animate={controls}
              id="redeem-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "redeem-error" : undefined}
              className="min-h-14 w-full rounded-ctl border border-[#27272a] bg-[#121215] px-3 text-center font-mono text-lg uppercase tabular-nums tracking-widest text-white placeholder:text-zinc-600 focus:border-[#ccff00] focus:outline-none"
            />
            {error && (
              <p id="redeem-error" role="alert" className="text-sm text-failure">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !code.trim()}
              className="min-h-12 rounded-ctl bg-[#ccff00] font-mono text-sm font-black uppercase tracking-[0.12em] text-black disabled:opacity-40"
            >
              {busy ? t("Checking...") : t("Activate")}
            </button>
          </form>
        )}
      </div>
    </dialog>
  );
}

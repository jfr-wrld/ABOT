"use client";

import { Lock } from "lucide-react";
import { useEntitlements } from "@/store/useEntitlements";
import type { ProFeatureKey } from "@/lib/entitlements";
import { useT } from "@/i18n";

/**
 * The micro PRO tag on premium features. "PRO // BETA" while the founders beta has them open,
 * "PRO" otherwise, with a lock when this lifter cannot use the feature. `suffix` names a family
 * ("TELEMETRY"). Always on black, so Volt reads the same in both themes.
 */
export function ProBadge({ suffix, className = "" }: { suffix?: string; className?: string }) {
  const { isBetaUnlocked, proActive } = useEntitlements();
  const t = useT();
  const text = isBetaUnlocked ? `PRO // ${t("BETA")}` : suffix ? `PRO // ${suffix}` : "PRO";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-[#ccff00]/60 bg-black px-1.5 py-px font-mono text-[9px] font-bold uppercase leading-4 tracking-[0.12em] text-[#ccff00] ${className}`}
    >
      {!proActive && <Lock aria-hidden="true" size={9} />}
      {text}
    </span>
  );
}

/**
 * What a locked PRO area shows instead of its content: one line on what it does and the way to
 * unlock it. Keeps the space the content would take, so nothing jumps when it opens.
 */
export function ProLock({ feature, text, className = "" }: { feature: ProFeatureKey; text: string; className?: string }) {
  const { openPaywall } = useEntitlements();
  const t = useT();
  return (
    <div className={`force-dark flex flex-col items-start gap-2 rounded-ctl border border-[#ccff00]/30 bg-black/90 p-3 text-text ${className}`}>
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[#ccff00]">
        <Lock aria-hidden="true" size={12} /> {t("Locked: ABOT // BLACK")}
      </p>
      <p className="text-xs text-zinc-300">{text}</p>
      <button
        type="button"
        onClick={() => openPaywall(feature)}
        className="min-h-11 rounded-ctl border border-[#ccff00] px-3 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[#ccff00] hover:bg-[#ccff00]/10"
      >
        {t("Unlock with ABOT // BLACK")}
      </button>
    </div>
  );
}

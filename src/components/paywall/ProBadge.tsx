"use client";

import { Lock } from "@/components/icons";
import { useEntitlements } from "@/store/useEntitlements";
import type { ProFeatureKey } from "@/lib/entitlements";
import { useT } from "@/i18n";

/**
 * The small Pro tag on premium features: "Pro · beta" while the founders beta has them open,
 * "Pro" otherwise, with a lock when this lifter cannot use the feature. An outlined tag in the
 * accent, like the PRO tag on the body phase card: gold now means a record (owner, 2026-11-15).
 */
export function ProBadge({ className = "" }: { suffix?: string; className?: string }) {
  const { isBetaUnlocked, proActive } = useEntitlements();
  const t = useT();
  const text = isBetaUnlocked ? t("Pro · beta") : "Pro";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/50 px-1.5 py-px text-[11px] font-bold leading-4 text-accent ${className}`}>
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
    <div className={`flex flex-col items-start gap-2 rounded-ctl border border-line bg-surface-2 p-3 text-text ${className}`}>
      <p className="flex items-center gap-2 text-xs font-semibold">
        <Lock aria-hidden="true" size={12} /> {t("Locked: ABOT Pro")}
      </p>
      <p className="text-xs text-text-muted">{text}</p>
      <button
        type="button"
        onClick={() => openPaywall(feature)}
        className="min-h-11 rounded-ctl bg-accent px-3 text-sm font-semibold text-on-accent"
      >
        {t("Unlock with ABOT Pro")}
      </button>
    </div>
  );
}

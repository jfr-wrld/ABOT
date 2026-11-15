"use client";

import { Lock } from "lucide-react";
import { useEntitlements } from "@/store/useEntitlements";
import type { ProFeatureKey } from "@/lib/entitlements";
import { useT } from "@/i18n";

/**
 * The small Pro tag on premium features: "Pro · beta" while the founders beta has them open,
 * "Pro" otherwise, with a lock when this lifter cannot use the feature. Gold, the records colour,
 * as a plain outlined tag.
 */
export function ProBadge({ className = "" }: { suffix?: string; className?: string }) {
  const { isBetaUnlocked, proActive } = useEntitlements();
  const t = useT();
  const text = isBetaUnlocked ? t("Pro · beta") : "Pro";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-pr/50 px-1.5 py-px text-[11px] font-semibold leading-4 text-pr ${className}`}>
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

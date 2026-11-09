"use client";

import { AbotMark } from "@/components/brand/AbotMark";
import { useEntitlements } from "@/store/useEntitlements";
import { useT } from "@/i18n";

/**
 * The paid plan as a small Volt tag beside a name: PRO or LIFETIME. Nothing for free or beta
 * users, so the tag only ever means something was bought.
 */
export function PlanBadge({ className = "" }: { className?: string }) {
  const t = useT();
  const { tier } = useEntitlements();
  if (tier !== "pro" && tier !== "lifetime") return null;
  const label = tier === "lifetime" ? "LIFETIME" : "PRO";
  return (
    <span
      title={tier === "lifetime" ? t("Lifetime license") : "ABOT // BLACK PRO"}
      className={`inline-flex shrink-0 items-center gap-1 rounded-[5px] bg-[#ccff00] px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase leading-none tracking-[0.1em] text-black ${className}`}
    >
      <AbotMark size={11} />
      {label}
    </span>
  );
}

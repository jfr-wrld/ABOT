"use client";

import { useEntitlements } from "@/store/useEntitlements";
import type { DevOverride } from "@/lib/entitlements";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

const SIMULATOR: { mode: DevOverride; label: string }[] = [
  { mode: "AUTO", label: "Beta mode" },
  { mode: "FORCE_FREE", label: "Free locked" },
  { mode: "FORCE_PRO", label: "Pro active" },
];

/**
 * ABOT // FOUNDER TELEMETRY PASS: a steel plate with the unit number, the join date and what is
 * unlocked, at the top of Settings. Its simulator switches the whole app between the beta, a
 * locked free user and a paying user, for demos and testing.
 */
export function FounderPassCard() {
  const t = useT();
  const { isFounder, founderUnitCode, founderJoinedAt, proActive, isBetaUnlocked, tier, devOverrideMode, setDevOverride, openPaywall } = useEntitlements();
  const joined = founderJoinedAt ? new Date(founderJoinedAt).toLocaleDateString(t.locale, { day: "2-digit", month: "short", year: "numeric" }) : null;
  const status = isBetaUnlocked ? t("All telemetry unlocked") : proActive ? (tier === "lifetime" ? t("Lifetime license active") : t("Black Pro active")) : t("Core: PRO locked");

  return (
    <section
      aria-labelledby="founder-heading"
      className="force-dark relative overflow-hidden rounded-card border border-[#ccff00]/40 bg-gradient-to-br from-[#141418] to-[#09090b] p-4 text-text shadow-[0_0_24px_rgb(204_255_0/0.08)]"
    >
      {/* Rivets, like a plate bolted to the machine. */}
      {["left-2 top-2", "right-2 top-2", "bottom-2 left-2", "bottom-2 right-2"].map((p) => (
        <span key={p} aria-hidden="true" className={`absolute ${p} size-1.5 rounded-full bg-zinc-600`} />
      ))}
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#ccff00]">ABOT // FOUNDER TELEMETRY PASS</p>
      <h2 id="founder-heading" className="mt-2 font-mono text-xl font-black tabular-nums tracking-[0.06em] text-white">
        {isFounder && founderUnitCode ? founderUnitCode.replace("FOUNDER //", "FOUNDER UNIT //") : t("No founder unit")}
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-[11px] uppercase tracking-[0.08em]">
        <div>
          <dt className="text-zinc-500">{t("Activated")}</dt>
          <dd className="tabular-nums text-zinc-200">{joined ?? "-"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("Status")}</dt>
          <dd className={proActive ? "text-[#ccff00]" : "text-[#f59e0b]"}>{status}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() => openPaywall()}
        className="mt-4 min-h-11 w-full rounded-ctl border border-[#ccff00]/70 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#ccff00] hover:bg-[#ccff00]/10"
      >
        {t("View ABOT // BLACK PRO specs")}
      </button>

      <div className="mt-4 border-t border-[#27272a] pt-3">
        <p id="sim-label" className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {t("Monetization simulator")}
        </p>
        <div role="radiogroup" aria-labelledby="sim-label" className="mt-2 grid grid-cols-3 gap-1 rounded-ctl border border-[#27272a] bg-black p-1">
          {SIMULATOR.map((s) => {
            const on = devOverrideMode === s.mode || (s.mode === "AUTO" && devOverrideMode === "FORCE_BETA");
            return (
              <button
                key={s.mode}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  feedback.tick();
                  setDevOverride(s.mode);
                }}
                className={`min-h-11 rounded-[calc(var(--radius-ctl)-4px)] px-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] transition-colors ${
                  on ? "bg-[#ccff00] text-black" : "text-zinc-400 hover:text-white"
                }`}
              >
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

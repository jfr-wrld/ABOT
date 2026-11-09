"use client";

import { useEntitlements } from "@/store/useEntitlements";
import { SIMULATOR } from "@/lib/entitlements";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * ABOT // FOUNDER TELEMETRY PASS: a steel plate with the unit number and the join date, at the top
 * of Settings. Its simulator switches the whole app between the beta, a locked free user and a
 * paying user, for demos and testing. The plan itself and its actions are in BillingSection.
 */
export function FounderPassCard() {
  const t = useT();
  const { isFounder, founderUnitCode, founderJoinedAt, devOverrideMode, setDevOverride } = useEntitlements();
  const joined = founderJoinedAt ? new Date(founderJoinedAt).toLocaleDateString(t.locale, { day: "2-digit", month: "short", year: "numeric" }) : null;

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
      <dl className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em]">
        <dt className="text-zinc-400">{t("Activated")}</dt>
        <dd className="tabular-nums text-zinc-200">{joined ?? "-"}</dd>
      </dl>

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

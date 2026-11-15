"use client";

import { useEntitlements } from "@/store/useEntitlements";
import { SIMULATOR, founderLabel } from "@/lib/entitlements";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { DEV_TOOLS } from "@/lib/dev-tools";

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
      className="force-dark relative overflow-hidden rounded-card border border-accent/40 bg-surface px-4 py-3 text-text"
    >
      {/* Rivets, like a plate bolted to the machine. */}
      {["left-2 top-2", "right-2 top-2", "bottom-2 left-2", "bottom-2 right-2"].map((p) => (
        <span key={p} aria-hidden="true" className={`absolute ${p} size-1.5 rounded-full bg-line-strong`} />
      ))}
      {/* Pass name and join date on one line, the unit number under them: the plate reads in one glance. */}
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <p className="font-semibold text-pr">{t("Founder pass")}</p>
        {joined && <p className="shrink-0 tabular-nums text-text-muted">{t("Since {date}", { date: joined })}</p>}
      </div>
      <h2 id="founder-heading" className="mt-1 text-lg font-bold tabular-nums text-text">
        {isFounder && founderUnitCode ? founderLabel(founderUnitCode) : t("No founder number")}
      </h2>

      {/* Development builds only: release builds leave the simulator out (see lib/dev-tools). */}
      {DEV_TOOLS && <div className="mt-2">
        <p id="sim-label" className="field-label">
          {t("Monetization simulator")}
        </p>
        <div role="radiogroup" aria-labelledby="sim-label" className="mt-1 grid grid-cols-3 gap-1 rounded-ctl border border-line bg-bg p-0.5">
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
                className={`min-h-11 rounded-[calc(var(--radius-ctl)-4px)] px-1 text-xs font-semibold transition-colors ${
                  on ? "bg-accent text-on-accent" : "text-text-muted hover:text-text"
                }`}
              >
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </div>}
    </section>
  );
}

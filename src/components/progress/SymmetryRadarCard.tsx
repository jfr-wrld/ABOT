"use client";

import { useId, useMemo, useState } from "react";
import type { Exercise, WorkoutSession } from "@/types/workout";
import { RangeTabs } from "./RangeTabs";
import { AXES, AXIS_LABEL, IDEAL_SHARE, MIN_SETS, analyzeSymmetry, type Axis } from "@/lib/symmetry-analyzer";
import { useT } from "@/i18n";
import { useEntitlements } from "@/store/useEntitlements";
import { ProBadge, ProLock } from "@/components/paywall/ProBadge";

const DAY = 86_400_000;
const R = 100;
/** A balanced share sits at two thirds of the radius; 1.5x the ideal reaches the rim. */
const CAP = 1.5;

const point = (i: number, r: number) => {
  const a = ((i * 60 - 90) * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
};
const poly = (rs: number[]) => rs.map((r, i) => point(i, r).map((v) => v.toFixed(1)).join(",")).join(" ");

const GRADE_TEXT = { OPTIMAL: "Optimal", BALANCED: "Balanced", IMBALANCED: "Imbalanced", CRITICAL: "Critical" } as const;
const GRADE_COLOR = { OPTIMAL: "var(--color-accent)", BALANCED: "var(--color-dropset)", IMBALANCED: "#e0a100", CRITICAL: "#c8102e" } as const;

/**
 * Muscle balance on six axes as a cockpit radar: steel web, the balanced shape dashed, the
 * lifter's shape in Volt. Under it a terminal readout with the score and what to add this
 * week (lib/symmetry-analyzer).
 */
export function SymmetryRadarCard({ sessions, byId, now }: { sessions: WorkoutSession[]; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const uid = useId().replace(/:/g, "");
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const { canAccessPro } = useEntitlements();
  const unlocked = canAccessPro("symmetry_radar_telemetry");
  const r = useMemo(() => analyzeSymmetry(sessions, byId, now - days * DAY, now + 1), [sessions, byId, now, days]);
  const radius = (a: Axis) => (Math.min(r.axes[a].ratio, CAP) / CAP) * R;
  const ideal = R / CAP;
  const label = (a: Axis) => t(AXIS_LABEL[a]);
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const enough = r.score !== null;

  return (
    <section aria-labelledby={`${uid}-h`} className="force-dark flex flex-col gap-3 rounded-card border border-line-strong bg-bg p-4 text-text">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id={`${uid}-h`} className="text-sm font-semibold">
          {t("Muscle balance")}
        </h2>
        <ProBadge />
      </div>
      <RangeTabs
        id="symmetry-range"
        label={t("Balance range")}
        options={[
          { value: 7 as const, label: t("7 days") },
          { value: 30 as const, label: t("30 days") },
          { value: 90 as const, label: t("90 days") },
        ]}
        value={days}
        onChange={setDays}
      />

      <svg viewBox="-165 -138 330 290" className="mx-auto block h-auto w-full max-w-[340px]" role="img" aria-labelledby={`${uid}-t`}>
        <title id={`${uid}-t`}>
          {enough
            ? t("Balance radar. {list}.", { list: AXES.map((a) => `${label(a)} ${fmt(r.axes[a].sets)}`).join(", ") })
            : t("Balance radar, not enough sets yet")}
        </title>
        <defs>
          <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Steel web: four rings and six spokes. */}
        <g fill="none" stroke="var(--color-line-strong)" strokeWidth={1}>
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <polygon key={k} points={poly(AXES.map(() => R * k))} />
          ))}
          {AXES.map((_, i) => {
            const [x, y] = point(i, R);
            return <line key={i} x1={0} y1={0} x2={x} y2={y} />;
          })}
        </g>
        <polygon points={poly(AXES.map(() => ideal))} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.25} strokeDasharray="4 4" />
        {enough && (
          <>
            <polygon points={poly(AXES.map(radius))} fill="color-mix(in oklab, var(--color-accent) 18%, transparent)" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
            <g filter={`url(#${uid}-glow)`}>
              {AXES.map((a, i) => {
                const [x, y] = point(i, radius(a));
                return <circle key={a} cx={x} cy={y} r={3.5} fill="var(--color-accent)" />;
              })}
            </g>
          </>
        )}
        {AXES.map((a, i) => {
          const [x, y] = point(i, R + 16);
          const anchor = Math.abs(x) < 4 ? "middle" : x > 0 ? "start" : "end";
          // "Quads / Anterior" on two lines, so it fits beside the web.
          const [first, second] = label(a).split(" / ");
          return (
            <text key={a} x={x} y={second ? y - 6 : y} textAnchor={anchor} dominantBaseline="middle" className="fill-text text-[11px] font-semibold">
              {first}
              {second && (
                <tspan x={x} dy="11">
                  {second}
                </tspan>
              )}
              <tspan x={x} dy="12" className="fill-text-muted tabular-nums">
                {fmt(r.axes[a].sets)}
              </tspan>
            </text>
          );
        })}
      </svg>

      {!unlocked && enough ? (
        <ProLock feature="symmetry_radar_telemetry" text={t("The score, the ratio checks and what to add this week come with ABOT Pro.")} />
      ) : (
      <div role="status" className="rounded-ctl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed tabular-nums">
        {enough ? (
          <>
            <p>
              <span className="text-text-muted">{t("Balance score")}:</span>{" "}
              <span className="font-bold text-text">{r.score}/100</span>{" "}
              <span className="font-bold" style={{ color: GRADE_COLOR[r.grade!] }}>
                · {t(GRADE_TEXT[r.grade!])}
              </span>
            </p>
            {r.diagnostics.length === 0 ? (
              <p className="mt-1 text-text">
                <span className="text-text-muted">{t("What to do")}:</span> {t("Balanced. Keep the split as it is.")}
              </p>
            ) : (
              r.diagnostics.map((d) => (
                <p key={d.code} className="mt-1 text-text">
                  <span className="text-pr">{t("What to do")}:</span> {t(d.key, d.params)}
                </p>
              ))
            )}
            <p className="mt-1.5 text-xs tabular-nums text-text-muted">
              {t("Push : Pull")} {r.pushPull === null ? "-" : `1 : ${(1 / r.pushPull).toFixed(2)}`} · {t("Quad : Ham")}{" "}
              {r.quadHam === null ? "-" : `1 : ${r.quadHam.toFixed(2)}`} · {t("Legs")} {r.lowerShare === null ? "-" : `${Math.round(r.lowerShare * 100)}%`}
            </p>
          </>
        ) : (
          <p className="text-text">{t("Log at least {n} working sets in this range to read your balance.", { n: MIN_SETS })}</p>
        )}
      </div>
      )}
      <p className="text-[11px] text-text-muted">
        {t("Dashed: a balanced week ({push}% push, {pull}% pull, a third legs). Main muscles count a set, helpers half.", {
          push: Math.round(IDEAL_SHARE.push * 100),
          pull: Math.round(IDEAL_SHARE.pull * 100),
        })}
      </p>
    </section>
  );
}

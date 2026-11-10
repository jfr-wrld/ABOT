"use client";

import { motion } from "framer-motion";
import type { WeightUnit } from "@/types/workout";
import type { WeekBucket } from "@/lib/analytics";
import { formatDuration } from "@/lib/calc";
import { toDisplay } from "@/lib/units";
import type { PeriodTotals } from "@/lib/progress";
import { CountUp } from "./CountUp";
import { useT } from "@/i18n";

const PLATE = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/**
 * The focal point of Progress: total volume for the range, how it compares with the range
 * before, and one bar per week that rises from the floor when the range changes.
 */
export function ProgressHero({
  weeks,
  totals,
  change,
  buckets,
  unit,
}: {
  weeks: number;
  totals: PeriodTotals;
  change: { volume: number | null; workouts: number | null; time: number | null; sets: number | null };
  buckets: WeekBucket[];
  unit: WeightUnit;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.volumeKg));
  const volume = toDisplay(totals.volumeKg, unit);
  const t = useT();
  return (
    <section aria-labelledby="hero-title" className="panel overflow-hidden p-4">
      <h2 id="hero-title" className="label-caps">
        {t("Volume, last {n} weeks", { n: weeks })}
      </h2>
      <p className="mt-1 flex items-baseline gap-2">
        <CountUp
          value={volume}
          format={(n) => Math.round(n).toLocaleString(t.locale)}
          className="num text-5xl font-extrabold leading-none tracking-tight"
        />
        <span className="num text-base font-bold text-text-muted">{unit}</span>
      </p>
      <Delta value={change.volume} weeks={weeks} />

      {/* One bar per week; this week in Volt so the eye lands on now. */}
      <div aria-hidden="true" className="mt-4 flex h-16 items-end gap-1">
        {buckets.map((b, i) => {
          const current = i === buckets.length - 1;
          return (
            <motion.span
              key={b.weekStart}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: b.volumeKg > 0 ? Math.max(0.06, b.volumeKg / max) : 0.04 }}
              transition={{ type: "spring", stiffness: 260, damping: 28, delay: i * 0.025 }}
              style={{ originY: 1 }}
              className={`h-full flex-1 rounded-t-[3px] ${current ? "bg-accent" : b.volumeKg > 0 ? "bg-accent-dim" : "bg-surface-2"}`}
            />
          );
        })}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-3">
        <Tile label={t("Workouts")} value={totals.workouts} format={(n) => String(Math.round(n))} change={change.workouts} />
        <Tile label={t("Time")} value={totals.durationSec} format={(n) => formatDuration(Math.round(n))} change={change.time} />
        <Tile label={t("Sets")} value={totals.sets} format={(n) => String(Math.round(n))} change={change.sets} />
      </dl>
    </section>
  );
}

function Delta({ value, weeks }: { value: number | null; weeks: number }) {
  const t = useT();
  if (value === null)
    return <p className="mt-2 text-sm text-text-muted">{t("Nothing logged in the {n} weeks before, so no comparison yet.", { n: weeks })}</p>;
  const up = value > 0;
  return (
    <p className="mt-2 text-sm">
      <span className={`num font-bold ${up ? "text-accent" : "text-text"}`}>
        {up ? "+" : value < 0 ? "-" : "±"}
        {Math.abs(value)}%
      </span>{" "}
      <span className="text-text-muted">{t("vs the {n} weeks before", { n: weeks })}</span>
    </p>
  );
}

function Tile({ label, value, format, change }: { label: string; value: number; format: (n: number) => string; change: number | null }) {
  return (
    <div>
      <dt className="label-caps">{label}</dt>
      <dd className="mt-0.5">
        <CountUp value={value} format={format} className="num block text-lg font-bold" />
        {change !== null && (
          <span className={`num text-xs ${change > 0 ? "text-accent" : "text-text-muted"}`}>
            {change > 0 ? "+" : change < 0 ? "-" : "±"}
            {Math.abs(change)}%
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * One hexagon plate per week in the range: filled when you trained that week, dashed for a rest
 * week the streak used (lib/analytics streakWeeks).
 */
export function StreakPlates({
  buckets,
  streak,
  restWeeks = new Set<number>(),
  restReady = false,
}: {
  buckets: WeekBucket[];
  streak: number;
  restWeeks?: Set<number>;
  restReady?: boolean;
}) {
  const trained = buckets.filter((b) => b.workouts > 0).length;
  const t = useT();
  return (
    <section aria-labelledby="streak-title" className="panel flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <h2 id="streak-title" className="text-sm font-semibold">
          {streak > 0 ? t("{n}-week streak", { n: streak }) : t("No active streak")}
        </h2>
        <p className="text-xs text-text-muted">
          {t("Trained in {n} of {total} weeks", { n: trained, total: buckets.length })}
        </p>
        {streak > 0 && (
          <p className="text-xs text-text-muted">
            {restReady
              ? t("Rest week ready: one week off keeps the streak.")
              : t("Every 4 weeks trained earns a rest week.")}
          </p>
        )}
      </div>
      {/* Up to 8 plates sit on one row; 12 weeks split into two even rows of 6. */}
      <ol
        aria-hidden="true"
        className="grid shrink-0 gap-1"
        style={{ gridTemplateColumns: `repeat(${buckets.length > 8 ? Math.ceil(buckets.length / 2) : buckets.length}, 18px)` }}
      >
        {buckets.map((b, i) => (
          <motion.li
            key={b.weekStart}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03, type: "spring", stiffness: 400, damping: 24 }}
          >
            <svg viewBox="0 0 100 100" width={18} height={18}>
              <path
                d={PLATE}
                fill={b.workouts > 0 ? "var(--color-accent)" : "none"}
                stroke={b.workouts > 0 || restWeeks.has(b.weekStart) ? "var(--color-accent)" : "var(--color-line-strong)"}
                strokeWidth={8}
                strokeDasharray={b.workouts === 0 && restWeeks.has(b.weekStart) ? "14 10" : undefined}
              />
            </svg>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

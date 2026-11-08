"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { WeightUnit } from "@/types/workout";
import type { LiftTrend } from "@/lib/progress";
import { formatWeight } from "@/lib/units";
import { exercisePath } from "@/lib/routes";
import { useT } from "@/i18n";

/**
 * The lifts trained most in the range, each with its estimated 1RM line. The line draws itself
 * left to right once, which is the direction time runs on it.
 */
export function LiftTrends({ trends, unit }: { trends: LiftTrend[]; unit: WeightUnit }) {
  const t = useT();
  return (
    <section aria-labelledby="lifts-title" className="panel p-4">
      <h2 id="lifts-title" className="text-sm font-semibold">
        {t("Main lifts")}
      </h2>
      <p className="text-xs text-text-muted">{t("Estimated 1RM per workout in this range.")}</p>
      {trends.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">
          {t("Log a set with weight and reps and its strength line starts here.")}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col">
          {trends.map((trend) => {
            const first = trend.points[0].e1rmKg;
            const last = trend.points[trend.points.length - 1].e1rmKg;
            const delta = last - first;
            return (
              <li key={trend.exerciseId} className="border-t border-line first:border-t-0">
                <Link
                  href={exercisePath(trend.exerciseId)}
                  className="-mx-2 grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-3 rounded-ctl px-2 py-3 hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{trend.name}</span>
                    <span className="flex items-center gap-2 text-xs text-text-muted">
                      {t.n(trend.points.length, "{n} workout", "{n} workouts")}
                      {trend.records > 0 && (
                        <span className="flex items-center gap-1 text-pr">
                          <Trophy aria-hidden="true" size={12} />
                          {t.n(trend.records, "{n} record", "{n} records")}
                        </span>
                      )}
                    </span>
                  </span>
                  <Sparkline values={trend.points.map((p) => p.e1rmKg)} />
                  <span className="text-right">
                    <span className="num block text-sm font-bold">{formatWeight(last, unit)}</span>
                    {trend.points.length > 1 && (
                      <span className={`num block text-xs ${delta > 0 ? "text-accent" : "text-text-muted"}`}>
                        {delta > 0 ? "+" : delta < 0 ? "-" : "±"}
                        {formatWeight(Math.abs(delta), unit)}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 96;
  const h = 32;
  if (values.length < 2)
    return (
      <svg aria-hidden="true" width={w} height={h}>
        <circle cx={w - 4} cy={h / 2} r={3.5} fill="var(--color-accent)" />
      </svg>
    );
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const pts = values.map((v, i) => [4 + (i * (w - 8)) / (values.length - 1), h - 4 - ((v - lo) / span) * (h - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg aria-hidden="true" width={w} height={h} className="overflow-visible">
      <motion.path
        d={d}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--color-accent)" />
    </svg>
  );
}

"use client";

import { useId } from "react";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { AXES, AXIS_LABEL, type Axis } from "@/lib/symmetry-analyzer";
import type { MuscleWork } from "@/lib/session-insights";
import { muscleText } from "@/lib/home";
import { point, poly } from "@/components/progress/radar-geometry";
import { useT } from "@/i18n";

const R = 100;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * This workout's sets on the six balance axes, scaled to the most worked one: a single workout
 * is not a balanced week, so the shape answers "what got hit most", not "is it balanced".
 */
export function MuscleRadar({ work }: { work: MuscleWork }) {
  const t = useT();
  const uid = useId().replace(/:/g, "");
  const top = Math.max(0, ...AXES.map((a) => work.axes[a]));
  const radius = (a: Axis) => (top > 0 ? (work.axes[a] / top) * R : 0);
  const label = (a: Axis) => t(AXIS_LABEL[a]);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="-165 -138 330 290" className="block h-auto w-full max-w-[320px]" role="img" aria-labelledby={`${uid}-t`}>
        <title id={`${uid}-t`}>{t("Muscle radar. {list}.", { list: AXES.map((a) => `${label(a)} ${fmt(work.axes[a])}`).join(", ") })}</title>
        <g fill="none" stroke="var(--color-line-strong)" strokeWidth={1}>
          {[0.25, 0.5, 0.75, 1].map((k) => (
            <polygon key={k} points={poly(AXES.map(() => R * k))} />
          ))}
          {AXES.map((_, i) => {
            const [x, y] = point(i, R);
            return <line key={i} x1={0} y1={0} x2={x} y2={y} />;
          })}
        </g>
        <polygon
          points={poly(AXES.map(radius))}
          fill="color-mix(in oklab, var(--color-accent) 22%, transparent)"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {AXES.map((a, i) => {
          const [x, y] = point(i, radius(a));
          return <circle key={a} cx={x} cy={y} r={a === work.dominant ? 5 : 3.5} fill="var(--color-accent)" />;
        })}
        {AXES.map((a, i) => {
          const [x, y] = point(i, R + 16);
          const anchor = Math.abs(x) < 4 ? "middle" : x > 0 ? "start" : "end";
          const [first, second] = label(a).split(" / ");
          const lead = a === work.dominant;
          return (
            <text key={a} x={x} y={second ? y - 6 : y} textAnchor={anchor} dominantBaseline="middle" className={`text-[11px] font-semibold ${lead ? "fill-accent-text" : "fill-text"}`}>
              {first}
              {second && (
                <tspan x={x} dy="11">
                  {second}
                </tspan>
              )}
              <tspan x={x} dy="12" className="fill-text-muted tabular-nums">
                {fmt(work.axes[a])}
              </tspan>
            </text>
          );
        })}
      </svg>
      {work.dominant && (
        <p className="text-sm text-text-muted">
          {t("Most worked")}: <span className="font-bold text-text">{label(work.dominant).split(" / ")[0]}</span>{" "}
          <span className="num">· {t("{n} sets", { n: fmt(work.axes[work.dominant]) })}</span>
        </p>
      )}
    </div>
  );
}

/** One bar per muscle, most worked first: main muscles in the accent, helpers muted. */
export function MuscleBars({ work }: { work: MuscleWork }) {
  const t = useT();
  const top = work.muscles[0]?.sets ?? 0;
  return (
    <ul className="flex flex-col gap-2" aria-label={t("Sets per muscle")}>
      {work.muscles.map(({ muscle, sets, primary }) => (
        <li key={muscle} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className={`truncate ${primary ? "font-semibold text-text" : "text-text-muted"}`}>{muscleText(MUSCLE_GROUP_LABELS[muscle], t)}</span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-track">
            <span
              className={`block h-full origin-left rounded-full motion-safe:animate-[bar-grow_400ms_cubic-bezier(0.2,0.7,0.2,1)] ${primary ? "bg-accent" : "bg-text-muted/50"}`}
              style={{ width: `${top > 0 ? Math.max(4, (sets / top) * 100) : 0}%` }}
            />
          </span>
          <span className="num text-right font-semibold tabular-nums">{fmt(sets)}</span>
        </li>
      ))}
    </ul>
  );
}

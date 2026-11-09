"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import type { Exercise, WeightUnit, WorkoutSession } from "@/types/workout";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { Sparkline } from "@/components/phase/visuals";
import { Rise } from "@/components/motion/Entrance";
import { liftBoard, type LiftRow } from "@/lib/profile";
import { BUCKET_LABEL, exerciseBucket, type Bucket } from "@/lib/training-focus";
import { relativeDay } from "@/lib/home";
import { formatWeight } from "@/lib/units";
import { exercisePath } from "@/lib/routes";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

const BUCKETS: Bucket[] = ["push", "pull", "legs", "core"];

/**
 * Every weighted lift, strongest first. The top three stand on a podium (photo, best e1RM,
 * times body weight); the rest are rows with the best set, when it was last done, its last
 * workouts as a line and the change over four weeks. A filter narrows to push, pull, legs or
 * core. Tapping a lift opens its page.
 */
export function LiftsBoard({
  sessions,
  byId,
  unit,
  bodyweightKg,
  now,
}: {
  sessions: WorkoutSession[];
  byId: Record<string, Exercise>;
  unit: WeightUnit;
  bodyweightKg: number | null;
  now: number;
}) {
  const t = useT();
  const rows = useMemo(() => liftBoard(sessions, byId), [sessions, byId]);
  const [bucket, setBucket] = useState<Bucket | "all">("all");
  const present = BUCKETS.filter((b) => rows.some((r) => exerciseBucket(r.exercise) === b));
  const shown = bucket === "all" ? rows : rows.filter((r) => exerciseBucket(r.exercise) === bucket);

  if (rows.length === 0) {
    return <p className="panel px-4 py-6 text-center text-sm text-text-muted">{t("Finish a workout to rank your lifts.")}</p>;
  }

  const podium = shown.slice(0, 3);
  const rest = shown.slice(3);
  return (
    <section aria-labelledby="lifts-heading" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="lifts-heading" className="label-caps flex items-center gap-1.5">
          <Trophy aria-hidden="true" size={12} className="text-pr" />
          {t("Top lifts")}
        </h2>
        <span className="text-[11px] text-text-muted">{t("Best estimated 1RM")}</span>
      </div>

      {present.length > 1 && (
        <div role="group" aria-label={t("Filter lifts")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5">
          {(["all", ...present] as const).map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={bucket === b}
              onClick={() => {
                if (bucket !== b) feedback.tick();
                setBucket(b);
              }}
              className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold ${
                bucket === b ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
              }`}
            >
              {b === "all" ? t("All") : t(BUCKET_LABEL[b])}
            </button>
          ))}
        </div>
      )}

      <ol className="grid grid-cols-3 gap-2">
        {podium.map((r, i) => (
          <li key={r.exercise.id}>
            <Rise order={i}>
              <Link
                href={exercisePath(r.exercise.id)}
                className={`flex h-full flex-col gap-1.5 rounded-card border bg-surface p-2.5 hover:border-line-hover ${i === 0 ? "border-pr/50" : "border-line"}`}
              >
                <span className="flex items-start justify-between">
                  <ExerciseThumb exercise={r.exercise} size={40} />
                  <span className={`num text-xs font-bold ${i === 0 ? "text-pr" : "text-text-muted"}`}>#{i + 1}</span>
                </span>
                <span className="line-clamp-2 min-h-8 text-xs font-semibold leading-4">{r.exercise.name}</span>
                <span className="num text-lg font-bold leading-none text-pr">{formatWeight(r.best.value, unit, false)}</span>
                <span className="num text-[11px] text-text-muted">
                  {formatWeight(r.best.weightKg, unit)} × {r.best.reps}
                </span>
                {bodyweightKg ? (
                  <span className="num text-[11px] font-semibold text-text-muted">{t("{x}× body weight", { x: (r.best.value / bodyweightKg).toFixed(2) })}</span>
                ) : null}
              </Link>
            </Rise>
          </li>
        ))}
      </ol>

      {rest.length > 0 && (
        <ol className="panel flex flex-col p-1.5" start={4}>
          {rest.map((r, i) => (
            <LiftLine key={r.exercise.id} row={r} rank={i + 4} unit={unit} now={now} />
          ))}
        </ol>
      )}
    </section>
  );
}

function LiftLine({ row: r, rank, unit, now }: { row: LiftRow; rank: number; unit: WeightUnit; now: number }) {
  const t = useT();
  return (
    <li>
      <Link href={exercisePath(r.exercise.id)} className="flex min-h-16 items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-ink/[0.04]">
        <span className="num w-5 shrink-0 text-center text-xs text-text-muted">{rank}</span>
        <ExerciseThumb exercise={r.exercise} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{r.exercise.name}</span>
          <span className="num block truncate text-[11px] text-text-muted">
            {formatWeight(r.best.weightKg, unit)} × {r.best.reps} · {relativeDay(r.lastDone, now, t)}
          </span>
        </span>
        {r.points.length > 1 && <Sparkline values={r.points.map((p) => p.e1rmKg)} width={52} height={24} />}
        <span className="w-16 shrink-0 text-right">
          <span className="num block text-sm font-bold">{formatWeight(r.best.value, unit)}</span>
          {r.changePct !== null && (
            <span className={`num block text-[11px] font-semibold ${r.changePct > 0 ? "text-accent" : "text-text-muted"}`}>
              {r.changePct > 0 ? "▲ +" : r.changePct < 0 ? "▼ " : "± "}
              {r.changePct.toFixed(1)}%
            </span>
          )}
        </span>
        <ChevronRight aria-hidden="true" size={14} className="shrink-0 text-text-muted" />
      </Link>
    </li>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { WeeklyBars } from "@/components/analytics/WeeklyBars";
import { WorkoutCalendar } from "@/components/analytics/WorkoutCalendar";
import { RangeTabs } from "@/components/progress/RangeTabs";
import { ProgressHero, StreakPlates } from "@/components/progress/ProgressHero";
import { MuscleFocus } from "@/components/progress/MuscleFocus";
import { LiftTrends } from "@/components/progress/LiftTrends";
import { StoryShareButton } from "@/components/share/ShareStoryButton";
import { startOfWeek, weekStreak, weeklyBuckets } from "@/lib/analytics";
import { formatDuration, muscleSplit } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import { liftTrends, percentChange, periodTotals, rangeStart } from "@/lib/progress";
import { buildPeriodStoryData } from "@/lib/story-data";
import { useNow } from "@/lib/useNow";

const RANGES = [
  { value: 4, label: "4 wk" },
  { value: 8, label: "8 wk" },
  { value: 12, label: "12 wk" },
];
type Metric = "volume" | "workouts" | "time";

/** Sections arrive in reading order, a beat apart, so the page settles top to bottom once. */
const section: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, type: "spring" as const, stiffness: 300, damping: 30 } }),
};

/** Profile > Progress (formerly the Progress tab): range, totals, streak, charts, lifts, muscles, calendar. */
export function ProgressPanel() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const [weeks, setWeeks] = useState(8);
  const [metric, setMetric] = useState<Metric>("volume");
  const [splitRange, setSplitRange] = useState<"week" | "range">("week");
  const now = useNow(60_000);

  const completed = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);
  const from = rangeStart(weeks, now, firstDayOfWeek);
  const prevFrom = rangeStart(weeks * 2, now, firstDayOfWeek);
  const to = now + 1;

  const buckets = useMemo(() => weeklyBuckets(sessions, weeks, now, firstDayOfWeek, byId), [sessions, weeks, now, firstDayOfWeek, byId]);
  const totals = useMemo(() => periodTotals(sessions, from, to, byId), [sessions, from, to, byId]);
  const previous = useMemo(() => periodTotals(sessions, prevFrom, from, byId), [sessions, prevFrom, from, byId]);
  const change = {
    volume: percentChange(totals.volumeKg, previous.volumeKg),
    workouts: percentChange(totals.workouts, previous.workouts),
    time: percentChange(totals.durationSec, previous.durationSec),
    sets: percentChange(totals.sets, previous.sets),
  };
  const streak = weekStreak(sessions, now, firstDayOfWeek);
  const trends = useMemo(() => liftTrends(sessions, from, to, byId), [sessions, from, to, byId]);

  const split = useMemo(() => {
    const start = splitRange === "week" ? startOfWeek(now, firstDayOfWeek) : from;
    return muscleSplit(completed.filter((s) => s.startedAt >= start), byId);
  }, [completed, splitRange, now, firstDayOfWeek, from, byId]);

  const weekLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const chart = {
    volume: {
      title: `Volume per week, last ${weeks} weeks (${weightUnit})`,
      unit: weightUnit,
      points: buckets.map((b) => ({ label: weekLabel(b.weekStart), value: Math.round(toDisplay(b.volumeKg, weightUnit)), display: formatVolume(b.volumeKg, weightUnit) })),
    },
    workouts: {
      title: `Workouts per week, last ${weeks} weeks`,
      unit: "workouts",
      points: buckets.map((b) => ({ label: weekLabel(b.weekStart), value: b.workouts, display: String(b.workouts) })),
    },
    time: {
      title: `Time training per week, last ${weeks} weeks (minutes)`,
      unit: "min",
      points: buckets.map((b) => ({ label: weekLabel(b.weekStart), value: Math.round(b.durationSec / 60), display: formatDuration(b.durationSec) })),
    },
  }[metric];

  const shareTitle = `Last ${weeks} weeks`;

  return (
    <div className="flex flex-col gap-3">
      {completed.length === 0 ? (
        <section className="panel flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-text-muted">
            Nothing to chart yet. Finish a workout and your volume, streak, muscles and main lifts show up here.
          </p>
          <Link
            href="/workout"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110"
          >
            Go to Workout
          </Link>
        </section>
      ) : null}

      <div className="flex flex-col gap-3">
        <motion.div custom={0} variants={section} initial="hidden" animate="show" className="flex items-center gap-2">
          <div className="flex-1">
            <RangeTabs id="range" label="Range" options={RANGES} value={weeks} onChange={setWeeks} />
          </div>
          {totals.workouts > 0 && (
            <StoryShareButton
              label="Share"
              className="shrink-0"
              makeData={() => buildPeriodStoryData(sessions, from, to, byId, weightUnit, shareTitle)}
            />
          )}
        </motion.div>

        <motion.div custom={1} variants={section} initial="hidden" animate="show">
          <ProgressHero weeks={weeks} totals={totals} change={change} buckets={buckets} unit={weightUnit} />
        </motion.div>

        <motion.div custom={2} variants={section} initial="hidden" animate="show">
          <StreakPlates buckets={buckets} streak={streak} />
        </motion.div>

        <motion.section custom={3} variants={section} initial="hidden" animate="show" className="panel flex flex-col gap-3 p-4" aria-label="Weekly chart">
          <RangeTabs
            id="metric"
            label="Chart"
            options={[
              { value: "volume" as Metric, label: "Volume" },
              { value: "workouts" as Metric, label: "Workouts" },
              { value: "time" as Metric, label: "Time" },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <WeeklyBars key={`${metric}-${weeks}`} title={chart.title} unitLabel={chart.unit} points={chart.points} />
        </motion.section>

        <motion.div custom={4} variants={section} initial="hidden" animate="show">
          <LiftTrends trends={trends} unit={weightUnit} />
        </motion.div>

        <motion.div custom={5} variants={section} initial="hidden" animate="show" className="flex flex-col gap-2">
          <RangeTabs
            id="split"
            label="Muscle split range"
            options={[
              { value: "week" as const, label: "This week" },
              { value: "range" as const, label: `Last ${weeks} weeks` },
            ]}
            value={splitRange}
            onChange={setSplitRange}
          />
          <MuscleFocus
            key={`${splitRange}-${weeks}`}
            title={splitRange === "week" ? "Sets per muscle, this week" : `Sets per muscle, last ${weeks} weeks`}
            split={split}
          />
        </motion.div>

        <motion.div custom={6} variants={section} initial="hidden" animate="show">
          <WorkoutCalendar sessions={sessions} firstDay={firstDayOfWeek} now={now} />
        </motion.div>
      </div>
    </div>
  );
}

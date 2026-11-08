"use client";

import { useMemo, useState } from "react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { WeeklyBars } from "@/components/analytics/WeeklyBars";
import { MuscleSplit } from "@/components/analytics/MuscleSplit";
import { WorkoutCalendar } from "@/components/analytics/WorkoutCalendar";
import { startOfWeek, weeklyBuckets } from "@/lib/analytics";
import { formatDuration, muscleSplit } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import { useNow } from "@/lib/useNow";

const WEEKS = 8;

/** Profile > Progress: weekly charts, muscle split and the calendar (formerly the Progress tab). */
export function ProgressPanel() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const [splitRange, setSplitRange] = useState<"week" | "month">("week");
  const now = useNow(60_000);

  const buckets = useMemo(() => weeklyBuckets(sessions, WEEKS, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const completed = useMemo(() => sessions.filter((s) => s.status === "completed"), [sessions]);

  const splitSessions = useMemo(() => {
    const from = splitRange === "week" ? startOfWeek(now, firstDayOfWeek) : now - 28 * 86_400_000;
    return completed.filter((s) => s.startedAt >= from);
  }, [completed, splitRange, firstDayOfWeek, now]);
  const split = useMemo(() => muscleSplit(splitSessions, byId), [splitSessions, byId]);

  const weekLabel = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="flex flex-col gap-3">
        <WeeklyBars
          title={`Volume per week, last ${WEEKS} weeks (${weightUnit})`}
          unitLabel={weightUnit}
          points={buckets.map((b) => ({
            label: weekLabel(b.weekStart),
            value: Math.round(toDisplay(b.volumeKg, weightUnit)),
            display: formatVolume(b.volumeKg, weightUnit),
          }))}
        />
        <WeeklyBars
          title={`Workouts per week, last ${WEEKS} weeks`}
          unitLabel="workouts"
          points={buckets.map((b) => ({ label: weekLabel(b.weekStart), value: b.workouts, display: String(b.workouts) }))}
        />
        <WeeklyBars
          title={`Time training per week, last ${WEEKS} weeks (minutes)`}
          unitLabel="min"
          points={buckets.map((b) => ({
            label: weekLabel(b.weekStart),
            value: Math.round(b.durationSec / 60),
            display: formatDuration(b.durationSec),
          }))}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-1" role="group" aria-label="Muscle split range">
            {(["week", "month"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={splitRange === r}
                onClick={() => setSplitRange(r)}
                className={`h-9 rounded-ctl border px-3 text-xs font-semibold ${
                  splitRange === r
                    ? "border-accent bg-accent-tint text-text"
                    : "border-white/[0.12] bg-surface text-text-muted hover:border-white/25 hover:text-text"
                }`}
              >
                {r === "week" ? "This week" : "Last 4 weeks"}
              </button>
            ))}
          </div>
          <MuscleSplit
            title={splitRange === "week" ? "Sets per muscle, this week" : "Sets per muscle, last 4 weeks"}
            split={split}
          />
        </div>

        <WorkoutCalendar sessions={sessions} firstDay={firstDayOfWeek} now={now} />
    </div>
  );
}

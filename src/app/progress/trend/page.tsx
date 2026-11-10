"use client";

import { useState } from "react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangeTabs } from "@/components/progress/RangeTabs";
import { StreakPlates } from "@/components/progress/ProgressHero";
import { WeeklyBars } from "@/components/analytics/WeeklyBars";
import { useProgressData } from "@/components/progress/useProgressData";
import { RANGES, useProgressRange } from "@/store/useProgressRange";
import { formatDuration } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import { useT } from "@/i18n";

type Metric = "volume" | "workouts" | "time";

export default function TrendPage() {
  return (
    <HydrationGate>
      <Trend />
    </HydrationGate>
  );
}

/** Progress > Weekly trend: the week-by-week chart for volume, workouts or time, and the streak. */
function Trend() {
  const t = useT();
  const d = useProgressData();
  const setWeeks = useProgressRange((s) => s.setWeeks);
  const [metric, setMetric] = useState<Metric>("volume");
  const weekLabel = (time: number) => new Date(time).toLocaleDateString(t.locale, { day: "numeric", month: "short" });
  const chart = {
    volume: {
      title: t("Volume per week, last {n} weeks ({unit})", { n: d.weeks, unit: d.unit }),
      unit: d.unit,
      points: d.buckets.map((b) => ({ label: weekLabel(b.weekStart), value: Math.round(toDisplay(b.volumeKg, d.unit)), display: formatVolume(b.volumeKg, d.unit) })),
    },
    workouts: {
      title: t("Workouts per week, last {n} weeks", { n: d.weeks }),
      unit: t("workouts"),
      points: d.buckets.map((b) => ({ label: weekLabel(b.weekStart), value: b.workouts, display: String(b.workouts) })),
    },
    time: {
      title: t("Time training per week, last {n} weeks (minutes)", { n: d.weeks }),
      unit: t("min"),
      points: d.buckets.map((b) => ({ label: weekLabel(b.weekStart), value: Math.round(b.durationSec / 60), display: formatDuration(b.durationSec) })),
    },
  }[metric];

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("Weekly trend")} back={{ href: "/profile", label: t("Profile") }} />
      <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
        <RangeTabs id="range" label={t("Range")} options={RANGES.map((n) => ({ value: n, label: t("{n} wk", { n }) }))} value={d.weeks} onChange={setWeeks} />
        <section className="panel flex flex-col gap-3 p-4" aria-label={t("Weekly chart")}>
          <RangeTabs
            id="metric"
            label={t("Chart")}
            options={[
              { value: "volume" as Metric, label: t("Volume") },
              { value: "workouts" as Metric, label: t("Workouts") },
              { value: "time" as Metric, label: t("Time") },
            ]}
            value={metric}
            onChange={setMetric}
          />
          <WeeklyBars key={`${metric}-${d.weeks}`} title={chart.title} unitLabel={chart.unit} points={chart.points} />
        </section>
        <StreakPlates buckets={d.buckets} streak={d.streak} />
      </div>
    </main>
  );
}

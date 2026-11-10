"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion, type Variants } from "framer-motion";
import { CalendarDays, ChevronRight, Flame, Hammer } from "lucide-react";
import { PHASE_ICON } from "@/components/phase/PhaseCommandCard";
import { usePhaseTelemetry } from "@/components/phase/usePhaseTelemetry";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PHASE_LABEL } from "@/lib/phase-engine";
import { toDisplay } from "@/lib/units";
import type { MuscleGroup } from "@/types/workout";
import { RangeTabs } from "@/components/progress/RangeTabs";
import { ProgressHero } from "@/components/progress/ProgressHero";
import { useProgressData } from "@/components/progress/useProgressData";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { muscleLabel } from "@/components/exercise/MuscleTags";
import { StoryShareButton } from "@/components/share/ShareStoryButton";
import { RANGES, useProgressRange } from "@/store/useProgressRange";
import { startOfDay, startOfWeek } from "@/lib/analytics";
import { muscleSplit } from "@/lib/calc";
import { relativeDay } from "@/lib/home";
import { buildPeriodStoryData } from "@/lib/story-data";
import { useT } from "@/i18n";

/** Sections arrive in reading order, a beat apart, so the page settles top to bottom once. */
const section: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, type: "spring" as const, stiffness: 300, damping: 30 } }),
};

const PLATE = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/**
 * Profile > Progress, as a summary: the range, the volume hero (the one focal point) with
 * workouts, time and sets, then three tiles that each open their detail page: weekly trend,
 * muscles, calendar. Charts and long lists live on those pages, not here.
 */
export function ProgressPanel() {
  const d = useProgressData();
  const setWeeks = useProgressRange((s) => s.setWeeks);
  const t = useT();

  // This week's sets per muscle, for the muscles tile.
  const weekSplit = muscleSplit(
    d.completed.filter((s) => s.startedAt >= startOfWeek(d.now, d.firstDay)),
    d.byId,
  );
  const top = (Object.entries(weekSplit) as [MuscleGroup, number][]).sort((a, b) => b[1] - a[1])[0];
  const musclesHit = Object.values(weekSplit).filter((n) => (n ?? 0) > 0).length;

  // Days trained in the current month, and the last workout, for the calendar tile.
  const monthStart = new Date(new Date(d.now).getFullYear(), new Date(d.now).getMonth(), 1).getTime();
  const daysThisMonth = new Set(d.completed.filter((s) => s.startedAt >= monthStart).map((s) => startOfDay(s.startedAt))).size;
  const last = d.completed.reduce<number | null>((m, s) => (m === null || s.startedAt > m ? s.startedAt : m), null);
  const trainedWeeks = d.buckets.filter((b) => b.workouts > 0).length;

  // Drawn on the story card, which stays English by design.
  const shareTitle = `Last ${d.weeks} weeks`;

  return (
    <div className="flex flex-col gap-3">
      {d.completed.length === 0 ? (
        <section className="panel flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-text-muted">
            {t("Nothing to chart yet. Finish a workout and your volume, streak, muscles and main lifts show up here.")}
          </p>
          <Link
            href="/workout"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-110"
          >
            {t("Go to Workout")}
          </Link>
        </section>
      ) : null}

      <motion.div custom={0} variants={section} initial="hidden" animate="show" className="flex items-center gap-2">
        <div className="flex-1">
          <RangeTabs id="range" label={t("Range")} options={RANGES.map((n) => ({ value: n, label: t("{n} wk", { n }) }))} value={d.weeks} onChange={setWeeks} />
        </div>
        {d.totals.workouts > 0 && (
          <StoryShareButton
            label={t("Share")}
            className="shrink-0"
            makeData={() => buildPeriodStoryData(d.sessions, d.from, d.to, d.byId, d.unit, shareTitle)}
          />
        )}
      </motion.div>

      <motion.div custom={1} variants={section} initial="hidden" animate="show">
        <ProgressHero weeks={d.weeks} totals={d.totals} change={d.change} buckets={d.buckets} unit={d.unit} />
      </motion.div>

      <motion.nav custom={2} variants={section} initial="hidden" animate="show" aria-label={t("Progress details")} className="flex flex-col gap-2">
        <SummaryTile
          href="/progress/trend"
          title={t("Weekly trend")}
          icon={<Flame aria-hidden="true" size={20} className={d.streak > 0 ? "text-accent" : "text-text-muted"} />}
          headline={d.streak > 0 ? t("{n}-week streak", { n: d.streak }) : t("No active streak")}
          line={t("{n} of {total} weeks trained", { n: trainedWeeks, total: d.buckets.length })}
          aside={
            <span aria-hidden="true" className="flex gap-0.5">
              {d.buckets.slice(-6).map((b) => (
                <svg key={b.weekStart} viewBox="0 0 100 100" width={12} height={12}>
                  <path
                    d={PLATE}
                    fill={b.workouts > 0 ? "var(--color-accent)" : "none"}
                    stroke={b.workouts > 0 ? "var(--color-accent)" : "var(--color-line-strong)"}
                    strokeWidth={10}
                  />
                </svg>
              ))}
            </span>
          }
        />
        <SummaryTile
          href="/progress/muscles"
          title={t("Muscles")}
          icon={top ? <MuscleIcon muscle={top[0]} size={26} /> : <MuscleIcon size={26} />}
          headline={top ? t("{muscle}: {n} sets", { muscle: muscleLabel(top[0], t), n: Math.round(top[1]) }) : t("No sets this week yet")}
          line={t.n(musclesHit, "{n} muscle trained this week", "{n} muscles trained this week")}
        />
        <SummaryTile
          href="/progress/calendar"
          title={t("Calendar")}
          icon={<CalendarDays aria-hidden="true" size={20} className="text-accent" />}
          headline={t.n(daysThisMonth, "{n} day trained this month", "{n} days trained this month")}
          line={last !== null ? t("Last workout: {when}", { when: relativeDay(last, d.now, t) }) : t("No workouts yet")}
        />
        <PhaseTile now={d.now} />
      </motion.nav>
    </div>
  );
}

/** One summary row: icon, what it is, the headline figure, one supporting line, and where it goes. */
function SummaryTile({ href, title, icon, headline, line, aside }: { href: string; title: string; icon: ReactNode; headline: string; line: string; aside?: ReactNode }) {
  return (
    <Link href={href} className="tap panel flex min-h-[72px] items-center gap-3 px-3 py-3 hover:border-line-hover active:bg-surface-2">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="label-caps block">{title}</span>
        <span className="mt-0.5 block truncate text-sm font-bold">{headline}</span>
        <span className="block truncate text-xs text-text-muted">{line}</span>
      </span>
      {aside}
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
    </Link>
  );
}

/**
 * The body phase (cut, bulk, recomp, peak) as the fourth tile: phase and block week with the
 * trend weight when one runs, or a way in to choose one when none does.
 */
function PhaseTile({ now }: { now: number }) {
  const t = useT();
  const m = usePhaseTelemetry(now);
  const unit = useSettingsStore((s) => s.weightUnit);
  if (!m) {
    return (
      <SummaryTile
        href="/phase/setup"
        title={t("Body phase")}
        icon={<Hammer aria-hidden="true" size={20} className="text-text-muted" />}
        headline={t("Cut, bulk, recomp or peak")}
        line={t("Choose a program")}
      />
    );
  }
  const Icon = PHASE_ICON[m.phase.phaseType];
  const { meso } = m;
  const stage = meso.finished ? t("Done") : `${t("W{week}/{of}", { week: meso.week, of: meso.of })}${meso.deload ? ` · ${t("Deload")}` : ""}`;
  const weight = `${(Math.round(toDisplay(m.trendKg, unit) * 10) / 10).toFixed(1)} ${unit}`;
  const rate = m.ratePerWeek;
  const pace = rate === null ? "" : ` · ${rate > 0 ? "+" : rate < 0 ? "-" : "±"}${Math.abs(Math.round(toDisplay(rate, unit) * 10) / 10)} ${unit}/${t("wk")}`;
  return (
    <SummaryTile
      href="/phase"
      title={t("Body phase")}
      icon={<Icon aria-hidden="true" size={20} className="text-accent" />}
      headline={`${t(PHASE_LABEL[m.phase.phaseType])} · ${stage}`}
      line={t("Trend {weight}", { weight }) + pace}
    />
  );
}

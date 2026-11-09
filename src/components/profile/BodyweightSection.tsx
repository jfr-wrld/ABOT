"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Scale, Trash2 } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useBodyStore } from "@/store/useBodyStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { NumberField } from "@/components/ui/NumberField";
import { Button } from "@/components/ui/Button";
import { CHART, numTick, tooltipStyle } from "@/components/analytics/chartTheme";
import { changeOver, dayKey } from "@/lib/bodyweight";
import { formatWeight, fromDisplay, toDisplay } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";
import { useT } from "@/i18n";
import { Sparkline } from "@/components/phase/visuals";

const shortDate = (at: number, locale: string) => new Date(at).toLocaleDateString(locale, { day: "numeric", month: "short" });

/** Daily weigh-ins: log today's weight, see the trend, correct a mistake. */
export function BodyweightSection({ now }: { now: number }) {
  const entries = useBodyStore((s) => s.entries);
  const logWeight = useBodyStore((s) => s.logWeight);
  const remove = useBodyStore((s) => s.remove);
  const { weightUnit: unit, bodyweightKg } = useSettingsStore();
  const phaseActive = useSettingsStore((s) => s.bodyPhase?.isActive === true);
  const [draft, setDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const current = entries[entries.length - 1]?.weightKg ?? bodyweightKg;
  const change = changeOver(entries, 30, now);
  const loggedToday = entries.some((e) => e.id === dayKey(now));
  const recent = [...entries].reverse().slice(0, 7);
  const chartData = entries.slice(-90).map((e) => ({ date: shortDate(e.date, t.locale), w: Math.round(toDisplay(e.weightKg, unit) * 10) / 10 }));
  /** Bodyweight reads to 0.1 in the user's unit: "79.5", "80". */
  const shown = (kg: number) => String(Math.round(toDisplay(kg, unit) * 10) / 10);

  function save() {
    const kg = draft === null ? null : fromDisplay(draft, unit);
    const [min, max] = PROFILE_LIMITS.bodyweightKg;
    if (kg === null || kg < min || kg > max) {
      setError(t("Enter {min} to {max}", { min: formatWeight(min, unit), max: formatWeight(max, unit) }));
      return;
    }
    logWeight(kg);
    setDraft(null);
    setError(null);
  }

  return (
    <section aria-labelledby="bw-heading" className="panel p-3">
      <h2 id="bw-heading" className="label-caps">
        {t("Bodyweight")}
      </h2>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="num text-3xl font-bold tracking-tight">
            {current === null ? "–" : shown(current)}
            {current !== null && <span className="ml-1 text-base font-semibold text-text-muted">{unit}</span>}
          </p>
          {change !== null && (
            <p className="num text-xs text-text-muted">
              {change > 0 ? "+" : change < 0 ? "−" : "±"}
              {t("{weight} {unit} in 30 days", { weight: shown(Math.abs(change)), unit })}
            </p>
          )}
        </div>
        <Sparkline values={entries.slice(-30).map((e) => e.weightKg)} width={96} height={36} />
      </div>
      {phaseActive && (
        <Link href="/phase" className="mt-3 flex min-h-11 items-center gap-2 rounded-ctl bg-surface-2 px-3 text-sm font-semibold hover:bg-press">
          <Scale aria-hidden="true" size={16} className="text-accent" />
          <span className="flex-1">{t("Trend and targets in your body phase")}</span>
          <ChevronRight aria-hidden="true" size={16} className="text-text-muted" />
        </Link>
      )}

      <form
        className="mt-3 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="bw-log" className="sr-only">
            {t("Weight to log in {unit}", { unit })}
          </label>
          <NumberField
            id="bw-log"
            value={draft}
            onCommit={(n) => {
              setDraft(n);
              setError(null);
            }}
            max={unit === "kg" ? PROFILE_LIMITS.bodyweightKg[1] : 882}
            placeholder={loggedToday ? t("Update today ({unit})", { unit }) : t("Today's weight ({unit})", { unit })}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "bw-log-error" : undefined}
            className="!px-3 !text-left !text-base"
          />
          {error && (
            <p id="bw-log-error" role="alert" className="mt-1 text-xs text-failure">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="primary" className="shrink-0">
          {loggedToday ? t("Update") : t("Log weight")}
        </Button>
      </form>

      {entries.length < 2 && (
        <p className="mt-3 text-sm text-text-muted">
          {entries.length === 0 ? t("One weigh-in a day builds your trend.") : t("Log another day to see the trend.")}
        </p>
      )}

      {/* Chart and the list behind one tap: the figure and the log above are what is used daily. */}
      {entries.length > 0 && (
        <details className="group mt-3 border-t border-line pt-1">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <span className="flex-1">{t("History")}</span>
            <span className="num text-xs text-text-muted">{entries.length}</span>
            <ChevronDown aria-hidden="true" size={16} className="text-text-muted transition-transform group-open:rotate-180" />
          </summary>
      {entries.length >= 2 && (
        <figure className="mt-1">
          <figcaption className="sr-only">{t("Bodyweight over time in {unit}", { unit })}</figcaption>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={CHART.grid} />
                <XAxis dataKey="date" tick={numTick} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tick={numTick} axisLine={false} tickLine={false} width={40} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
                <Tooltip {...tooltipStyle} cursor={{ stroke: CHART.axis }} formatter={(v) => [`${v} ${unit}`, t("Bodyweight")]} />
                <Line type="monotone" dataKey="w" stroke={CHART.series} strokeWidth={2} dot={{ r: 3, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </figure>
      )}

      {recent.length > 0 && (
        <ul className="mt-3 flex flex-col" aria-label={t("Recent weigh-ins")}>
          {recent.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center gap-3 border-t border-line">
              <time dateTime={e.id} className="num flex-1 text-sm text-text-muted">
                {new Date(e.date).toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short" })}
              </time>
              <span className="num text-sm font-semibold">
                {shown(e.weightKg)} {unit}
              </span>
              <button
                type="button"
                onClick={() => remove(e.id)}
                aria-label={t("Delete weigh-in on {date}", { date: shortDate(e.date, t.locale) })}
                className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted transition-colors hover:bg-failure/10 hover:text-failure"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
        </details>
      )}
    </section>
  );
}

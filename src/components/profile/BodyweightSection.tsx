"use client";

import { useEffect, useRef, useState } from "react";
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
import { PROFILE_LIMITS, type BodyweightEntry } from "@/types/workout";
import { useT } from "@/i18n";
import { Sparkline } from "@/components/phase/visuals";
import { DrawnCheck } from "@/components/ui/DrawnCheck";
import { AnimatePresence, motion } from "framer-motion";
import { LIST_ITEM } from "@/components/motion/listItem";
import { feedback } from "@/lib/feedback";
import { useShake } from "@/lib/useShake";
import { useSavedFlash } from "@/lib/useSavedFlash";

const shortDate = (at: number, locale: string) => new Date(at).toLocaleDateString(locale, { day: "numeric", month: "short" });

/** Rows shown before "See all": a week of daily weigh-ins. */
const RECENT = 7;
/** How long Undo stays after a weigh-in is deleted. */
const UNDO_MS = 6000;

/**
 * Daily weigh-ins: log today's weight (with body fat and waist when measured), see the trend,
 * correct a mistake and take a deletion back.
 */
export function BodyweightSection({ now }: { now: number }) {
  const entries = useBodyStore((s) => s.entries);
  const logWeight = useBodyStore((s) => s.logWeight);
  const remove = useBodyStore((s) => s.remove);
  const restore = useBodyStore((s) => s.restore);
  const [more, setMore] = useState(false);
  const [fat, setFat] = useState<number | null>(null);
  const [waist, setWaist] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const [deleted, setDeleted] = useState<BodyweightEntry | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }, []);
  const { weightUnit: unit, bodyweightKg } = useSettingsStore();
  const phaseActive = useSettingsStore((s) => s.bodyPhase?.isActive === true);
  const [draft, setDraft] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const { controls, shake } = useShake();
  const [saved, flash] = useSavedFlash();

  const current = entries[entries.length - 1]?.weightKg ?? bodyweightKg;
  const change = changeOver(entries, 30, now);
  const loggedToday = entries.some((e) => e.id === dayKey(now));
  const newestFirst = [...entries].reverse();
  const recent = all ? newestFirst : newestFirst.slice(0, RECENT);
  const chartData = entries.slice(-90).map((e) => ({ date: shortDate(e.date, t.locale), w: Math.round(toDisplay(e.weightKg, unit) * 10) / 10 }));
  /** Bodyweight reads to 0.1 in the user's unit: "79.5", "80". */
  const shown = (kg: number) => String(Math.round(toDisplay(kg, unit) * 10) / 10);

  function save() {
    const kg = draft === null ? null : fromDisplay(draft, unit);
    const [min, max] = PROFILE_LIMITS.bodyweightKg;
    if (kg === null || kg < min || kg > max) {
      setError(t("Enter {min} to {max}", { min: formatWeight(min, unit), max: formatWeight(max, unit) }));
      shake();
      return;
    }
    if (more && fat !== null && (fat < 2 || fat > 70)) {
      setError(t("Body fat: enter 2 to 70%"));
      shake();
      return;
    }
    if (more && waist !== null && (waist < 40 || waist > 250)) {
      setError(t("Waist: enter 40 to 250 cm"));
      shake();
      return;
    }
    const extra = more ? { ...(fat !== null ? { bodyFatPercent: fat } : {}), ...(waist !== null ? { waistCm: waist } : {}) } : {};
    logWeight(kg, undefined, extra);
    setDraft(null);
    setError(null);
    feedback.setComplete();
    flash();
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
        <motion.div animate={controls} className="min-w-0 flex-1">
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
        </motion.div>
        <Button type="submit" variant="primary" className="shrink-0">
          {saved ? (
            <>
              <DrawnCheck />
              {t("Saved")}
            </>
          ) : loggedToday ? (
            t("Update")
          ) : (
            t("Log weight")
          )}
        </Button>
      </form>
      {more && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="bw-fat" className="mb-1 block text-xs font-semibold text-text-muted">
              {t("Body fat %")}
            </label>
            <NumberField id="bw-fat" value={fat} onCommit={setFat} max={70} placeholder="20" className="!px-3 !text-left !text-base" />
          </div>
          <div>
            <label htmlFor="bw-waist" className="mb-1 block text-xs font-semibold text-text-muted">
              {t("Waist (cm)")}
            </label>
            <NumberField id="bw-waist" value={waist} onCommit={setWaist} max={250} placeholder="80" className="!px-3 !text-left !text-base" />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="mt-1 min-h-11 rounded-ctl px-1 text-sm font-semibold text-text-muted hover:text-text"
      >
        {more ? t("Weight only") : t("Add body fat and waist")}
      </button>

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
          <AnimatePresence initial={false}>
          {recent.map((e) => (
            <motion.li key={e.id} {...LIST_ITEM} className="flex min-h-11 items-center gap-3 overflow-hidden border-t border-line">
              <time dateTime={e.id} className="num flex-1 text-sm text-text-muted">
                {new Date(e.date).toLocaleDateString(t.locale, { weekday: "short", day: "numeric", month: "short" })}
              </time>
              <span className="num text-sm font-semibold">
                {shown(e.weightKg)} {unit}
                {(e.bodyFatPercent !== undefined || e.waistCm !== undefined) && (
                  <span className="block text-right text-xs font-normal text-text-muted">
                    {[e.bodyFatPercent !== undefined ? `${e.bodyFatPercent}%` : null, e.waistCm !== undefined ? `${e.waistCm} cm` : null].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  remove(e.id);
                  setDeleted(e);
                  if (undoTimer.current) clearTimeout(undoTimer.current);
                  undoTimer.current = setTimeout(() => setDeleted(null), UNDO_MS);
                }}
                aria-label={t("Delete weigh-in on {date}", { date: shortDate(e.date, t.locale) })}
                className="-mr-2 flex size-11 items-center justify-center rounded-ctl text-text-muted transition-colors hover:bg-failure/10 hover:text-failure"
              >
                <Trash2 aria-hidden="true" size={16} />
              </button>
            </motion.li>
          ))}
          </AnimatePresence>
        </ul>
      )}
      {entries.length > RECENT && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="min-h-11 w-full border-t border-line text-sm font-semibold text-text-muted hover:text-text">
          {all ? t("Show fewer") : t("See all {n}", { n: entries.length })}
        </button>
      )}
        </details>
      )}
      <div role="status" aria-live="polite">
        {deleted && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-ctl bg-surface-2 py-1 pl-3 pr-1 text-sm">
            <span>{t("Weigh-in deleted")}</span>
            <Button
              variant="ghost"
              onClick={() => {
                restore(deleted);
                setDeleted(null);
                if (undoTimer.current) clearTimeout(undoTimer.current);
              }}
              className="text-accent"
            >
              {t("Undo")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

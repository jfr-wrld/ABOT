"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, Dumbbell, Home as HomeIcon, ListOrdered, PersonStanding, Play, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { SEED_EXERCISES_BY_ID } from "@/data/exercises";
import { feedback } from "@/lib/feedback";
import {
  PLACE_BLURB,
  PLACE_LABEL,
  PLAN_DAYS,
  SPLIT_BLURB,
  SPLIT_LABEL,
  buildPlan,
  defaultWeekdays,
  orderWeekdays,
  recommendSplit,
  splitsFor,
  type Place,
  type PlanAnswers,
  type PlanDays,
} from "@/lib/training-plan";
import type { Weekday } from "@/lib/notifications/schedule";
import type { Routine } from "@/types/workout";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useReminderStore } from "@/store/useReminderStore";
import { routineMinutes } from "@/lib/home";
import { useT, type T } from "@/i18n";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const STEPS = 5;

/** Long weekday name for Date#getDay numbering (7 Jan 2024 was a Sunday). */
export function weekdayName(t: T, wd: Weekday, style: "long" | "short" = "long"): string {
  return new Date(2024, 0, 7 + wd).toLocaleDateString(t.locale, { weekday: style });
}


/**
 * The week in five short steps: goal and experience, the days, where, the week itself (with the
 * split to change), and the reminder time. Used at install (after the intro) and from Home to
 * adjust; `onSave` writes it (lib/apply-plan) and the caller decides where to go next.
 */
export function PlanSetup({
  initial,
  adjusting,
  onSave,
  onExit,
  exitLabel,
}: {
  initial: PlanAnswers;
  adjusting: boolean;
  onSave: (a: PlanAnswers) => void;
  onExit: () => void;
  exitLabel: string;
}) {
  const t = useT();
  const firstDay = useSettingsStore((s) => s.firstDayOfWeek);
  const permission = useReminderStore((s) => s.permission);
  const [step, setStep] = useState(0);
  const [a, setA] = useState<PlanAnswers>(initial);
  const [busy, setBusy] = useState(false);

  // Days, experience and place pick the split again; the week step can still change it.
  const set = (patch: Partial<PlanAnswers>) =>
    setA((prev) => {
      const next = { ...prev, ...patch };
      if ("days" in patch || "level" in patch || "place" in patch) next.split = recommendSplit(next.days, next.level, next.place);
      return next;
    });

  const titles = [t("What are you training for?"), t("How many days a week?"), t("Where do you train?"), t("Your week"), t("When do you train?")];

  async function save(remind: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      if (remind && permission !== "granted") await useReminderStore.getState().requestPermission();
      onSave(a);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            aria-label={t("Back")}
            className="-ml-2 flex size-11 items-center justify-center rounded-ctl text-text-muted hover:bg-ink/[0.05] hover:text-text"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        ) : null}
        <ol aria-label={t("Step {n} of {total}", { n: step + 1, total: STEPS })} className="flex flex-1 gap-1">
          {Array.from({ length: STEPS }, (_, i) => (
            <li key={i} aria-hidden="true" className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-ink/[0.12]"}`} />
          ))}
        </ol>
      </div>
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{titles[step]}</h1>

      <div className="mt-5 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pb-2">
        {step === 0 && (
          <>
            <Pills
              label={t("Goal")}
              value={a.goal}
              onChange={(goal) => set({ goal })}
              options={[
                ["muscle", t("Build muscle")],
                ["strength", t("Get stronger")],
                ["fat_loss", t("Lose fat")],
                ["fitness", t("Stay fit")],
              ]}
            />
            <Pills
              label={t("Lifting experience")}
              value={a.level}
              onChange={(level) => set({ level })}
              options={[
                ["new", t("New")],
                ["some", t("Under 2 years")],
                ["experienced", t("2 years +")],
              ]}
            />
          </>
        )}

        {step === 1 && (
          <>
            <Pills
              label={t("Days a week")}
              value={a.days}
              onChange={(days: PlanDays) => set({ days, weekdays: defaultWeekdays(days) })}
              options={PLAN_DAYS.map((d) => [d, String(d)])}
            />
            <fieldset>
              <legend className="mb-1.5 text-sm font-semibold">{t("Which days")}</legend>
              <p className="mb-2 text-xs text-text-muted">{t("Spread out for recovery. Tap a day to change it.")}</p>
              <div className="grid grid-cols-7 gap-1">
                {orderWeekdays([0, 1, 2, 3, 4, 5, 6], firstDay).map((wd) => {
                  const on = a.weekdays.includes(wd);
                  const locked = on ? a.weekdays.length <= 2 : a.weekdays.length >= 6;
                  return (
                    <button
                      key={wd}
                      type="button"
                      aria-pressed={on}
                      aria-label={weekdayName(t, wd)}
                      disabled={locked}
                      onClick={() => {
                        feedback.tick();
                        const weekdays = on ? a.weekdays.filter((d) => d !== wd) : [...a.weekdays, wd];
                        set({ weekdays, days: weekdays.length as PlanDays });
                      }}
                      className={`tap min-h-11 rounded-lg border text-xs font-bold disabled:opacity-40 ${
                        on ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted"
                      }`}
                    >
                      {weekdayName(t, wd, "short")}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}

        {step === 2 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("Where do you train?")}</legend>
            {(["gym", "home", "bodyweight"] as Place[]).map((p) => {
              const Icon = p === "gym" ? Dumbbell : p === "home" ? HomeIcon : PersonStanding;
              const on = a.place === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    if (!on) feedback.tick();
                    set({ place: p });
                  }}
                  className={`tap flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left ${on ? "border-accent bg-accent-tint" : "border-ink/[0.12]"}`}
                >
                  <Icon aria-hidden="true" size={22} className={on ? "text-accent" : "text-text-muted"} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{t(PLACE_LABEL[p])}</span>
                    <span className="text-xs text-text-muted">{t(PLACE_BLURB[p])}</span>
                  </span>
                  {on && <Check aria-hidden="true" size={18} className="text-accent" />}
                </button>
              );
            })}
          </fieldset>
        )}

        {step === 3 && <WeekPreview a={a} firstDay={firstDay} onSplit={(split) => setA((p) => ({ ...p, split }))} />}

        {step === 4 && (
          <>
            <div role="group" aria-labelledby="plan-time">
              <span id="plan-time" className="mb-1.5 block text-sm font-semibold">
                {t("Session time")}
              </span>
              <div className="flex items-center gap-1">
                <Select
                  aria-label={t("Hour")}
                  value={a.time.split(":")[0]!.padStart(2, "0")}
                  onChange={(h) => set({ time: `${h}:${a.time.split(":")[1]}` })}
                  options={HOURS.map((h) => ({ value: h, label: h }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
                <span aria-hidden="true" className="num text-xl font-bold text-text-muted">
                  :
                </span>
                <Select
                  aria-label={t("Minute")}
                  value={MINUTES.includes(a.time.split(":")[1]!) ? a.time.split(":")[1]! : "00"}
                  onChange={(m) => set({ time: `${a.time.split(":")[0]}:${m}` })}
                  options={MINUTES.map((m) => ({ value: m, label: m }))}
                  className="num h-12 flex-1 justify-center !px-2 !text-xl font-bold"
                />
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm text-text-muted">
              <Bell aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
              {t("A reminder at {time} on {days}, and a pack-your-bag call 30 minutes before.", {
                time: a.time,
                days: orderWeekdays(a.weekdays, firstDay)
                  .map((wd) => weekdayName(t, wd, "short"))
                  .join(", "),
              })}
            </p>
            <p className="text-xs text-text-muted">{t("Change days, workouts and reminders any time from Home.")}</p>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">
        {step < 4 ? (
          <Button variant="primary" onClick={() => setStep(step + 1)} className="min-h-12 w-full text-base">
            {step === 3 ? t("Looks good") : t("Next")}
          </Button>
        ) : permission === "granted" || permission === "unsupported" ? (
          <Button variant="primary" disabled={busy} onClick={() => void save(false)} className="min-h-12 w-full text-base">
            <CalendarDays aria-hidden="true" size={18} />
            {adjusting ? t("Save my plan") : t("Set up my week")}
          </Button>
        ) : (
          <>
            <Button variant="primary" disabled={busy} onClick={() => void save(true)} className="min-h-12 w-full text-base">
              <Bell aria-hidden="true" size={18} />
              {t("Remind me and save")}
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save(false)}
              className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
            >
              {t("Save without reminders")}
            </button>
          </>
        )}
        {step < 4 && (
          <button
            type="button"
            onClick={onExit}
            className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
          >
            {exitLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Seven rows, training days with their workout (tap to see the exercises), rest days dimmed. */
function WeekPreview({ a, firstDay, onSplit }: { a: PlanAnswers; firstDay: 0 | 1; onSplit: (s: PlanAnswers["split"]) => void }) {
  const t = useT();
  const built = useMemo(() => buildPlan(a, firstDay), [a, firstDay]);
  const [open, setOpen] = useState<Weekday | null>(null);
  const splits = splitsFor(a.days, a.level, a.place);
  const routineOf = (tpl: string) => built.routines.find((r) => r.templateId === tpl)?.routine;

  return (
    <>
      {splits.length > 1 && (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t("Split")}</legend>
          <div className="flex flex-col gap-1.5">
            {splits.map((s, i) => (
              <button
                key={s}
                type="button"
                aria-pressed={a.split === s}
                onClick={() => {
                  if (a.split !== s) feedback.tick();
                  onSplit(s);
                }}
                className={`tap flex min-h-12 flex-col justify-center rounded-xl border px-3 py-2 text-left ${a.split === s ? "border-accent bg-accent-tint" : "border-ink/[0.12]"}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {t(SPLIT_LABEL[s])}
                  {i === 0 && <span className="label-caps rounded bg-accent px-1.5 py-0.5 !text-[10px] !text-on-accent">{t("Recommended")}</span>}
                </span>
                {a.split === s && <span className="mt-0.5 text-xs text-text-muted">{t(SPLIT_BLURB[s])}</span>}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <ul aria-label={t("Your week")} className="flex flex-col gap-1.5">
        {orderWeekdays([0, 1, 2, 3, 4, 5, 6], firstDay).map((wd) => {
          const tpl = built.assignment[wd];
          const r = tpl ? routineOf(tpl) : undefined;
          if (!r)
            return (
              <li key={wd} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-text-muted opacity-60">
                <span className="w-12 font-semibold">{weekdayName(t, wd, "short")}</span>
                {t("Rest")}
              </li>
            );
          const expanded = open === wd;
          return (
            <li key={wd} className="rounded-xl border border-line bg-surface">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : wd)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className="w-12 shrink-0 text-sm font-bold">{weekdayName(t, wd, "short")}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">{r.name}</span>
                  <span className="flex items-center gap-3 whitespace-nowrap text-xs text-text-muted">
                    <span className="num inline-flex items-center gap-1">
                      <Timer aria-hidden="true" size={12} />
                      {t("{n} min", { n: routineMinutes(r) })}
                    </span>
                    <span className="num inline-flex items-center gap-1">
                      <ListOrdered aria-hidden="true" size={12} />
                      {t.n(r.exercises.length, "{n} exercise", "{n} exercises")}
                    </span>
                  </span>
                </span>
                <ChevronDown aria-hidden="true" size={16} className={`shrink-0 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded && (
                <ol className="flex flex-col gap-2 border-t border-line p-3">
                  {r.exercises.map((e) => {
                    const ex = SEED_EXERCISES_BY_ID[e.exerciseId];
                    if (!ex) return null;
                    const reps = e.sets[0]?.targetReps;
                    return (
                      <li key={e.id} className="flex items-center gap-2 text-sm">
                        <ExerciseThumb exercise={ex} size={32} />
                        <span className="min-w-0 flex-1 truncate">{ex.name}</span>
                        <span className="num shrink-0 text-xs text-text-muted">
                          {reps ? `${e.sets.length} × ${reps}` : t.n(e.sets.length, "{n} set", "{n} sets")}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Pills<V extends string | number>({ label, value, onChange, options }: { label: string; value: V; onChange: (v: V) => void; options: [V, ReactNode][] }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={value === v}
            onClick={() => {
              if (value !== v) feedback.tick();
              onChange(v);
            }}
            className={`tap min-h-11 min-w-11 rounded-full border px-4 text-sm font-semibold ${
              value === v ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** Today's planned routine from the saved store, for "Start today's workout" after setup. */
export function todaysPlanned(routines: Routine[], schedule: { enabled: boolean; days: Record<Weekday, { on: boolean; routineId: string | null }> }, now = Date.now()): Routine | null {
  const day = schedule.days[new Date(now).getDay() as Weekday];
  if (!schedule.enabled || !day?.on || !day.routineId) return null;
  return routines.find((r) => r.id === day.routineId) ?? null;
}

/** After saving: what was set up, then start today's workout (if today is a training day) or go Home. */
export function PlanSaved({
  routines,
  replaced,
  kept,
  time,
  weekdays,
  today,
  onStart,
  onHome,
}: {
  routines: number;
  replaced: number;
  kept: number;
  time: string;
  weekdays: Weekday[];
  today: Routine | null;
  onStart: (r: Routine) => void;
  onHome: () => void;
}) {
  const t = useT();
  const firstDay = useSettingsStore((s) => s.firstDayOfWeek);
  const permission = useReminderStore((s) => s.permission);
  const days = orderWeekdays(weekdays, firstDay)
    .map((wd) => weekdayName(t, wd, "short"))
    .join(", ");
  const lines = [
    t.n(routines, "{n} workout saved in My Routines, folder My plan.", "{n} workouts saved in My Routines, folder My plan."),
    t("Training days: {days}. Home shows the next one.", { days }),
    permission === "granted"
      ? t("Reminders at {time}, 30 minutes' notice before.", { time })
      : t("Reminders are off. Allow notifications in Settings to get them."),
  ];
  if (replaced || kept) lines.push(t("{replaced} old plan workouts replaced, {kept} you edited kept.", { replaced, kept }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <span aria-hidden="true" className="mt-6 flex size-14 items-center justify-center rounded-full bg-accent text-on-accent">
        <Check size={28} strokeWidth={3} />
      </span>
      <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight">{t("Your week is set")}</h1>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-text-muted">
        {lines.map((l) => (
          <li key={l} className="flex gap-2">
            <Check aria-hidden="true" size={16} className="mt-0.5 shrink-0 text-accent" />
            {l}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-6">
        {today ? (
          <>
            <Button variant="primary" onClick={() => onStart(today)} className="min-h-12 w-full text-base">
              <Play aria-hidden="true" size={18} />
              <span className="truncate">{t("Start today: {name}", { name: today.name })}</span>
            </Button>
            <button
              type="button"
              onClick={onHome}
              className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
            >
              {t("Go to Home")}
            </button>
          </>
        ) : (
          <Button variant="primary" onClick={onHome} className="min-h-12 w-full text-base">
            {t("Go to Home")}
          </Button>
        )}
      </div>
    </div>
  );
}

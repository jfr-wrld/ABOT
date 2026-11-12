"use client";

import { Fragment, useMemo, useState } from "react";
import { Check, Dumbbell, ListChecks, Minus, Plus, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { MacroBar } from "@/components/phase/visuals";
import { FoodPhoto } from "./FoodPhoto";
import { AISLE_LABEL, SLOT_LABEL, groceryList, planDay, templatesFor, type PlannedMeal } from "@/lib/meal-templates";
import type { BodyPhaseType, FuelTarget } from "@/lib/phase-engine";
import { entryFor, useFoodLog } from "@/store/useFoodLog";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * A day of Indonesian meals sized to the phase's target (lib/meal-templates), to log meal by
 * meal or whole; then the same day prepped for several days, with its shopping list.
 */
export function DayPlan({ phase, fuel }: { phase: BodyPhaseType; fuel: FuelTarget }) {
  const t = useT();
  const templates = useMemo(() => templatesFor(phase), [phase]);
  const [pick, setPick] = useState(templates[0]!.id);
  const template = templates.find((x) => x.id === pick) ?? templates[0]!;
  const day = useMemo(() => planDay(template, fuel), [template, fuel]);
  const [logged, setLogged] = useState<Set<string>>(new Set());

  const log = (meals: PlannedMeal[], key: string) => {
    useFoodLog.getState().add(meals.flatMap((m) => m.items.map((it) => entryFor(it.food, it.grams, m.slot))));
    feedback.setComplete();
    setLogged((s) => new Set([...s, key]));
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="plan-heading" className="flex flex-col gap-3">
        <h2 id="plan-heading" className="label-caps">
          {t("Day plan")}
        </h2>
        <div role="group" aria-label={t("Choose a day plan")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {templates.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={x.id === template.id}
              onClick={() => {
                if (x.id !== template.id) feedback.tick();
                setPick(x.id);
                setLogged(new Set());
              }}
              className={`tap min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold ${
                x.id === template.id ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
              }`}
            >
              {t(x.name)}
            </button>
          ))}
        </div>
        <p className="num text-xs text-text-muted">
          {t("{kcal} kcal · P {p} · C {c} · F {f} g, sized to today's target of {target} kcal", {
            kcal: day.totals.kcal.toLocaleString(t.locale),
            p: Math.round(day.totals.protein),
            c: Math.round(day.totals.carbs),
            f: Math.round(day.totals.fat),
            target: fuel.kcal.toLocaleString(t.locale),
          })}
        </p>

        <ol className="flex flex-col gap-2">
          {day.meals.map((m, i) => {
            const key = `${template.id}:${i}`;
            // The session sits between the meals around it, so the day reads in order.
            const trainingHere = m.slot === "post" && day.meals[i - 1]?.slot !== "post";
            const when = m.slot === "pre" ? t("60 to 90 min before training") : m.slot === "post" ? t("within 2 hours after") : null;
            return (
              <Fragment key={key}>
              {trainingHere && (
                <li aria-hidden="true" className="flex items-center gap-2 py-0.5 pl-1">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Dumbbell size={14} />
                  </span>
                  <span className="text-xs font-semibold text-text-muted">{t("Training")}</span>
                </li>
              )}
              <li className="rounded-card border border-line bg-surface p-3">
                <p className="flex items-baseline gap-2">
                  <span className="text-sm font-bold">{t(SLOT_LABEL[m.slot])}</span>
                  {when && <span className="text-xs text-text-muted">{when}</span>}
                  <span className="num ml-auto text-sm font-bold">{m.totals.kcal} kcal</span>
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {m.items.map((it) => (
                    <li key={it.food.id} className="flex items-center gap-2.5">
                      <FoodPhoto id={it.food.id} size={36} className="rounded-lg" />
                      <span className="min-w-0 flex-1 truncate text-sm">{t(it.food.name)}</span>
                      <span className="num text-sm font-semibold">
                        {it.grams} {it.food.category === "DRINK_HYDRATION" ? "ml" : "g"}
                      </span>
                    </li>
                  ))}
                </ul>
                <MacroBar protein={m.totals.protein} carbs={m.totals.carbs} fat={m.totals.fat} className="mt-2.5 h-1.5" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="num text-[11px] text-text-muted">
                    P {Math.round(m.totals.protein)} · C {Math.round(m.totals.carbs)} · F {Math.round(m.totals.fat)} g
                  </span>
                  <button
                    type="button"
                    disabled={logged.has(key)}
                    onClick={() => log([m], key)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-xs font-semibold text-accent hover:bg-accent-tint disabled:text-text-muted"
                  >
                    {logged.has(key) ? <Check aria-hidden="true" size={14} /> : <Plus aria-hidden="true" size={14} />}
                    {logged.has(key) ? t("Logged") : t("Log this meal")}
                  </button>
                </div>
              </li>
              </Fragment>
            );
          })}
        </ol>
        <Button variant="primary" disabled={logged.has(`${template.id}:day`)} onClick={() => log(day.meals, `${template.id}:day`)}>
          <ListChecks aria-hidden="true" size={16} />
          {logged.has(`${template.id}:day`) ? t("Day logged") : t("Log the whole day")}
        </Button>
      </section>

      <MealPrep day={day} />
      <IsiPiringku />
    </div>
  );
}

/** The plan cooked for several days: what to buy, raw, grouped by where it is sold. */
function MealPrep({ day }: { day: ReturnType<typeof planDay> }) {
  const t = useT();
  const [days, setDays] = useState(3);
  const [have, setHave] = useState<Set<string>>(new Set());
  const list = useMemo(() => groceryList(day, days), [day, days]);
  const aisles = [...new Set(list.map((l) => l.aisle))];
  const kg = (g: number) => (g >= 1000 ? `${(g / 1000).toLocaleString(t.locale, { maximumFractionDigits: 1 })} kg` : `${g} g`);
  return (
    <section aria-labelledby="prep-heading" className="flex flex-col gap-3">
      <h2 id="prep-heading" className="label-caps">
        {t("Meal prep")}
      </h2>
      <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-3">
        <span className="text-sm font-semibold">{t("Cook this plan for")}</span>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDays((d) => Math.max(1, d - 1))} aria-label={t("One day fewer")} className="size-11 !px-0">
            <Minus aria-hidden="true" size={16} />
          </Button>
          <span className="num w-16 text-center text-sm font-bold" aria-live="polite">
            {t.n(days, "{n} day", "{n} days")}
          </span>
          <Button onClick={() => setDays((d) => Math.min(7, d + 1))} aria-label={t("One day more")} className="size-11 !px-0">
            <Plus aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
      <div className="rounded-card border border-line bg-surface p-3">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <ShoppingBasket aria-hidden="true" size={16} className="text-accent" />
          {t("Shopping list")}
        </h3>
        {aisles.map((a) => (
          <div key={a} className="mt-3">
            <p className="label-caps">{t(AISLE_LABEL[a])}</p>
            <ul className="mt-1">
              {list
                .filter((l) => l.aisle === a)
                .map((l) => {
                  const on = have.has(l.foodId);
                  return (
                    <li key={l.foodId}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setHave((s) => {
                              const next = new Set(s);
                              if (on) next.delete(l.foodId);
                              else next.add(l.foodId);
                              return next;
                            })
                          }
                          className="size-5 accent-[var(--color-accent)]"
                        />
                        <span className={`min-w-0 flex-1 text-sm ${on ? "text-text-muted line-through" : ""}`}>{t(l.label)}</span>
                        <span className="num text-sm font-semibold">{kg(l.grams)}</span>
                      </label>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        <p className="mt-3 text-[11px] text-text-muted">{t("Rice and pasta are listed dry: they weigh about 2.5 times more once cooked.")}</p>
      </div>
    </section>
  );
}

/** Kemenkes' plate guide, for days without a scale. */
function IsiPiringku() {
  const t = useT();
  return (
    <section aria-labelledby="piring-heading" className="flex items-center gap-4 rounded-card border border-line bg-surface p-3">
      <svg viewBox="0 0 100 100" width={96} height={96} aria-hidden="true" className="shrink-0">
        <circle cx="50" cy="50" r="46" fill="var(--color-surface-2)" stroke="var(--color-line-strong)" strokeWidth="2" />
        {/* Left half: vegetables (2/3) and fruit (1/3). Right half: staple (2/3) and protein (1/3). */}
        <path d="M50 50 L50 4 A46 46 0 0 0 10.2 73 Z" fill="var(--color-accent)" opacity="0.85" />
        <path d="M50 50 L10.2 73 A46 46 0 0 0 50 96 Z" fill="var(--color-accent)" opacity="0.45" />
        <path d="M50 50 L50 4 A46 46 0 0 1 89.8 73 Z" fill="var(--color-accent-dim)" />
        <path d="M50 50 L89.8 73 A46 46 0 0 1 50 96 Z" fill="var(--color-text-muted)" opacity="0.7" />
      </svg>
      <div className="min-w-0">
        <h2 id="piring-heading" className="text-sm font-bold">
          {t("No scale? Use Isi Piringku")}
        </h2>
        <ul className="mt-1 text-xs leading-relaxed text-text-muted">
          <li>{t("Half the plate: vegetables, then fruit")}</li>
          <li>{t("The other half: two parts rice or another staple, one part lauk (protein)")}</li>
          <li>{t("Kemenkes RI's guide for a balanced plate")}</li>
        </ul>
      </div>
    </section>
  );
}

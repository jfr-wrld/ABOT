"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dumbbell, RefreshCw } from "lucide-react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Rise } from "@/components/motion/Entrance";
import { usePhaseTelemetry, type PhaseTelemetry } from "@/components/phase/usePhaseTelemetry";
import { MacroBar } from "@/components/phase/visuals";
import { CATEGORY_ICON, FoodIcon } from "@/components/phase/foodIcons";
import { CATEGORY_LABEL, DIGEST_LABEL, FOOD_CATEGORIES, LEVEL_LABEL, foodsFor, mealCombos, type Food, type FoodCategory, type MealCombo } from "@/lib/nutrition-guide";
import { PHASE_LABEL } from "@/lib/phase-engine";
import { feedback } from "@/lib/feedback";
import { useNow } from "@/lib/useNow";
import { useT } from "@/i18n";

export default function FuelPage() {
  return (
    <HydrationGate>
      <FuelScreen />
    </HydrationGate>
  );
}

function FuelScreen() {
  const t = useT();
  const now = useNow(60_000);
  const m = usePhaseTelemetry(now);
  if (!m) {
    return (
      <main className="flex flex-1 flex-col">
        <PageHeader title={t("Meals and foods")} back={{ href: "/phase", label: t("Body phase") }} />
        <section className="mx-4 mt-6 flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 text-center">
          <p className="text-sm text-text-muted">{t("Meal sizes follow your phase's daily target. Choose a phase first.")}</p>
          <Link href="/phase/setup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-on-accent hover:brightness-110">
            {t("Choose a body phase")}
          </Link>
        </section>
      </main>
    );
  }
  return (
    <main className="flex flex-1 flex-col gap-5 pb-8">
      <PageHeader
        title={t("Meals and foods")}
        back={{ href: "/phase", label: t("Body phase") }}
        subtitle={<span className="num">{t("{kcal} kcal today · {phase}", { kcal: m.fuel.kcal.toLocaleString(t.locale), phase: t(PHASE_LABEL[m.phase.phaseType]) })}</span>}
      />
      <Rise order={0} className="px-4">
        <Meals m={m} />
      </Rise>
      <Rise order={1} className="px-4">
        <Foods m={m} />
      </Rise>
      <p className="px-4 text-center text-[11px] text-text-muted">{t("Typical values from USDA FoodData Central. Brands and cooking change them.")}</p>
    </main>
  );
}

/** Before and after the session as a short timeline around a dumbbell. */
function Meals({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const [pick, setPick] = useState(0);
  const [pre, post] = mealCombos(m.phase.phaseType, m.fuel, pick);
  return (
    <section aria-labelledby="meals-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="meals-heading" className="label-caps">
          {t("Around training")}
        </h2>
        <button
          type="button"
          onClick={() => {
            feedback.tick();
            setPick((p) => p + 1);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-ctl px-2 text-xs font-semibold text-text-muted hover:bg-ink/[0.05] hover:text-text"
        >
          <RefreshCw aria-hidden="true" size={14} />
          {t("Swap foods")}
        </button>
      </div>
      <ol className="mt-2 flex flex-col">
        <MealStop combo={pre!} label={t("Before")} when={t("60 to 90 min")} pick={pick} />
        <li aria-hidden="true" className="flex items-center gap-3 py-1 pl-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
            <Dumbbell size={16} />
          </span>
          <span className="text-xs font-semibold text-text-muted">{t("Training")}</span>
        </li>
        <MealStop combo={post!} label={t("After")} when={t("within 2 hours")} pick={pick} last />
      </ol>
    </section>
  );
}

function MealStop({ combo, label, when, pick, last = false }: { combo: MealCombo; label: string; when: string; pick: number; last?: boolean }) {
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <li className="relative flex gap-3">
      <span aria-hidden="true" className="flex w-8 shrink-0 justify-center">
        <span className={`w-px bg-line-strong ${last ? "h-4" : "h-full"}`} />
      </span>
      <div className="mb-1 min-w-0 flex-1 rounded-card border border-line bg-surface p-3">
        <p className="flex items-baseline gap-2">
          <span className="text-sm font-bold">{label}</span>
          <span className="text-xs text-text-muted">{when}</span>
          <span className="num ml-auto text-sm font-bold">{combo.kcal} kcal</span>
        </p>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.ul
            key={pick}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="mt-2 flex flex-wrap gap-2"
          >
            {combo.items.map((i) => {
              return (
                <li key={i.food.id} className="flex items-center gap-2 rounded-ctl bg-surface-2 py-1.5 pl-1.5 pr-3">
                  <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-accent-tint text-accent">
                    <FoodIcon id={i.food.id} size={15} />
                  </span>
                  <span className="text-xs font-semibold">{t(i.food.name)}</span>
                  <span className="num text-xs font-bold">{i.grams} g</span>
                </li>
              );
            })}
          </motion.ul>
        </AnimatePresence>
        <MacroBar protein={combo.protein} carbs={combo.carbs} fat={combo.fat} className="mt-2.5 h-1.5" />
        <p className="num mt-1 text-[11px] text-text-muted">
          P {combo.protein} · C {combo.carbs} · F {combo.fat} g
        </p>
      </div>
    </li>
  );
}

/** The food matrix: a picture, the calories, the macro split; tap for the portion and why. */
function Foods({ m }: { m: PhaseTelemetry }) {
  const t = useT();
  const [category, setCategory] = useState<FoodCategory>("PROTEIN");
  const [open, setOpen] = useState<string | null>(null);
  const phase = m.phase.phaseType;
  const foods = foodsFor(phase, category);
  return (
    <section aria-labelledby="foods-heading" className="flex flex-col gap-3">
      <h2 id="foods-heading" className="label-caps">
        {t("Foods")}
      </h2>
      <div role="tablist" aria-label={t("Food type")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {FOOD_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICON[c];
          const on = category === c;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                if (!on) feedback.tick();
                setCategory(c);
                setOpen(null);
              }}
              className={`flex h-10 shrink-0 items-center gap-1.5 rounded-ctl border px-3 text-xs font-semibold ${on ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"}`}
            >
              <Icon aria-hidden="true" size={15} />
              {t(CATEGORY_LABEL[c])}
            </button>
          );
        })}
      </div>
      <ul role="tabpanel" aria-label={t(CATEGORY_LABEL[category])} className="grid grid-cols-2 gap-2.5">
        {foods.map((f) => (
          <FoodTile key={f.id} food={f} suits={f.bestForPhases.includes(phase)} open={open === f.id} onToggle={() => setOpen((o) => (o === f.id ? null : f.id))} />
        ))}
      </ul>
    </section>
  );
}

function FoodTile({ food: f, suits, open, onToggle }: { food: Food; suits: boolean; open: boolean; onToggle: () => void }) {
  const t = useT();
  const m = f.macrosPer100g;
  const drink = f.category === "DRINK_HYDRATION";
  return (
    <li className={open ? "col-span-2" : ""}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`relative flex w-full flex-col gap-2 rounded-card border p-3 text-left transition-colors ${open ? "border-accent/60 bg-surface" : "border-line bg-surface hover:border-line-hover"}`}
      >
        {suits && (
          <span className="absolute right-3 top-3 size-2 rounded-full bg-accent">
            <span className="sr-only">{t("Suits your phase")}</span>
          </span>
        )}
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-text">
          <FoodIcon id={f.id} size={20} />
        </span>
        <span className="text-sm font-bold leading-tight">{t(f.name)}</span>
        <span className="num text-lg font-bold leading-none">
          {m.calories}
          <span className="ml-1 text-[11px] font-semibold text-text-muted">kcal / 100 {drink ? "ml" : "g"}</span>
        </span>
        <MacroBar protein={m.protein} carbs={m.carbs} fat={m.fat} className="h-1.5" />
        <span className="num grid grid-cols-3 text-[11px] text-text-muted">
          <span>P {m.protein}</span>
          <span>C {m.carbs}</span>
          <span>F {m.fat}</span>
        </span>
        {open && (
          <span className="flex flex-col gap-1.5 border-t border-line pt-2">
            <span className="text-sm font-semibold">{t(f.servingVisual)}</span>
            <span className="text-xs text-text-muted">{t(f.tacticalNote)}</span>
            <span className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded-ctl bg-surface-2 px-2 py-1">{t("Fullness: {level}", { level: t(LEVEL_LABEL[f.satietyIndex]) })}</span>
              <span className="rounded-ctl bg-surface-2 px-2 py-1">{t("Digests: {speed}", { speed: t(DIGEST_LABEL[f.digestSpeed]) })}</span>
            </span>
          </span>
        )}
      </button>
    </li>
  );
}

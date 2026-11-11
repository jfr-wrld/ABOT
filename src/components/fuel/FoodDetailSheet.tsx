"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/components/ui/NumberField";
import { MACRO_COLOR } from "@/components/phase/visuals";
import { FoodPhoto } from "./FoodPhoto";
import { DIGEST_LABEL, LEVEL_LABEL, SOURCE_LABEL, type Food } from "@/lib/nutrition-guide";
import { gramsFor, nutrientsFor, portionsOf, type Macro } from "@/lib/nutrition-calc";
import { SLOT_LABEL, type MealSlot } from "@/lib/meal-templates";
import { entryFor, mealAt, useFoodLog } from "@/store/useFoodLog";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

const MEALS: MealSlot[] = ["breakfast", "lunch", "pre", "post", "dinner", "snack"];
export const CALC: { macro: Macro; label: string; unit: string }[] = [
  { macro: "protein", label: "protein", unit: "g" },
  { macro: "carbs", label: "carbs", unit: "g" },
  { macro: "fat", label: "fat", unit: "g" },
  { macro: "calories", label: "calories", unit: "kcal" },
];

/** "1.5" -> "1½": halves read better than decimals for a scoop of rice. */
const halves = (n: number) => (Number.isInteger(n) ? String(n) : `${Math.floor(n) || ""}½`);

/**
 * One food: its photo, a portion in household units or grams, what that portion holds, and the
 * reverse question ("how much for 40 g carbs?"). Adds the portion to today's log.
 */
export function FoodDetailSheet({ food, onClose }: { food: Food | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={food !== null} onClose={onClose} title={food ? t(food.name) : ""}>
      {food && <Detail key={food.id} food={food} onDone={onClose} />}
    </Sheet>
  );
}

function Detail({ food, onDone }: { food: Food; onDone: () => void }) {
  const t = useT();
  const portions = portionsOf(food);
  const [grams, setGrams] = useState(portions[0]!.grams);
  const [meal, setMeal] = useState<MealSlot>(() => mealAt(Date.now()));
  const [calc, setCalc] = useState<Macro>(food.macrosPer100g.protein >= food.macrosPer100g.carbs ? "protein" : "carbs");
  const [amount, setAmount] = useState<number | null>(null);
  const n = nutrientsFor(food, grams);
  const drink = food.category === "DRINK_HYDRATION";
  const g = drink ? "ml" : "g";
  const answer = amount ? gramsFor(food, calc, amount) : null;
  const calcUnit = CALC.find((c) => c.macro === calc)!;

  const rows: { label: string; value: number; color: string; max: number }[] = [
    { label: t("Protein"), value: n.protein, color: MACRO_COLOR.protein, max: 60 },
    { label: t("Carbs"), value: n.carbs, color: MACRO_COLOR.carbs, max: 120 },
    { label: t("Fat"), value: n.fat, color: MACRO_COLOR.fat, max: 50 },
    ...(food.fiber !== undefined ? [{ label: t("Fibre"), value: n.fiber, color: "var(--color-text-muted)", max: 15 }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <FoodPhoto id={food.id} size={320} className="mx-auto aspect-square !h-auto max-h-56 w-full max-w-56 rounded-card" />

      <div>
        <p className="mb-1.5 text-sm font-semibold">{t("Portion")}</p>
        <div className="flex flex-wrap gap-1.5">
          {portions.map((p) => (
            <button
              key={`${p.label}-${p.grams}`}
              type="button"
              aria-pressed={grams === p.grams}
              onClick={() => {
                feedback.tick();
                setGrams(p.grams);
              }}
              className={`tap min-h-11 rounded-full border px-3.5 text-xs font-semibold ${
                grams === p.grams ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
              }`}
            >
              {t(p.label)}
              {/* Older servings already say their weight: "(~100 g)". */}
              {!/\(~\d/.test(p.label) && (
                <>
                  {" · "}
                  <span className="num">
                    {p.grams} {g}
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Button onClick={() => setGrams((x) => Math.max(5, x - 10))} aria-label={t("10 {unit} less", { unit: g })} className="size-11 !px-0">
            <Minus aria-hidden="true" size={16} />
          </Button>
          <NumberField
            aria-label={t("Amount in {unit}", { unit: g })}
            value={grams}
            onCommit={(v) => setGrams(v === null ? 0 : Math.min(5000, Math.round(v)))}
            max={5000}
            className="!w-24"
          />
          <span className="text-sm text-text-muted">{g}</span>
          <Button onClick={() => setGrams((x) => Math.min(5000, x + 10))} aria-label={t("10 {unit} more", { unit: g })} className="size-11 !px-0">
            <Plus aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>

      <section aria-label={t("Nutrition for this portion")} className="rounded-card border border-line bg-surface p-3">
        <p className="num text-3xl font-bold leading-none">
          {n.kcal}
          <span className="ml-1 text-sm font-semibold text-text-muted">kcal</span>
        </p>
        <dl className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2">
              <dt className="text-xs font-semibold text-text-muted">{r.label}</dt>
              <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-track">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (r.value / r.max) * 100)}%`, background: r.color }} />
              </span>
              <dd className="num text-right text-sm font-bold">{r.value} g</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby={`calc-${food.id}`} className="rounded-card border border-line bg-surface p-3">
        <h3 id={`calc-${food.id}`} className="text-sm font-semibold">
          {t("How much for…")}
        </h3>
        <div className="mt-2 grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
          <NumberField aria-label={t("Amount of {macro} wanted", { macro: t(calcUnit.label) })} placeholder="40" value={amount} onCommit={setAmount} max={5000} />
          <Select
            aria-label={t("Nutrient")}
            value={calc}
            onChange={(v: Macro) => setCalc(v)}
            options={CALC.map((c) => ({ value: c.macro, label: `${c.unit} ${t(c.label)}` }))}
            className="w-full"
          />
        </div>
        {amount !== null && (
          <p role="status" className="mt-2 text-sm">
            {answer ? (
              <>
                <span className="num font-bold">
                  {answer.grams} {g}
                </span>{" "}
                {t(food.name)}
                <span className="text-text-muted"> ≈ {halves(answer.units)} × {t(answer.unit.label)}</span>
                <Button onClick={() => setGrams(answer.grams)} className="mt-2 w-full">
                  {t("Use this amount")}
                </Button>
              </>
            ) : (
              <span className="text-text-muted">{t("This food has none of that nutrient.")}</span>
            )}
          </p>
        )}
      </section>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm text-text-muted">{t(food.tacticalNote)}</p>
        <p className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          <span className="rounded-ctl bg-surface-2 px-2 py-1">{t("Fullness: {level}", { level: t(LEVEL_LABEL[food.satietyIndex]) })}</span>
          <span className="rounded-ctl bg-surface-2 px-2 py-1">{t("Digests: {speed}", { speed: t(DIGEST_LABEL[food.digestSpeed]) })}</span>
        </p>
        <p className="text-[11px] text-text-muted">{t("Source: {source}", { source: t(SOURCE_LABEL[food.source]) })}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2 border-t border-line pt-3">
        <Select aria-label={t("Meal")} value={meal} onChange={(v: MealSlot) => setMeal(v)} options={MEALS.map((m) => ({ value: m, label: t(SLOT_LABEL[m]) }))} className="w-full" />
        <Button
          variant="primary"
          disabled={grams <= 0}
          onClick={() => {
            useFoodLog.getState().add([entryFor(food, grams, meal)]);
            feedback.setComplete();
            onDone();
          }}
        >
          <Plus aria-hidden="true" size={16} />
          {t("Add to today")}
        </Button>
      </div>
    </div>
  );
}

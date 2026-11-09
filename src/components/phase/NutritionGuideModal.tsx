"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import {
  CATEGORY_LABEL,
  DIGEST_LABEL,
  FOOD_CATEGORIES,
  LEVEL_LABEL,
  foodsFor,
  mealCombos,
  type FoodCategory,
  type MealCombo,
} from "@/lib/nutrition-guide";
import { PHASE_LABEL } from "@/lib/phase-engine";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import type { PhaseTelemetry } from "./usePhaseTelemetry";

/**
 * Foods and drinks for the active phase, with what 100 g holds and a portion by eye, and two
 * meals around training sized from today's target.
 */
export function NutritionGuideModal({ open, onClose, telemetry }: { open: boolean; onClose: () => void; telemetry: PhaseTelemetry }) {
  const t = useT();
  const [category, setCategory] = useState<FoodCategory>("PROTEIN");
  const [pick, setPick] = useState(0);
  const phase = telemetry.phase.phaseType;
  const combos = mealCombos(phase, telemetry.fuel, pick);
  const foods = foodsFor(phase, category);

  return (
    <Sheet open={open} onClose={onClose} title={t("Food guide")}>
      <div className="flex flex-col gap-4 pb-2">
        <section aria-labelledby="combo-heading" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id="combo-heading" className="label-caps">
              {t("Meals around training")} {"//"} {t(PHASE_LABEL[phase])}
            </h3>
            <button
              type="button"
              onClick={() => {
                feedback.tick();
                setPick((p) => p + 1);
              }}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-ctl px-2 text-xs font-semibold text-text-muted hover:bg-ink/[0.05] hover:text-text"
            >
              <RefreshCw aria-hidden="true" size={14} />
              {t("Other foods")}
            </button>
          </div>
          {combos.map((c) => (
            <Combo key={c.when} combo={c} />
          ))}
        </section>

        <section aria-labelledby="foods-heading" className="flex flex-col gap-2">
          <h3 id="foods-heading" className="label-caps">
            {t("Foods and drinks")}
          </h3>
          <div className="-mx-4 overflow-x-auto px-4" role="group" aria-label={t("Food type")}>
            <div className="flex w-max gap-1.5 pb-1">
              {FOOD_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => {
                    if (category !== c) feedback.tick();
                    setCategory(c);
                  }}
                  className={`h-9 shrink-0 rounded-full border px-3.5 text-xs font-semibold ${
                    category === c ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"
                  }`}
                >
                  {t(CATEGORY_LABEL[c])}
                </button>
              ))}
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {foods.map((f) => {
              const m = f.macrosPer100g;
              const suits = f.bestForPhases.includes(phase);
              const per = f.category === "DRINK_HYDRATION" ? "100 ml" : "100 g";
              return (
                <li key={f.id} className="rounded-ctl border border-line bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold">{t(f.name)}</p>
                    {suits && <span className="shrink-0 rounded-full bg-accent-tint px-2 py-0.5 text-[10px] font-bold uppercase text-accent">{t("Suits this phase")}</span>}
                  </div>
                  <p className="num mt-1 text-xs text-text-muted">
                    {t("Per {per}", { per })}: <span className="font-semibold text-text">{m.calories} kcal</span>
                    <span className="block">
                      {t("{p} g protein · {c} g carbs · {f} g fat", { p: m.protein, c: m.carbs, f: m.fat })}
                    </span>
                  </p>
                  <p className="mt-1 text-xs">{t(f.servingVisual)}</p>
                  <p className="mt-1 text-xs text-text-muted">{t(f.tacticalNote)}</p>
                  <p className="mt-1 text-[11px] text-text-muted">
                    {t("Fullness: {level}", { level: t(LEVEL_LABEL[f.satietyIndex]) })} · {t("Digests: {speed}", { speed: t(DIGEST_LABEL[f.digestSpeed]) })}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-text-muted">{t("Typical values from USDA FoodData Central. Brands and cooking change them; check the label when there is one.")}</p>
        </section>
      </div>
    </Sheet>
  );
}

function Combo({ combo }: { combo: MealCombo }) {
  const t = useT();
  return (
    <div className="rounded-ctl border border-line bg-surface-2 p-3">
      <p className="text-sm font-bold">{combo.when === "pre" ? t("Before training (60 to 90 min)") : t("After training (within 2 hours)")}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {combo.items.map((i) => (
          <li key={i.food.id} className="flex justify-between gap-2 text-xs">
            <span>{t(i.food.name)}</span>
            <span className="num shrink-0 font-semibold">
              {i.grams} {i.food.category === "DRINK_HYDRATION" ? "ml" : "g"}
            </span>
          </li>
        ))}
      </ul>
      <p className="num mt-1 text-xs text-text-muted">
        <span className="font-semibold text-text">{combo.kcal} kcal</span>
        <span className="block">{t("{p} g protein · {c} g carbs · {f} g fat", { p: combo.protein, c: combo.carbs, f: combo.fat })}</span>
      </p>
    </div>
  );
}

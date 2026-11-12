"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { Bookmark, Search } from "lucide-react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { Rise } from "@/components/motion/Entrance";
import { usePhaseTelemetry } from "@/components/phase/usePhaseTelemetry";
import { MacroBar } from "@/components/phase/visuals";
import { CATEGORY_ICON } from "@/components/phase/foodIcons";
import { FoodPhoto } from "@/components/fuel/FoodPhoto";
import { FoodDetailSheet } from "@/components/fuel/FoodDetailSheet";
import { TodayLog } from "@/components/fuel/TodayLog";
import { DayPlan } from "@/components/fuel/DayPlan";
import { CATEGORY_LABEL, FOODS, FOOD_CATEGORIES, foodsFor, type Food, type FoodCategory } from "@/lib/nutrition-guide";
import { isMyFood, myFoodAsFood } from "@/lib/my-foods";
import { useSettingsStore } from "@/store/useSettingsStore";
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

type Tab = "today" | "plan" | "foods";

/**
 * Food for the body phase, in three tabs: Today (what was eaten against the day's target),
 * Plan (a day of meals sized to the target, meal prep and its shopping list) and Foods (every
 * food with a photo, its nutrients and a portion calculator). Logging and the food guide work
 * without a phase; the plan needs one, since it is sized to the phase's target.
 */
function FuelScreen() {
  const t = useT();
  const now = useNow(60_000);
  const m = usePhaseTelemetry(now);
  const [tab, setTab] = useState<Tab>("today");
  const tabs: { id: Tab; label: string }[] = [
    { id: "today", label: t("Today") },
    { id: "plan", label: t("Plan") },
    { id: "foods", label: t("Foods") },
  ];
  return (
    <main className="flex flex-1 flex-col gap-4 pb-8">
      <PageHeader
        title={t("Meals and foods")}
        back={{ href: "/phase", label: t("Body phase") }}
        subtitle={
          m ? <span className="num">{t("{kcal} kcal today · {phase}", { kcal: m.fuel.kcal.toLocaleString(t.locale), phase: t(PHASE_LABEL[m.phase.phaseType]) })}</span> : undefined
        }
      />
      <div role="tablist" aria-label={t("Meals and foods")} className="mx-4 grid grid-cols-3 gap-1 rounded-ctl bg-surface-2 p-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => {
              if (tab !== x.id) feedback.tick();
              setTab(x.id);
            }}
            className={`min-h-11 rounded-[10px] text-sm font-semibold ${tab === x.id ? "bg-surface text-text shadow-sm" : "text-text-muted hover:text-text"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={tabs.find((x) => x.id === tab)!.label} className="px-4">
        {tab === "today" && <TodayLog fuel={m?.fuel ?? null} now={now} onAddFood={() => setTab("foods")} phase={m?.phase.phaseType} trainingDay={m?.trainingDay} />}
        {tab === "plan" &&
          (m ? (
            <Rise order={0} className="flex flex-col gap-5">
              <DayPlan phase={m.phase.phaseType} fuel={m.fuel} />
            </Rise>
          ) : (
            <section className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-6 text-center">
              <p className="text-sm text-text-muted">{t("Meal sizes follow your phase's daily target. Choose a phase first.")}</p>
              <Link href="/phase/setup" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-on-accent hover:brightness-110">
                {t("Choose a body phase")}
              </Link>
            </section>
          ))}
        {tab === "foods" && <Foods phase={m?.phase.phaseType ?? null} />}
      </div>
    </main>
  );
}

/** Every food with its photo: search, filter by type, tap for nutrients, portions and the calculator. */
function Foods({ phase }: { phase: import("@/lib/phase-engine").BodyPhaseType | null }) {
  const t = useT();
  const saved = useSettingsStore((s) => s.myFoods);
  const mine = useMemo(() => saved.map(myFoodAsFood), [saved]);
  // Saved foods lead when there are any: they are what this lifter eats.
  const [category, setCategory] = useState<FoodCategory | "MINE">(() => (useSettingsStore.getState().myFoods.length ? "MINE" : "PROTEIN"));
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query).trim().toLowerCase();
  const [open, setOpen] = useState<Food | null>(null);
  const categories: (FoodCategory | "MINE")[] = mine.length ? ["MINE", ...FOOD_CATEGORIES] : FOOD_CATEGORIES;
  const shown = category === "MINE" && !mine.length ? "PROTEIN" : category;
  const foods = q
    ? [...mine, ...FOODS].filter((f) => f.name.toLowerCase().includes(q) || t(f.name).toLowerCase().includes(q))
    : shown === "MINE"
      ? mine
      : phase
        ? foodsFor(phase, shown)
        : FOODS.filter((f) => f.category === shown);
  const label = (c: FoodCategory | "MINE") => (c === "MINE" ? t("My foods") : t(CATEGORY_LABEL[c]));
  return (
    <section aria-labelledby="foods-heading" className="flex flex-col gap-3">
      <h2 id="foods-heading" className="sr-only">
        {t("Foods")}
      </h2>
      <label className="relative block">
        <span className="sr-only">{t("Search foods")}</span>
        <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search: tempe, nasi, pisang…")}
          autoComplete="off"
          className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 pl-9 pr-3 text-base placeholder:text-text-muted"
        />
      </label>
      {!q && (
        <div role="tablist" aria-label={t("Food type")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {categories.map((c) => {
            const Icon = c === "MINE" ? Bookmark : CATEGORY_ICON[c];
            const on = shown === c;
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  if (!on) feedback.tick();
                  setCategory(c);
                }}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-ctl border px-3 text-xs font-semibold ${on ? "border-accent bg-accent text-on-accent" : "border-ink/[0.12] text-text-muted hover:border-ink/25 hover:text-text"}`}
              >
                <Icon aria-hidden="true" size={15} />
                {label(c)}
              </button>
            );
          })}
        </div>
      )}
      {foods.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-center text-sm text-text-muted">{t("No food matches. Use Quick add on the Today tab for anything not listed.")}</p>
      ) : (
        <ul aria-label={q ? t("Search results") : label(shown)} className="grid grid-cols-2 gap-2.5">
          {foods.map((f) => (
            <FoodTile key={f.id} food={f} suits={!!phase && f.bestForPhases.includes(phase)} onOpen={() => setOpen(f)} />
          ))}
        </ul>
      )}
      <FoodDetailSheet food={open} onClose={() => setOpen(null)} />
    </section>
  );
}

function FoodTile({ food: f, suits, onOpen }: { food: Food; suits: boolean; onOpen: () => void }) {
  const t = useT();
  const unit = f.units[0] ?? { label: f.servingVisual, grams: f.servingG };
  const kcal = Math.round((f.macrosPer100g.calories * unit.grams) / 100);
  const m = f.macrosPer100g;
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full flex-col overflow-hidden rounded-card border border-line bg-surface text-left transition-colors hover:border-line-hover">
        <span className="relative block">
          <FoodPhoto id={f.id} size={200} className="aspect-[4/3] !h-auto !w-full" />
          {suits && (
            <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-on-accent">
              {t("Fits your phase")}
            </span>
          )}
        </span>
        <span className="flex flex-col gap-1.5 p-2.5">
          <span className="line-clamp-2 text-sm font-bold leading-tight">{isMyFood(f) ? f.name : t(f.name)}</span>
          <span className="num text-xs text-text-muted">
            <span className="text-base font-bold text-text">{kcal}</span> kcal · {t(unit.label)}
          </span>
          <MacroBar protein={m.protein} carbs={m.carbs} fat={m.fat} className="h-1.5" />
        </span>
      </button>
    </li>
  );
}

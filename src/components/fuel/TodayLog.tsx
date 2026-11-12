"use client";

import { useSettingsStore } from "@/store/useSettingsStore";
import { withMyFood } from "@/lib/my-foods";
import { TargetBreakdown } from "@/components/phase/TargetBreakdown";
import type { BodyPhaseType } from "@/lib/phase-engine";
import { useMemo, useState } from "react";
import { Copy, Plus, Trash2, Zap } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/components/ui/NumberField";
import { MACRO_COLOR, Ring } from "@/components/phase/visuals";
import { FoodPhoto } from "./FoodPhoto";
import { FOODS } from "@/lib/nutrition-guide";
import { SLOT_LABEL, type MealSlot } from "@/lib/meal-templates";
import { dayOf, dayTotals, isWater, mealAt, useFoodLog } from "@/store/useFoodLog";
import type { FuelTarget } from "@/lib/phase-engine";
import type { FoodLogEntry } from "@/types/workout";
import { newId } from "@/lib/id";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

const MEALS: MealSlot[] = ["breakfast", "lunch", "pre", "post", "dinner", "snack"];
const BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));

/**
 * Today's food log: calories and macros against the phase's target (or just the totals with no
 * phase), entries by meal, and the quick ways to add: a food, a quick entry, or yesterday again.
 */
export function TodayLog({
  fuel,
  now,
  onAddFood,
  phase,
  trainingDay = false,
}: {
  fuel: FuelTarget | null;
  now: number;
  onAddFood: () => void;
  /** With a phase, the target can say how it is worked out. */
  phase?: BodyPhaseType;
  trainingDay?: boolean;
}) {
  const t = useT();
  const all = useFoodLog((s) => s.entries);
  const today = dayOf(now);
  const yesterday = dayOf(now - 86_400_000);
  // Water taps live in the log too, but count on the water ring, not as food here.
  const entries = useMemo(() => all.filter((e) => e.day === today && !isWater(e)), [all, today]);
  const hadYesterday = useMemo(() => all.some((e) => e.day === yesterday && !isWater(e)), [all, yesterday]);
  const totals = dayTotals(entries);
  const [quick, setQuick] = useState(false);
  const [editing, setEditing] = useState<FoodLogEntry | null>(null);

  const rings = [
    { key: "kcal", label: t("Calories"), value: totals.kcal, max: fuel?.kcal ?? 0, unit: "kcal", color: "var(--color-accent)" },
    { key: "p", label: t("Protein"), value: totals.protein, max: fuel?.proteinG ?? 0, unit: "g", color: MACRO_COLOR.protein },
    { key: "c", label: t("Carbs"), value: totals.carbs, max: fuel?.carbsG ?? 0, unit: "g", color: MACRO_COLOR.carbs },
    { key: "f", label: t("Fat"), value: totals.fat, max: fuel?.fatG ?? 0, unit: "g", color: "var(--color-text-muted)" },
  ];

  return (
    <section aria-labelledby="today-heading" className="flex flex-col gap-3">
      <h2 id="today-heading" className="sr-only">
        {t("Today")}
      </h2>
      <div className="grid grid-cols-4 gap-1 rounded-card border border-line bg-surface p-3">
        {rings.map((r) => (
          <div key={r.key} className="flex flex-col items-center gap-1 text-center">
            <Ring
              value={r.value}
              max={r.max || 1}
              size={60}
              stroke={6}
              color={r.color}
              label={r.max ? t("{label}: {value} of {max} {unit}", { label: r.label, value: r.value, max: r.max, unit: r.unit }) : `${r.label}: ${r.value} ${r.unit}`}
            >
              <span className="num text-[13px] font-bold leading-none">{r.value}</span>
            </Ring>
            <span className="text-xs font-semibold">{r.label}</span>
            <span className="num text-[11px] leading-tight text-text-muted">{r.max ? t("of {max} {unit}", { max: r.max, unit: r.unit }) : r.unit}</span>
          </div>
        ))}
      </div>
      {fuel && totals.kcal > 0 && (
        <p className="num text-center text-xs text-text-muted">
          {fuel.kcal - totals.kcal >= 0
            ? t("{n} kcal left today", { n: (fuel.kcal - totals.kcal).toLocaleString(t.locale) })
            : t("{n} kcal over today's target", { n: (totals.kcal - fuel.kcal).toLocaleString(t.locale) })}
        </p>
      )}

      {fuel && phase && <TargetBreakdown fuel={fuel} phase={phase} trainingDay={trainingDay} />}
      <div className="grid grid-cols-3 gap-2">
        <Button variant="primary" onClick={onAddFood}>
          <Plus aria-hidden="true" size={16} />
          {t("Food")}
        </Button>
        <Button onClick={() => setQuick(true)}>
          <Zap aria-hidden="true" size={16} />
          {t("Quick add")}
        </Button>
        <Button
          disabled={!hadYesterday}
          onClick={() => {
            const n = useFoodLog.getState().copyDay(yesterday, today, now);
            if (n) feedback.setComplete();
          }}
        >
          <Copy aria-hidden="true" size={16} />
          {t("Yesterday")}
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-card border border-line bg-surface p-5 text-center text-sm text-text-muted">
          {t("Nothing logged today. Add a food, use a day plan, or copy yesterday.")}
        </p>
      ) : (
        MEALS.filter((m) => entries.some((e) => e.meal === m)).map((m) => {
          const rows = entries.filter((e) => e.meal === m);
          const sum = dayTotals(rows);
          return (
            <section key={m} aria-labelledby={`meal-${m}`} className="rounded-card border border-line bg-surface">
              <h3 id={`meal-${m}`} className="flex items-baseline justify-between px-3 pt-3 text-sm font-bold">
                {t(SLOT_LABEL[m])}
                <span className="num text-xs font-semibold text-text-muted">
                  {sum.kcal} kcal · P {sum.protein} g
                </span>
              </h3>
              <ul className="mt-1 flex flex-col">
                {rows.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink/[0.03]"
                    >
                      {e.foodId ? <FoodPhoto id={e.foodId} size={40} className="rounded-xl" /> : <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-surface-2"><Zap size={16} /></span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{e.foodId ? t(e.name) : e.name || t("Quick add")}</span>
                        <span className="num block text-xs text-text-muted">
                          {e.foodId ? `${e.grams} g · ` : ""}P {e.protein} · C {e.carbs} · F {e.fat}
                        </span>
                      </span>
                      <span className="num text-sm font-bold">{e.kcal}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <QuickAddSheet open={quick} onClose={() => setQuick(false)} now={now} />
      <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />
    </section>
  );
}

/** Calories and macros without picking a food: a meal out, a label read off a pack. */
function QuickAddSheet({ open, onClose, now }: { open: boolean; onClose: () => void; now: number }) {
  const t = useT();
  const [name, setName] = useState("");
  const [vals, setVals] = useState<{ kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }>({ kcal: null, protein: null, carbs: null, fat: null });
  const [meal, setMeal] = useState<MealSlot>(() => mealAt(now));
  // A meal eaten often (the warung near work) is typed once and then picked from Foods.
  const [keep, setKeep] = useState(false);
  const kcal = vals.kcal ?? Math.round((vals.protein ?? 0) * 4 + (vals.carbs ?? 0) * 4 + (vals.fat ?? 0) * 9);
  const field = (key: keyof typeof vals, label: string, max: number) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <NumberField value={vals[key]} onCommit={(v) => setVals((x) => ({ ...x, [key]: v }))} max={max} placeholder="0" />
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t("Quick add")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (kcal <= 0) return;
          useFoodLog.getState().add([
            { id: newId(), day: dayOf(now), at: Date.now(), meal, foodId: null, name: name.trim().slice(0, 80), grams: 100, kcal, protein: vals.protein ?? 0, carbs: vals.carbs ?? 0, fat: vals.fat ?? 0 },
          ]);
          if (keep && name.trim()) {
            const s = useSettingsStore.getState();
            s.update({ myFoods: withMyFood(s.myFoods, { name, kcal, protein: vals.protein ?? 0, carbs: vals.carbs ?? 0, fat: vals.fat ?? 0 }) });
          }
          feedback.setComplete();
          setName("");
          setVals({ kcal: null, protein: null, carbs: null, fat: null });
          setKeep(false);
          onClose();
        }}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t("Name (optional)")}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("e.g. Nasi padang")}
            maxLength={80}
            className="h-11 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
          />
        </label>
        <div className="grid grid-cols-4 gap-2">
          {field("kcal", "kcal", 20000)}
          {field("protein", t("Protein g"), 1000)}
          {field("carbs", t("Carbs g"), 2000)}
          {field("fat", t("Fat g"), 1000)}
        </div>
        <p className="text-xs text-text-muted">{t("Leave kcal empty to count it from the macros.")}</p>
        <Select aria-label={t("Meal")} value={meal} onChange={(v: MealSlot) => setMeal(v)} options={MEALS.map((m) => ({ value: m, label: t(SLOT_LABEL[m]) }))} className="w-full" />
        <label className={`flex min-h-11 items-center gap-2 text-sm ${name.trim() ? "" : "text-text-muted"}`}>
          <input type="checkbox" checked={keep && !!name.trim()} disabled={!name.trim()} onChange={(e) => setKeep(e.target.checked)} className="size-5 accent-[var(--color-accent)]" />
          {name.trim() ? t("Save to my foods, to pick it next time") : t("Give it a name to save it to my foods")}
        </label>
        <Button variant="primary" type="submit" disabled={kcal <= 0}>
          {t("Add {kcal} kcal", { kcal })}
        </Button>
      </form>
    </Sheet>
  );
}

/** A logged entry: change the amount or remove it. */
function EditEntrySheet({ entry, onClose }: { entry: FoodLogEntry | null; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={entry !== null} onClose={onClose} title={entry ? (entry.foodId ? t(entry.name) : entry.name || t("Quick add")) : ""}>
      {entry && <EditEntry key={entry.id} entry={entry} onClose={onClose} />}
    </Sheet>
  );
}

function EditEntry({ entry, onClose }: { entry: FoodLogEntry; onClose: () => void }) {
  const t = useT();
  const [grams, setGrams] = useState<number | null>(entry.grams);
  const food = entry.foodId ? BY_ID[entry.foodId] : undefined;
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {food ? t("Amount in {unit}", { unit: food.category === "DRINK_HYDRATION" ? "ml" : "g" }) : t("Portion, % of what was entered")}
        <NumberField value={food ? grams : grams === null ? null : Math.round(grams)} onCommit={setGrams} max={5000} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="danger"
          onClick={() => {
            useFoodLog.getState().remove(entry.id);
            onClose();
          }}
        >
          <Trash2 aria-hidden="true" size={16} />
          {t("Remove")}
        </Button>
        <Button
          variant="primary"
          disabled={!grams || grams <= 0}
          onClick={() => {
            useFoodLog.getState().setGrams(entry.id, grams!, food);
            feedback.tick();
            onClose();
          }}
        >
          {t("Save")}
        </Button>
      </div>
    </div>
  );
}

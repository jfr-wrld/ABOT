"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useLocationStore } from "@/store/useLocationStore";
import { gymSetup, setupPatch } from "@/lib/gym-equipment";
import { useT } from "@/i18n";
import {
  PLATE_SETS,
  calculatePlates,
  plateColor,
  plateShape,
  sleeveStack,
  type PlateLoad,
  type PlateUnit,
} from "@/lib/plate-calculator";
import { feedback } from "@/lib/feedback";

/**
 * Plate calculator: type or step the target, pick the bar, switch off plates the gym lacks, and
 * see each sleeve loaded from the collar out. With a gym on the workout (kg), the bar and plates
 * are that gym's own (Settings > Workout > Gyms) and changes here save to it; otherwise they are
 * remembered on this device.
 */
export function PlateCalculatorModal({
  open,
  onClose,
  unit,
  initialTarget,
  locationId,
  onUse,
  setNumber,
}: {
  open: boolean;
  onClose: () => void;
  unit: PlateUnit;
  /** Starting target in `unit`. */
  initialTarget: number | null;
  locationId?: string;
  /** Puts the loaded weight (in `unit`) into the set; left out when no set is waiting. */
  onUse?: (weight: number) => void;
  /** Number of the set onUse fills, for the button's label. */
  setNumber?: number | null;
}) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("Plate calculator")}>
      {open && <Calculator unit={unit} initialTarget={initialTarget} locationId={locationId} onUse={onUse} setNumber={setNumber} onClose={onClose} />}
    </Sheet>
  );
}

interface Setup {
  bar: number;
  plates: number[];
}

const deviceKey = (unit: PlateUnit) => `abot.plates.${unit}`;

function readDevice(unit: PlateUnit): Setup {
  const fallback = { bar: PLATE_SETS[unit].bars[0].weight, plates: PLATE_SETS[unit].plates };
  try {
    const raw = JSON.parse(localStorage.getItem(deviceKey(unit)) ?? "null") as Partial<Setup> | null;
    if (!raw || typeof raw.bar !== "number" || !Array.isArray(raw.plates)) return fallback;
    return { bar: raw.bar, plates: raw.plates.filter((p): p is number => typeof p === "number" && p > 0) };
  } catch {
    return fallback;
  }
}

function Calculator({
  unit,
  initialTarget,
  locationId,
  onUse,
  setNumber,
  onClose,
}: {
  unit: PlateUnit;
  initialTarget: number | null;
  locationId?: string;
  onUse?: (weight: number) => void;
  setNumber?: number | null;
  onClose: () => void;
}) {
  const t = useT();
  const set = PLATE_SETS[unit];
  // A gym drives the calculator when its equipment is marked in this unit (a 20 kg plate is no
  // whole number of pounds); otherwise this device's own setup is used.
  const gymRow = useLocationStore((s) => (locationId ? s.locations.find((l) => l.id === locationId) : undefined));
  const gymSet = useMemo(() => (gymRow ? gymSetup(gymRow, unit) : null), [gymRow, unit]);
  const gym = gymSet ? gymRow : undefined;
  const updateGym = useLocationStore((s) => s.update);
  const [device, setDevice] = useState<Setup>(() => readDevice(unit));
  const setup: Setup = gymSet ? { bar: gymSet.bar, plates: gymSet.plates } : device;

  const save = (next: Setup) => {
    if (gym) {
      const pairs = next.plates.map((p) => gymSet?.pairs[gymSet.plates.indexOf(p)]);
      updateGym(gym.id, setupPatch({ bar: next.bar, plates: next.plates, pairs }, unit));
      return;
    }
    setDevice(next);
    try {
      localStorage.setItem(deviceKey(unit), JSON.stringify(next));
    } catch {
      // Without storage the choice lasts until the sheet closes.
    }
  };

  const [target, setTarget] = useState<number>(() => Math.max(initialTarget ?? 0, setup.bar) || set.bars[0].weight);
  const load = useMemo(() => calculatePlates(target, setup.bar, setup.plates, gymSet ? setup.plates.map((p) => gymSet.pairs[gymSet.plates.indexOf(p)]) : []), [target, setup.bar, setup.plates, gymSet]);

  // The standard sizes plus any odd ones the gym lists, heaviest first.
  const sizes = [...new Set([...set.plates, ...setup.plates])].sort((a, b) => b - a);
  const bars = set.bars.some((b) => b.weight === setup.bar) ? set.bars : [...set.bars, { weight: setup.bar, label: "Gym bar" }];
  const fmt = (n: number) => `${Number(n.toFixed(2))}`;

  return (
    <div className="flex flex-col gap-5 pb-2">
      {/* Target */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            feedback.tick();
            setTarget((v) => Math.max(0, Number((v - set.step).toFixed(2))));
          }}
          aria-label={t("Lighter by {step} {unit}", { step: set.step, unit })}
          className="flex size-12 shrink-0 items-center justify-center rounded-ctl border border-line-strong bg-surface-2 text-text hover:bg-press active:bg-press-strong"
        >
          <Minus aria-hidden="true" size={18} />
        </button>
        <label className="flex min-w-0 flex-1 flex-col items-center">
          <span className="label-caps">{t("Target")}</span>
          <span className="flex items-baseline gap-1">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={set.step}
              value={Number.isFinite(target) ? target : ""}
              onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
              aria-label={t("Target weight in {unit}", { unit })}
              className="num w-32 bg-transparent text-center text-4xl font-extrabold text-text focus:outline-none"
            />
            <span className="num text-sm text-text-muted">{unit}</span>
          </span>
        </label>
        <button
          type="button"
          onClick={() => {
            feedback.tick();
            setTarget((v) => Number((v + set.step).toFixed(2)));
          }}
          aria-label={t("Heavier by {step} {unit}", { step: set.step, unit })}
          className="flex size-12 shrink-0 items-center justify-center rounded-ctl border border-line-strong bg-surface-2 text-text hover:bg-press active:bg-press-strong"
        >
          <Plus aria-hidden="true" size={18} />
        </button>
      </div>

      {/* Sleeve */}
      <div className="force-dark rounded-card border border-line bg-bg p-3">
        <SleeveVisual load={load} unit={unit} />
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="label-caps">{t("Per side")}</span>
          <span className="num text-sm font-semibold text-text">
            {fmt(load.perSideWeight)} {unit}
          </span>
        </div>
      </div>

      {/* Result */}
      <div role="status" className="flex flex-col gap-2">
        {load.belowBar ? (
          <p className="flex items-start gap-2 text-sm text-warmup">
            <TriangleAlert aria-hidden="true" size={16} className="mt-0.5 shrink-0" />
            {t("Lighter than the bar ({bar} {unit}). Pick a lighter bar or raise the target.", { bar: fmt(setup.bar), unit })}
          </p>
        ) : load.perSide.length === 0 ? (
          <p className="text-sm text-text-muted">{t("Just the bar.")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label={t("Plates on each side")}>
            {load.perSide.map(({ plate, count }) => {
              const c = plateColor(plate, unit);
              return (
                <li key={plate} className="flex items-center gap-3">
                  <span aria-hidden="true" className="size-4 shrink-0 rounded-full" style={{ background: c.fill, boxShadow: `inset 0 0 0 2px ${c.edge ?? "transparent"}` }} />
                  <span className="num flex-1 text-sm text-text">
                    {count} × {fmt(plate)} {unit}
                  </span>
                  <span className="text-xs text-text-muted">{t(c.name)}</span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
          <span className="text-sm text-text-muted">{t("On the bar")}</span>
          <span className="num text-xl font-bold text-text">
            {fmt(load.loaded)} {unit}
          </span>
        </div>
        {load.remainder > 0 && (
          <p className="flex items-start gap-2 text-xs text-warmup">
            <TriangleAlert aria-hidden="true" size={14} className="mt-0.5 shrink-0" />
            {t("{left} {unit} short of the target: these plates cannot make it.", { left: fmt(load.remainder), unit })}
          </p>
        )}
      </div>

      {/* Bar */}
      <fieldset>
        <legend className="label-caps mb-2">{t("Bar")}</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("Bar")}>
          {bars.map((b) => (
            <label
              key={b.weight}
              className={`flex min-h-12 cursor-pointer flex-col justify-center rounded-ctl border px-3 py-1.5 ${
                setup.bar === b.weight ? "border-accent bg-accent-tint" : "border-line-strong bg-surface-2"
              }`}
            >
              <input type="radio" name="plate-bar" checked={setup.bar === b.weight} onChange={() => {
                  feedback.tick();
                  save({ ...setup, bar: b.weight });
                }} className="sr-only" />
              <span className="num text-sm font-semibold text-text">
                {fmt(b.weight)} {unit}
              </span>
              <span className="truncate text-xs text-text-muted">{t(b.label)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Plates */}
      <fieldset>
        <legend className="label-caps mb-1">{t("Plates available")}</legend>
        <p className="mb-2 text-xs text-text-muted">
          {gym ? t("Saved to {gym}.", { gym: gym.name }) : t("Remembered on this phone.")} {t("Switch off what your gym does not have.")}
        </p>
        <div className="flex flex-wrap gap-2">
          {sizes.map((p) => {
            const on = setup.plates.includes(p);
            const c = plateColor(p, unit);
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  feedback.tick();
                  save({ ...setup, plates: on ? setup.plates.filter((x) => x !== p) : [...setup.plates, p] });
                }}
                className={`num flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors ${
                  on ? "border-line-strong bg-surface-2 text-text" : "border-line bg-transparent text-text-muted line-through"
                }`}
              >
                <span aria-hidden="true" className="size-3 rounded-full" style={{ background: c.fill, boxShadow: `inset 0 0 0 1.5px ${c.edge ?? "transparent"}`, opacity: on ? 1 : 0.35 }} />
                {fmt(p)}
              </button>
            );
          })}
        </div>
      </fieldset>

      {onUse && !load.belowBar && (
        <Button
          variant="primary"
          onClick={() => {
            onUse(load.loaded);
            onClose();
          }}
          className="min-h-12 w-full"
        >
          {setNumber
            ? t("Use {weight} {unit} for set {set}", { weight: fmt(load.loaded), unit, set: setNumber })
            : t("Use {weight} {unit}", { weight: fmt(load.loaded), unit })}
        </Button>
      )}
    </div>
  );
}

/** One sleeve from the side: shaft, collar, then the plates from the collar out. */
function SleeveVisual({ load, unit }: { load: PlateLoad; unit: PlateUnit }) {
  const t = useT();
  const plates = sleeveStack(load);
  const W = 320;
  const H = 132;
  const mid = H / 2;
  const sleeveStart = 58;
  const room = W - sleeveStart - 18;
  const total = plates.reduce((s, p) => s + plateShape(p, unit).thickness + 2, 0);
  const scale = total > room ? room / total : 1;
  // Each plate's left edge: the collar side first, 2 units of gap between plates.
  const lefts = plates.reduce<number[]>((acc, p, i) => {
    acc.push(i === 0 ? sleeveStart + 4 : acc[i - 1] + (plateShape(plates[i - 1], unit).thickness + 2) * scale);
    return acc;
  }, []);
  const label =
    plates.length === 0
      ? t("Empty sleeve")
      : t("Sleeve loaded with {plates}", { plates: load.perSide.map((p) => `${p.count} × ${Number(p.plate.toFixed(2))} ${unit}`).join(", ") });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full">
      {/* Shaft (grip side) and collar */}
      <rect x={0} y={mid - 5} width={44} height={10} rx={2} fill="#3f3f46" />
      <rect x={44} y={mid - 22} width={10} height={44} rx={2} fill="#52525b" />
      {/* Sleeve */}
      <rect x={sleeveStart} y={mid - 8} width={W - sleeveStart} height={16} rx={3} fill="#27272a" stroke="#3f3f46" />
      {plates.map((p, i) => {
        const { height, thickness } = plateShape(p, unit);
        const w = thickness * scale;
        const h = height * (H - 8);
        const c = plateColor(p, unit);
        return (
          <rect
            key={i}
            x={lefts[i]}
            y={mid - h / 2}
            width={w}
            height={h}
            rx={Math.min(3, w / 3)}
            fill={c.fill}
            stroke={c.edge ?? "rgb(0 0 0 / 0.35)"}
            strokeWidth={c.edge ? 1.5 : 1}
          />
        );
      })}
      {/* Sleeve end, so the stack reads as sitting on the bar */}
      <rect x={W - 6} y={mid - 9} width={6} height={18} rx={2} fill="#3f3f46" />
    </svg>
  );
}

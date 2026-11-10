"use client";

import { setNumbers } from "@/lib/sets";
import { Select } from "@/components/ui/Select";
import { memo, useEffect, useRef, useState, type ComponentProps } from "react";
import { setGridColumns } from "./setGrid";
import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Info, Link2, Link2Off, MoreHorizontal, Plus, Repeat, Timer, Trash2 } from "lucide-react";
import type {
  Exercise,
  PRKind,
  SessionExercise,
  WeightUnit,
  WorkoutSet,
} from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { EquipmentIcon } from "@/components/icons/EquipmentIcon";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { SetRow } from "./SetRow";
import { Sheet } from "@/components/ui/Sheet";
import { ExerciseHowToSheet } from "./ExerciseHowToSheet";
import { ExercisePicker } from "./ExercisePicker";
import { swapCandidates } from "@/lib/exercise-swapper";
import { useAllExercises } from "@/store/useExerciseStore";
import { ReorderSheet } from "./ReorderSheet";
import { SupersetSheet } from "./SupersetSheet";
import { SUPERSET_COLORS, type SupersetLabel } from "@/lib/superset";
import { Button } from "@/components/ui/Button";
import { formatClock } from "@/lib/calc";
import { useT, type T } from "@/i18n";
import { muscleText } from "@/lib/home";
import { PlateCalculatorModal } from "./PlateCalculatorModal";
import { OverloadBanner } from "./OverloadBanner";
import { BodyweightLoad } from "./BodyweightLoad";
import { ExerciseExtras } from "./ExerciseExtras";
import { ExerciseSwapModal } from "./ExerciseSwapModal";
import { fromDisplay, toDisplay } from "@/lib/units";
import { feedback } from "@/lib/feedback";

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function ExerciseCardView({
  item,
  exercise,
  previous,
  unit,
  showRpe,
  prBySet,
  canMoveUp,
  canMoveDown,
  superset,
  joinedAbove,
  joinedBelow,
}: {
  /** Letter, colour and A1/A2 place when this exercise is in a superset (see lib/superset). */
  superset?: SupersetLabel;
  /** The card above is in the same superset: the bracket runs up through the gap to it. */
  joinedAbove?: boolean;
  /** The card below is in the same superset: the bottom-left corner stays square for the bracket. */
  joinedBelow?: boolean;
  item: SessionExercise;
  exercise: Exercise | undefined;
  previous: WorkoutSet[] | null;
  unit: WeightUnit;
  showRpe: boolean;
  prBySet: Record<string, PRKind[]>;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const t = useT();
  // Actions only, read at call time: a whole-store subscription re-rendered every card on each keystroke.
  const store = useWorkoutStore.getState();
  const { list: library } = useAllExercises();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [howToOpen, setHowToOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [supersetOpen, setSupersetOpen] = useState(false);
  const [platesOpen, setPlatesOpen] = useState(false);
  // A set that turns into a record while you log plays the PR sound once; records already
  // there when the card appears stay quiet. A lift logged for the first time is a baseline,
  // not a record (the summary's rule), so it stays quiet too.
  const hasHistory = (previous?.length ?? 0) > 0;
  const prSets = hasHistory ? Object.keys(prBySet).filter((id) => (prBySet[id] ?? []).length > 0).sort().join(",") : "";
  const seenPrs = useRef<Set<string> | null>(null);
  useEffect(() => {
    const now = new Set(prSets ? prSets.split(",") : []);
    if (seenPrs.current && [...now].some((id) => !seenPrs.current!.has(id))) {
      const t = setTimeout(() => feedback.pr(), 120);
      seenPrs.current = now;
      return () => clearTimeout(t);
    }
    seenPrs.current = now;
  }, [prSets]);
  const ssColor = superset ? SUPERSET_COLORS[superset.color] : undefined;
  const locationId = useWorkoutStore((s) => s.active?.locationId);

  const numbers = setNumbers(item.sets);
  // Plate calculator: barbells only, starting from the next set waiting to be done.
  const loadsPlates = exercise?.equipment === "barbell" || exercise?.equipment === "smith_machine";
  const nextIndex = item.sets.findIndex((x) => !x.completed);
  const nextSet = nextIndex >= 0 ? item.sets[nextIndex] : undefined;
  const plateTarget =
    nextSet?.weightKg ??
    (nextIndex >= 0 ? previous?.[nextIndex]?.weightKg : null) ??
    [...item.sets].reverse().find((x) => x.weightKg !== null)?.weightKg ??
    null;

  const name = exercise?.name ?? t("Unknown exercise");
  const subtitle = exercise
    ? `${exercise.primaryMuscles.map((m) => muscleText(MUSCLE_GROUP_LABELS[m], t)).join(" / ")} · ${t(EQUIPMENT_LABELS[exercise.equipment])}`
    : t("This exercise was removed from the library");

  return (
    <section
      id={`card-${item.id}`}
      aria-labelledby={`ex-${item.id}`}
      // The coloured left edge is information: it marks which cards are done back to back.
      style={ssColor ? { borderLeftColor: ssColor } : undefined}
      className={`relative scroll-mt-[calc(env(safe-area-inset-top)+12px)] rounded-card border border-ink/[0.08] bg-surface px-2 py-3 ${ssColor ? "border-l-[3px]" : ""} ${ssColor && joinedAbove ? "rounded-tl-sm" : ""} ${ssColor && joinedBelow ? "rounded-bl-sm" : ""}`}
    >
      {joinedAbove && ssColor && (
        // Bridges the gap to the card above, so a superset reads as one bracket.
        <span aria-hidden="true" className="absolute -left-[3px] -top-[13px] h-[14px] w-[3px]" style={{ backgroundColor: ssColor }} />
      )}
      <header className="flex items-start justify-between gap-2 px-1">
        {exercise && <ExerciseThumb exercise={exercise} size={44} />}
        <div className="min-w-0 flex-1">
          {superset && (
            <p className="label-caps ss-text !text-[10px]" style={{ "--ss": ssColor } as React.CSSProperties}>
              {superset.size > 2 ? t("Giant set") : t("Superset")} {"//"}{" "}
              <span className="num">{`${superset.letter}${superset.order}`}</span>
            </p>
          )}
          <h2 id={`ex-${item.id}`} className="text-base font-semibold tracking-tight text-zinc-100">
            {exercise ? (
              <button
                type="button"
                onClick={() => setHowToOpen(true)}
                aria-haspopup="dialog"
                className="block max-w-full truncate text-left underline-offset-4 hover:underline"
              >
                {name}
              </button>
            ) : (
              <span className="block truncate">{name}</span>
            )}
          </h2>
          <p className="flex items-center gap-1.5 text-xs text-zinc-400">
            {exercise && <EquipmentIcon equipment={exercise.equipment} size={14} />}
            <span className="truncate">{subtitle}</span>
          </p>
        </div>
        {exercise && (
          <button
            type="button"
            onClick={() => setHowToOpen(true)}
            aria-label={t("How to do {name}", { name })}
            aria-haspopup="dialog"
            className="-mt-1 ml-auto flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <Info aria-hidden="true" size={20} />
          </button>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={t("Options for {name}", { name })}
          aria-haspopup="dialog"
          className="-ml-2 -mr-1 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:bg-surface-2 hover:text-text"
        >
          <MoreHorizontal aria-hidden="true" size={20} />
        </button>
      </header>

      <ExerciseExtras item={item} exercise={exercise} name={name} />
      <OverloadBanner item={item} exercise={exercise} unit={unit} />
      <BodyweightLoad item={item} exercise={exercise} unit={unit} />

      <div className="mt-2 flex items-center gap-1 px-1 text-xs text-text-muted">
        <Timer aria-hidden="true" size={14} />
        <span>
          {t("Rest")} <span className="num">{item.restSeconds === 0 ? t("off") : formatClock(item.restSeconds)}</span>
        </span>
        {loadsPlates && (
          <button
            type="button"
            onClick={() => setPlatesOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("Plate calculator for {name}", { name })}
            className="-mr-1 ml-auto flex min-h-11 items-center gap-1.5 rounded-ctl px-2 font-semibold text-text-muted hover:bg-surface-2 hover:text-text"
          >
            <PlateIcon />
            {t("Plates")}
          </button>
        )}
        {exercise && (
          <button
            type="button"
            onClick={() => setSwapOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("Swap {name} for another exercise", { name })}
            className={`-mr-1 flex min-h-11 items-center gap-1.5 rounded-ctl px-2 font-semibold text-text-muted hover:bg-surface-2 hover:text-text ${loadsPlates ? "" : "ml-auto"}`}
          >
            <ArrowLeftRight aria-hidden="true" size={14} />
            {t("Swap")}
          </button>
        )}
      </div>
      {exercise && swapOpen && <ExerciseSwapModal open={swapOpen} onClose={() => setSwapOpen(false)} item={item} exercise={exercise} unit={unit} />}
      {loadsPlates && (
        <PlateCalculatorModal
          open={platesOpen}
          onClose={() => setPlatesOpen(false)}
          unit={unit}
          locationId={locationId}
          initialTarget={plateTarget === null ? null : toDisplay(plateTarget, unit)}
          onUse={nextSet ? (w) => store.updateSet(item.id, nextSet.id, { weightKg: fromDisplay(w, unit) }) : undefined}
          setNumber={nextIndex >= 0 ? (numbers[nextIndex] ?? null) : null}
        />
      )}

      <div
        className="label-caps mt-3 grid gap-1 px-[5px]"
        style={{ gridTemplateColumns: setGridColumns(showRpe) }}
        aria-hidden="true"
      >
        <span className="text-center">{t("Set")}</span>
        <span className="truncate">{t("Prev")}</span>
        <span className="text-center normal-case">{weightColumnLabel(exercise, unit, t, item.assisted === true)}</span>
        <span className="text-center">{t("Reps")}</span>
        {showRpe && <span className="text-center">RPE</span>}
        <span className="text-center">{t("Done")}</span>
      </div>

      <ol className="mt-1 flex flex-col gap-1" aria-label={t("Sets for {name}", { name })}>
        {item.sets.map((set, i) => (
          <SetRow
            key={set.id}
            set={set}
            number={numbers[i] ?? null}
            previous={previous?.[i]}
            unit={unit}
            showRpe={showRpe}
            isBodyweight={exercise?.isBodyweight ?? false}
            assisted={item.assisted === true}
            prKinds={prBySet[set.id] ?? []}
            onUpdate={(patch) => store.updateSet(item.id, set.id, patch)}
            onSetType={(type) => store.setSetType(item.id, set.id, type)}
            onRemove={() => store.removeSet(item.id, set.id)}
            onComplete={(c) => store.completeSet(item.id, set.id, c)}
          />
        ))}
      </ol>

      <button
        type="button"
        onClick={() => store.addSet(item.id)}
        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/[0.14] text-sm font-semibold text-text-muted transition-colors duration-200 hover:border-ink/30 hover:bg-ink/[0.03] hover:text-text active:bg-ink/[0.06]"
      >
        <Plus aria-hidden="true" size={16} />
        {t("Add set")}
      </button>

      {exercise && (
        <ExerciseHowToSheet exercise={exercise} locationId={locationId} open={howToOpen} onClose={() => setHowToOpen(false)} />
      )}

      {replaceOpen && (
        <ExercisePicker
          open
          title={t("Replace {name}", { name })}
          suggestionsTitle={t("Similar to {name}", { name })}
          suggestions={
            exercise
              ? swapCandidates(exercise, library, "all", 5).map((c) => ({
                  exercise: c.exercise,
                  note:
                    c.reason.kind === "pattern"
                      ? t("Same movement · {n}% match", { n: c.match })
                      : c.reason.kind === "muscle" && c.reason.muscle
                        ? t("Same muscle: {muscle} · {n}% match", { muscle: muscleText(MUSCLE_GROUP_LABELS[c.reason.muscle], t), n: c.match })
                        : t("Related · {n}% match", { n: c.match }),
                }))
              : []
          }
          onClose={() => setReplaceOpen(false)}
          onPick={(ex) => {
            store.replaceExercise(item.id, ex.id);
            setReplaceOpen(false);
          }}
        />
      )}
      {reorderOpen && <ReorderSheet onClose={() => setReorderOpen(false)} />}
      {supersetOpen && <SupersetSheet item={item} name={name} onClose={() => setSupersetOpen(false)} />}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={name}>
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor={`rest-${item.id}`} className="mb-1 block text-sm font-semibold">
              {t("Rest timer after each set")}
            </label>
            <Select
              id={`rest-${item.id}`}
              value={item.restSeconds}
              onChange={(s) => store.setExerciseRest(item.id, s)}
              options={REST_OPTIONS.map((s) => ({ value: s, label: s === 0 ? t("Off") : formatClock(s) }))}
              className="w-full !text-base"
            />
          </div>

          <div>
            <label htmlFor={`notes-${item.id}`} className="mb-1 block text-sm font-semibold">
              {t("Notes for this exercise")}
            </label>
            <textarea
              id={`notes-${item.id}`}
              value={item.notes ?? ""}
              onChange={(e) => store.setExerciseNotes(item.id, e.target.value)}
              rows={2}
              placeholder={t("Seat height, grip, cues")}
              className="w-full rounded-ctl border border-line-strong bg-surface-2 px-3 py-2 text-base placeholder:text-text-muted"
            />
          </div>

          {/* The two moves lifters reach for mid-workout, ahead of the finer controls. */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setMenuOpen(false);
                setReplaceOpen(true);
              }}
            >
              <Repeat aria-hidden="true" size={18} /> {t("Replace exercise")}
            </Button>
            <Button
              onClick={() => {
                setMenuOpen(false);
                setReorderOpen(true);
              }}
            >
              <ArrowUpDown aria-hidden="true" size={18} /> {t("Reorder exercises")}
            </Button>
          </div>
          {item.supersetId ? (
            <Button
              onClick={() => {
                store.unlinkSuperset(item.id);
                setMenuOpen(false);
              }}
            >
              <Link2Off aria-hidden="true" size={18} /> {t("Remove from superset")}
            </Button>
          ) : (
            <Button
              onClick={() => {
                setMenuOpen(false);
                setSupersetOpen(true);
              }}
            >
              <Link2 aria-hidden="true" size={18} /> {t("Add to superset")}
            </Button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={!canMoveUp}
              onClick={() => {
                store.moveExercise(item.id, -1);
                setMenuOpen(false);
              }}
            >
              <ArrowUp aria-hidden="true" size={18} /> {t("Move up")}
            </Button>
            <Button
              disabled={!canMoveDown}
              onClick={() => {
                store.moveExercise(item.id, 1);
                setMenuOpen(false);
              }}
            >
              <ArrowDown aria-hidden="true" size={18} /> {t("Move down")}
            </Button>
          </div>

          {confirmRemove ? (
            <div className="rounded-ctl border border-failure/60 p-3">
              <p className="text-sm">{t("Remove {name} and its {n} sets from this workout?", { name, n: item.sets.length })}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => setConfirmRemove(false)}>{t("Keep it")}</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    store.removeExercise(item.id);
                    setMenuOpen(false);
                  }}
                >
                  {t("Remove")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirmRemove(true)}>
              <Trash2 aria-hidden="true" size={18} /> {t("Remove exercise")}
            </Button>
          )}
        </div>
      </Sheet>
    </section>
  );
}

/** Says what the number means: per dumbbell, per side, or load added to (or taken off) bodyweight. */
function weightColumnLabel(exercise: Exercise | undefined, unit: WeightUnit, t: T, assisted: boolean): string {
  if (exercise?.isBodyweight) return `${assisted ? "−" : "+"}${unit}`;
  if (exercise?.loadMode === "per_hand") return t("{unit}/hand", { unit });
  if (exercise?.loadMode === "unilateral") return t("{unit}/side", { unit });
  return unit;
}

/** A weight plate seen face on: the calculator's icon. */
function PlateIcon() {
  return (
    <svg aria-hidden="true" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3v2.5M12 18.5V21" strokeLinecap="round" />
    </svg>
  );
}

type CardProps = ComponentProps<typeof ExerciseCardView>;

/** Re-renders only when this card's own props change. Superset labels and the record map are
 *  rebuilt on every render of the list, so they are compared by value. */
function sameCard(a: CardProps, b: CardProps): boolean {
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const k of Object.keys(a) as (keyof CardProps)[]) {
    if (k === "superset" || k === "prBySet") continue;
    if (a[k] !== b[k]) return false;
  }
  const pa = a.prBySet;
  const pb = b.prBySet;
  const ka = Object.keys(pa);
  if (ka.length !== Object.keys(pb).length || ka.some((id) => (pa[id] ?? []).join() !== (pb[id] ?? []).join())) return false;
  const x = a.superset;
  const y = b.superset;
  return x === y || (!!x && !!y && x.letter === y.letter && x.color === y.color && x.order === y.order && x.size === y.size);
}

export const ExerciseCard = memo(ExerciseCardView, sameCard);

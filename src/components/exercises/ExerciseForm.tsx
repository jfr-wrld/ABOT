"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { Equipment, Exercise, ExerciseDraft, LoadMode, MuscleGroup } from "@/types/workout";
import { defaultLoadMode } from "@/data/normalize";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";
import { muscleLabel } from "@/components/exercise/MuscleTags";

const MUSCLES = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export function ExerciseForm({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Exercise;
  onClose: () => void;
  onSave: (data: ExerciseDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [primary, setPrimary] = useState<MuscleGroup>(initial?.primaryMuscles[0] ?? "chest");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  // Load and machine dependence follow the equipment until the user picks them explicitly.
  const [loadChoice, setLoadChoice] = useState<LoadMode | null>(initial?.loadMode ?? null);
  const [machineChoice, setMachineChoice] = useState<boolean | null>(initial?.isMachineDependent ?? null);
  const loadMode = loadChoice ?? defaultLoadMode(equipment, name);
  const machineDependent = machineChoice ?? (equipment === "machine" || equipment === "cable");

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t("Enter a name of at least two characters"));
      return;
    }
    onSave({
      name: trimmed,
      // One primary from the form; extra primaries from the seed or a file are kept on edit.
      primaryMuscles: [primary, ...(initial?.primaryMuscles.slice(1).filter((m) => m !== primary) ?? [])],
      secondaryMuscles: initial?.secondaryMuscles ?? [],
      equipment,
      isBodyweight: equipment === "bodyweight",
      loadMode,
      isMachineDependent: machineDependent,
    });
  }

  const field = "h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? t("Edit exercise") : t("New exercise")}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={submit}>
            {initial ? t("Save changes") : t("Add to library")}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="ex-name" className="mb-1 block text-sm font-semibold">
            {t("Name")}
          </label>
          <input
            id="ex-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="Pendlay Row"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "ex-name-error" : undefined}
            className={`${field} placeholder:text-text-muted/70`}
          />
          {error && (
            <p id="ex-name-error" role="alert" className="mt-1 text-xs text-failure">
              {error}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="ex-muscle" className="mb-1 block text-sm font-semibold">
            {t("Primary muscle")}
          </label>
          <Select
            id="ex-muscle"
            value={primary}
            onChange={setPrimary}
            options={MUSCLES.map((m) => ({ value: m, label: muscleLabel(m, t) }))}
            className="w-full !text-base"
          />
        </div>
        <div>
          <label htmlFor="ex-equipment" className="mb-1 block text-sm font-semibold">
            {t("Equipment")}
          </label>
          <Select
            id="ex-equipment"
            value={equipment}
            onChange={setEquipment}
            options={EQUIPMENT.map((eq) => ({ value: eq, label: t(EQUIPMENT_LABELS[eq]) }))}
            className="w-full !text-base"
          />
          <p className="mt-1 text-xs text-text-muted">{t("For bodyweight exercises the weight column is optional added load.")}</p>
        </div>
        <div>
          <label htmlFor="ex-load" className="mb-1 block text-sm font-semibold">
            {t("Load")}
          </label>
          <Select
            id="ex-load"
            value={loadMode}
            onChange={(v: LoadMode) => setLoadChoice(v)}
            options={[
              { value: "total", label: t("Total (one bar or stack)") },
              { value: "per_hand", label: t("Per hand (volume counts both)") },
              { value: "unilateral", label: t("One side at a time (volume counts both sides)") },
            ]}
            className="w-full !text-base"
          />
        </div>
        <label htmlFor="ex-machine" className="flex min-h-11 items-center gap-3 text-sm">
          <input
            id="ex-machine"
            type="checkbox"
            checked={machineDependent}
            onChange={(e) => setMachineChoice(e.target.checked)}
            className="size-5 accent-[var(--color-accent)]"
          />
          {t("Weight depends on the gym's machine (keep records per gym)")}
        </label>
        <button type="submit" className="sr-only">
          {t("Save")}
        </button>
      </form>
    </Sheet>
  );
}

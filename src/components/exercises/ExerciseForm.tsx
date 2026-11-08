"use client";

import { useState } from "react";
import type { Equipment, Exercise, ExerciseDraft, MuscleGroup } from "@/types/workout";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

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
  const [primary, setPrimary] = useState<MuscleGroup>(initial?.primaryMuscle ?? "chest");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter a name of at least two characters");
      return;
    }
    onSave({
      name: trimmed,
      primaryMuscle: primary,
      secondaryMuscles: [],
      equipment,
      isBodyweight: equipment === "bodyweight",
    });
  }

  const field = "h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? "Edit exercise" : "New exercise"}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit}>
            {initial ? "Save changes" : "Add to library"}
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
            Name
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
            Primary muscle
          </label>
          <select id="ex-muscle" value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)} className={field}>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ex-equipment" className="mb-1 block text-sm font-semibold">
            Equipment
          </label>
          <select
            id="ex-equipment"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
            className={field}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT_LABELS[eq]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-text-muted">Bodyweight exercises log reps only, no weight column.</p>
        </div>
        <button type="submit" className="sr-only">
          Save
        </button>
      </form>
    </Sheet>
  );
}

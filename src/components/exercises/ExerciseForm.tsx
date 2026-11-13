"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { Equipment, Exercise, ExerciseDraft, LoadMode, LogType, MuscleGroup } from "@/types/workout";
import { defaultLoadMode } from "@/data/normalize";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n";
import { muscleLabel } from "@/components/exercise/MuscleTags";
import { usePhotoPicker } from "@/components/profile/usePhotoPicker";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { EXERCISE_PHOTO_TARGET } from "@/lib/photo";
import { isOwnPhoto, ownPhotos } from "@/lib/exercise-photo";
import { Camera, X } from "lucide-react";

const MUSCLES = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];

export function ExerciseForm({
  open,
  initial,
  initialName,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Exercise;
  /** A new exercise's name, prefilled from what was searched. */
  initialName?: string;
  onClose: () => void;
  onSave: (data: ExerciseDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? initialName ?? "");
  const [primary, setPrimary] = useState<MuscleGroup>(initial?.primaryMuscles[0] ?? "chest");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  // Load and machine dependence follow the equipment until the user picks them explicitly.
  const [loadChoice, setLoadChoice] = useState<LoadMode | null>(initial?.loadMode ?? null);
  const [machineChoice, setMachineChoice] = useState<boolean | null>(initial?.isMachineDependent ?? null);
  const loadMode = loadChoice ?? defaultLoadMode(equipment, name);
  // Like the load: follows the equipment until picked.
  const [logChoice, setLogChoice] = useState<LogType | null>(initial?.logType ?? null);
  const logType = logChoice ?? (equipment === "bodyweight" ? "reps_only" : "weight_reps");
  const machineDependent = machineChoice ?? (equipment === "machine" || equipment === "cable");
  // The lifter's own start and end photos; without them the exercise shows its muscle map.
  const [photos, setPhotos] = useState<(string | null)[]>(() => {
    const own = initial ? ownPhotos(initial) : [];
    return [own[0] ?? null, own[1] ?? null];
  });

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
      logType,
      isMachineDependent: machineDependent,
      media: withPhotos(initial?.media ?? {}, photos.filter((p): p is string => !!p)),
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
            className={`${field} placeholder:text-text-muted`}
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
        <div>
          <label htmlFor="ex-log" className="mb-1 block text-sm font-semibold">
            {t("Log as")}
          </label>
          <Select
            id="ex-log"
            value={logType}
            onChange={(v: LogType) => setLogChoice(v)}
            options={[
              { value: "weight_reps", label: t("Weight and reps") },
              { value: "reps_only", label: t("Reps only") },
              { value: "duration", label: t("Time (plank, hold)") },
              { value: "distance_duration", label: t("Distance and time (run, row, bike)") },
            ]}
            className="w-full !text-base"
          />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">{t("Photos")}</legend>
          <p className="mb-2 text-xs text-text-muted">{t("The start and the end of one rep. They show in the list and play on the exercise page.")}</p>
          <div className="grid grid-cols-2 gap-2">
            <PhotoSlot label={t("Start position")} url={photos[0] ?? null} muscle={primary} onChange={(u) => setPhotos([u, photos[1] ?? null])} />
            <PhotoSlot label={t("End position")} url={photos[1] ?? null} muscle={primary} onChange={(u) => setPhotos([photos[0] ?? null, u])} />
          </div>
        </fieldset>
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

/** The exercise's media with the lifter's own photos (start first) in place of any old ones. */
function withPhotos(media: Exercise["media"], own: string[]): Exercise["media"] {
  const others = (media.motionUrls ?? []).filter((u) => !isOwnPhoto(u));
  const motionUrls = own.length ? own : others;
  const { motionUrls: _old, ...rest } = media;
  void _old;
  return motionUrls.length ? { ...rest, motionUrls } : rest;
}

/** One photo slot: add (fitted to 4:3 in the crop sheet), see, or remove. */
function PhotoSlot({ label, url, muscle, onChange }: { label: string; url: string | null; muscle: MuscleGroup; onChange: (url: string | null) => void }) {
  const t = useT();
  const picker = usePhotoPicker((u) => onChange(u), { title: label, facing: "environment", crop: { shape: "rect", target: EXERCISE_PHOTO_TARGET } });
  return (
    <div className="flex flex-col gap-1">
      {picker.input}
      <div className="relative">
        <button
          type="button"
          onClick={picker.open}
          disabled={picker.busy}
          aria-label={url ? t("Change {photo}", { photo: label }) : t("Add {photo}", { photo: label })}
          className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-ctl border border-dashed border-line-strong bg-surface-2 hover:border-line-hover"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL made on the device
            <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-text-muted">
              <MuscleIcon muscle={muscle} size={36} />
              <span className="flex items-center gap-1 text-xs font-semibold">
                <Camera aria-hidden="true" size={14} />
                {t("Add")}
              </span>
            </span>
          )}
        </button>
        {url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("Remove {photo}", { photo: label })}
            className="absolute right-0 top-0 flex size-11 items-center justify-center"
          >
            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
              <X size={14} />
            </span>
          </button>
        )}
      </div>
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      {picker.error && (
        <p role="alert" className="text-xs text-failure">
          {t(picker.error)}
        </p>
      )}
    </div>
  );
}

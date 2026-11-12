"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useAllExercises, useExerciseStore } from "@/store/useExerciseStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useLocationStore } from "@/store/useLocationStore";
import { ROUTINE_TEMPLATES, SPLITS, templateToRoutine } from "@/lib/seed-routines";
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS, type Equipment, type Exercise, type MuscleGroup } from "@/types/workout";
import { Note, Panel, cls } from "./ui";

const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const MUSCLES = (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).filter((m) => m !== "cardio");

/** seed: the core list; library: the built-in free-exercise-db and Atlas rows; custom: the lifter's own. */
const source = (e: Exercise) => (e.isCustom ? "custom" : e.isCatalog ? "library" : "seed");

/* --------------------------------------------------------------- exercises */

export function ExercisesModule() {
  const { list } = useAllExercises();
  const custom = useExerciseStore((s) => s.custom);
  const { addCustom, updateCustom, removeCustom } = useExerciseStore.getState();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "seed" | "custom" | "library">("all");
  const [editing, setEditing] = useState<Exercise | "new" | null>(null);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((e) => (filter === "all" || source(e) === filter) && (!needle || e.name.toLowerCase().includes(needle)));
  }, [list, q, filter]);
  const counts = { seed: list.filter((e) => source(e) === "seed").length, custom: custom.length, library: list.filter((e) => source(e) === "library").length };

  return (
    <>
      <Panel
        id="x-lib"
        title={`Exercise library (${list.length})`}
        scope="device"
        wide
        actions={
          <button type="button" onClick={() => setEditing("new")} className={cls.volt}>
            <Plus aria-hidden="true" size={14} /> New
          </button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search exercises" className={cls.input} />
          <div role="radiogroup" aria-label="Source" className="grid grid-cols-4 gap-1">
            {(["all", "seed", "custom", "library"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={filter === f}
                onClick={() => setFilter(f)}
                className={`min-h-11 rounded-ctl border px-2 font-mono text-[10px] font-bold uppercase tabular-nums ${filter === f ? "border-[#00f0ff] text-[#00f0ff]" : "border-[#27272a] text-zinc-400"}`}
              >
                {f}
                {f !== "all" && <span className="block">{counts[f]}</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="-mx-4 max-h-[420px] overflow-auto px-4">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">Exercises</caption>
            <thead className={`${cls.label} sticky top-0 bg-[#121215]`}>
              <tr>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Primary</th>
                <th className="py-2 pr-2">Equipment</th>
                <th className="py-2 pr-2">Load</th>
                <th className="py-2 text-right">Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((e) => (
                <tr key={e.id} className="border-t border-[#27272a]">
                  <td className="py-1.5 pr-2">
                    {e.isCustom ? (
                      <button type="button" onClick={() => setEditing(e)} className="min-h-9 text-left text-white underline-offset-4 hover:underline">
                        {e.name}
                      </button>
                    ) : (
                      <span className="text-zinc-200">{e.name}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-zinc-400">{e.primaryMuscles.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ")}</td>
                  <td className="py-1.5 pr-2 text-zinc-400">{EQUIPMENT_LABELS[e.equipment]}</td>
                  <td className="py-1.5 pr-2 font-mono text-zinc-400">{e.loadMode}</td>
                  <td className={`py-1.5 text-right font-mono uppercase ${source(e) === "custom" ? "text-[#00f0ff]" : "text-zinc-400"}`}>{source(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 300 && <Note>Showing 300 of {rows.length}. Narrow the search.</Note>}
          {note && <Note tone={note.error ? undefined : "ok"}>{note.text}</Note>}
        </div>
      </Panel>

      {editing && (
        <ExerciseEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(draft, id) => {
            if (id) updateCustom(id, draft);
            else addCustom(draft);
            setEditing(null);
            setNote({ text: id ? "Exercise updated." : "Exercise added." });
          }}
          onDelete={(id) => {
            removeCustom(id);
            setEditing(null);
            setNote({ text: "Exercise removed. Past workouts keep its sets under its old id." });
          }}
        />
      )}
    </>
  );
}

function ExerciseEditor({
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  initial: Exercise | null;
  onClose: () => void;
  onSave: (draft: { name: string; primaryMuscles: MuscleGroup[]; secondaryMuscles: MuscleGroup[]; equipment: Equipment; isBodyweight: boolean }, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [equipment, setEquipment] = useState<Equipment>(initial?.equipment ?? "barbell");
  const [primary, setPrimary] = useState<MuscleGroup>(initial?.primaryMuscles[0] ?? "chest");
  const [secondary, setSecondary] = useState<MuscleGroup[]>(initial?.secondaryMuscles ?? []);
  const [bodyweight, setBodyweight] = useState(initial?.isBodyweight ?? false);
  const [confirm, setConfirm] = useState("");
  return (
    <Panel id="x-edit" title={initial ? `Edit ${initial.name}` : "New custom exercise"} scope="device" wide actions={<button type="button" onClick={onClose} className={cls.ghost}>Close</button>}>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSave({ name: name.trim(), primaryMuscles: [primary], secondaryMuscles: secondary.filter((m) => m !== primary), equipment, isBodyweight: bodyweight }, initial?.id);
        }}
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} className={cls.input} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Equipment
          <select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)} className={cls.input}>
            {EQUIPMENT.map((q) => (
              <option key={q} value={q}>
                {EQUIPMENT_LABELS[q]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Primary muscle
          <select value={primary} onChange={(e) => setPrimary(e.target.value as MuscleGroup)} className={cls.input}>
            {MUSCLES.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="sm:col-span-2">
          <legend className={`${cls.label} mb-2`}>Secondary muscles</legend>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLES.filter((m) => m !== primary).map((m) => {
              const on = secondary.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSecondary((s) => (on ? s.filter((x) => x !== m) : [...s, m]))}
                  className={`min-h-9 rounded-full border px-3 text-xs ${on ? "border-[#00f0ff] text-[#00f0ff]" : "border-[#27272a] text-zinc-400"}`}
                >
                  {MUSCLE_GROUP_LABELS[m]}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300 sm:col-span-2">
          Bodyweight (weight is added load)
          <input type="checkbox" checked={bodyweight} onChange={(e) => setBodyweight(e.target.checked)} className="size-6 accent-[#00f0ff]" />
        </label>
        <button type="submit" className={`${cls.volt} sm:col-span-2`}>
          {initial ? "Save exercise" : "Add exercise"}
        </button>
      </form>
      {initial && (
        <div className="flex flex-col gap-2 border-t border-[#27272a] pt-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Type DELETE to remove {initial.name}
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cls.input} />
          </label>
          <button type="button" disabled={confirm !== "DELETE"} onClick={() => onDelete(initial.id)} className={cls.danger}>
            <Trash2 aria-hidden="true" size={14} /> Remove exercise
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------- routines and gyms */

export function RoutinesModule() {
  const routines = useRoutineStore((s) => s.routines);
  const { update, remove, duplicate, create, setExercises } = useRoutineStore.getState();
  const [note, setNote] = useState<string | null>(null);
  const names = new Set(routines.map((r) => r.name));

  return (
    <>
      <Panel id="r-list" title={`Routines (${routines.length})`} scope="device" wide>
        {routines.length === 0 && <Note>No routines on this device.</Note>}
        <ul className="flex flex-col gap-2">
          {routines.map((r) => (
            <li key={r.id} className="grid items-center gap-2 rounded-ctl border border-[#27272a] bg-[#09090b] p-2 sm:grid-cols-[1fr_1fr_auto]">
              <input aria-label={`Name of ${r.name}`} defaultValue={r.name} onBlur={(e) => e.target.value.trim() && update(r.id, { name: e.target.value.trim() })} className={cls.input} />
              <input aria-label={`Folder of ${r.name}`} defaultValue={r.folder ?? ""} placeholder="Folder" onBlur={(e) => update(r.id, { folder: e.target.value.trim() || undefined })} className={cls.input} />
              <span className="flex items-center gap-1">
                <span className="w-16 text-right font-mono text-[11px] tabular-nums text-zinc-400">{r.exercises.length} ex</span>
                <button type="button" onClick={() => duplicate(r.id)} className={cls.ghost}>
                  Copy
                </button>
                <button type="button" aria-label={`Delete ${r.name}`} onClick={() => remove(r.id)} className={`${cls.ghost} text-[#ef4444]`}>
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel id="r-tpl" title={`Built-in templates (${ROUTINE_TEMPLATES.length})`} scope="device">
        <ul className="flex max-h-[420px] flex-col gap-1 overflow-auto">
          {ROUTINE_TEMPLATES.map((tpl) => (
            <li key={tpl.id} className="flex items-center justify-between gap-2 border-t border-[#27272a] py-1.5 text-xs">
              <span className="min-w-0">
                <span className="block truncate text-zinc-200">{tpl.name}</span>
                <span className="font-mono text-[10px] uppercase text-zinc-400">{SPLITS.find((s) => s.value === tpl.split)?.label}</span>
              </span>
              <button
                type="button"
                disabled={names.has(tpl.name)}
                onClick={() => {
                  const copy = templateToRoutine(tpl);
                  const r = create(copy.name, copy.folder);
                  setExercises(r.id, copy.exercises);
                  setNote(`${tpl.name} added to the library.`);
                }}
                className={`${cls.ghost} shrink-0`}
              >
                {names.has(tpl.name) ? "In library" : "Add"}
              </button>
            </li>
          ))}
        </ul>
        {note && <Note tone="ok">{note}</Note>}
      </Panel>

      <GymsPanel />
    </>
  );
}

function GymsPanel() {
  const gyms = useLocationStore((s) => s.locations);
  const { add, update, remove, setDefault } = useLocationStore.getState();
  const [name, setName] = useState("");
  return (
    <Panel id="r-gyms" title="Gyms, bars and plate inventory" scope="device">
      <ul className="flex flex-col gap-3">
        {gyms.map((g) => (
          <li key={g.id} className="flex flex-col gap-2 rounded-ctl border border-[#27272a] bg-[#09090b] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-white">
                {g.name} {g.isDefault && <span className="font-mono text-[10px] uppercase text-[#00f0ff]">default</span>}
              </span>
              <span className="flex gap-1">
                {!g.isDefault && (
                  <button type="button" onClick={() => setDefault(g.id)} className={cls.ghost}>
                    Default
                  </button>
                )}
                <button type="button" aria-label={`Delete ${g.name}`} onClick={() => remove(g.id)} className={`${cls.ghost} text-[#ef4444]`}>
                  <Trash2 aria-hidden="true" size={14} />
                </button>
              </span>
            </div>
            <div className="grid grid-cols-[96px_1fr] gap-2">
              <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                Bar kg
                <input
                  inputMode="decimal"
                  defaultValue={String(g.barWeightKg)}
                  onBlur={(e) => Number(e.target.value) >= 0 && update(g.id, { barWeightKg: Number(e.target.value) })}
                  className={cls.input}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-zinc-400">
                Plates kg (comma separated)
                <input
                  defaultValue={g.plateInventoryKg.join(", ")}
                  onBlur={(e) =>
                    update(g.id, {
                      plateInventoryKg: e.target.value
                        .split(/[,\s]+/)
                        .map(Number)
                        .filter((n) => Number.isFinite(n) && n > 0)
                        .sort((a, b) => b - a),
                    })
                  }
                  className={cls.input}
                />
              </label>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add(name.trim());
          setName("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New gym name" aria-label="New gym name" className={cls.input} />
        <button type="submit" className={cls.volt}>
          Add
        </button>
      </form>
    </Panel>
  );
}

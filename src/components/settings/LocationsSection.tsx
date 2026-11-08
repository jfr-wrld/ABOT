"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLocationStore } from "@/store/useLocationStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { GymLocation } from "@/types/workout";
import { InfoTip } from "@/components/ui/InfoTip";

const BARS = [20, 15, 10, 7];

/** "25, 20, 10, 2.5" -> [25, 20, 10, 2.5]; null when any entry is not a positive number. */
export function parsePlates(text: string): number[] | null {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return [...nums].sort((a, b) => b - a);
}

export function LocationsSection() {
  const { locations, add, setDefault } = useLocationStore();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <section aria-labelledby="gyms-heading" className="flex flex-col gap-3">
      <InfoTip
        title={
          <h2 id="gyms-heading" className="text-sm font-semibold">
            Gyms
          </h2>
        }
        name="gyms"
      >
        Machine and cable weights differ between gyms, so their records and previous sets are kept per gym.
      </InfoTip>

      {locations.length === 0 ? (
        <p className="text-sm text-text-muted">No gyms yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {locations.map((l) => (
            <GymRow key={l.id} gym={l} onMakeDefault={() => setDefault(l.id)} />
          ))}
        </ul>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return setError("Enter a gym name");
          add(n);
          setName("");
          setError(null);
        }}
        className="flex gap-2"
      >
        <label htmlFor="new-gym" className="sr-only">
          New gym name
        </label>
        <input
          id="new-gym"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="Gym name"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-gym-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
        />
        <Button type="submit">Add gym</Button>
      </form>
      {error && (
        <p id="new-gym-error" role="alert" className="text-xs text-failure">
          {error}
        </p>
      )}
    </section>
  );
}

function GymRow({ gym, onMakeDefault }: { gym: GymLocation; onMakeDefault: () => void }) {
  const { update, remove } = useLocationStore();
  const [plates, setPlates] = useState(gym.plateInventoryKg.join(", "));
  const [platesError, setPlatesError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const base = `gym-${gym.id}`;

  return (
    <li className="rounded-ctl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{gym.name}</h3>
        {gym.isDefault ? (
          <span className="text-xs font-semibold text-accent">Default</span>
        ) : (
          <Button variant="ghost" onClick={onMakeDefault} className="min-h-9 px-2 text-xs">
            Make default
          </Button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor={`${base}-name`} className="text-xs text-text-muted">
          Name
        </label>
        <input
          id={`${base}-name`}
          value={gym.name}
          onChange={(e) => update(gym.id, { name: e.target.value })}
          className="h-11 min-w-0 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
        />
        <label htmlFor={`${base}-bar`} className="text-xs text-text-muted">
          Bar
        </label>
        <Select
          id={`${base}-bar`}
          value={gym.barWeightKg}
          onChange={(barWeightKg) => update(gym.id, { barWeightKg })}
          options={BARS.map((b) => ({ value: b, label: `${b} kg` }))}
        />
        <label htmlFor={`${base}-plates`} className="text-xs text-text-muted">
          Plates (kg)
        </label>
        <input
          id={`${base}-plates`}
          value={plates}
          inputMode="decimal"
          onChange={(e) => {
            setPlates(e.target.value);
            const parsed = parsePlates(e.target.value);
            if (parsed) {
              setPlatesError(null);
              update(gym.id, { plateInventoryKg: parsed });
            } else setPlatesError("List positive numbers separated by commas, like 25, 20, 10, 5");
          }}
          aria-invalid={platesError ? true : undefined}
          aria-describedby={platesError ? `${base}-plates-error` : undefined}
          className="h-11 min-w-0 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
        />
      </div>
      {platesError && (
        <p id={`${base}-plates-error`} role="alert" className="mt-1 text-xs text-failure">
          {platesError}
        </p>
      )}
      <Button variant="danger" onClick={() => setConfirm(true)} className="mt-3 w-full">
        Delete {gym.name}
      </Button>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${gym.name}?`}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirm(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => remove(gym.id)}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Workouts logged here keep their sets. Their machine records stay separate from your other gyms.
        </p>
      </Sheet>
    </li>
  );
}

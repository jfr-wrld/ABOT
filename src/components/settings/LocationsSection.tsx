"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLocationStore } from "@/store/useLocationStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { GymLocation } from "@/types/workout";
import { InfoTip } from "@/components/ui/InfoTip";
import { MapPin } from "lucide-react";
import { currentPosition, openAppSettings, requestAccess } from "@/lib/native/permissions";
import { isNativeApp } from "@/lib/native/files";
import { useT } from "@/i18n";

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
  const t = useT();

  return (
    <section aria-labelledby="gyms-heading" className="flex flex-col gap-3">
      <InfoTip
        title={
          <h2 id="gyms-heading" className="text-sm font-semibold">
            {t("Gyms")}
          </h2>
        }
        name={t("gyms")}
      >
        {t("Machine and cable weights differ between gyms, so their records and previous sets are kept per gym.")}
      </InfoTip>

      {locations.length === 0 ? (
        <p className="text-sm text-text-muted">{t("No gyms yet.")}</p>
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
          if (!n) return setError(t("Enter a gym name"));
          add(n);
          setName("");
          setError(null);
        }}
        className="flex gap-2"
      >
        <label htmlFor="new-gym" className="sr-only">
          {t("New gym name")}
        </label>
        <input
          id="new-gym"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder={t("Gym name")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-gym-error" : undefined}
          className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted/70"
        />
        <Button type="submit">{t("Add gym")}</Button>
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
  const t = useT();

  return (
    <li className="rounded-ctl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{gym.name}</h3>
        {gym.isDefault ? (
          <span className="text-xs font-semibold text-accent">{t("Default")}</span>
        ) : (
          <Button variant="ghost" onClick={onMakeDefault} className="min-h-9 px-2 text-xs">
            {t("Make default")}
          </Button>
        )}
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <label htmlFor={`${base}-name`} className="text-xs text-text-muted">
          {t("Name")}
        </label>
        <input
          id={`${base}-name`}
          value={gym.name}
          onChange={(e) => update(gym.id, { name: e.target.value })}
          className="h-11 min-w-0 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
        />
        <label htmlFor={`${base}-bar`} className="text-xs text-text-muted">
          {t("Bar")}
        </label>
        <Select
          id={`${base}-bar`}
          value={gym.barWeightKg}
          onChange={(barWeightKg) => update(gym.id, { barWeightKg })}
          options={BARS.map((b) => ({ value: b, label: `${b} kg` }))}
        />
        <label htmlFor={`${base}-plates`} className="text-xs text-text-muted">
          {t("Plates (kg)")}
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
            } else setPlatesError(t("List positive numbers separated by commas, like 25, 20, 10, 5"));
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
      <GymPin gym={gym} />
      <Button variant="danger" onClick={() => setConfirm(true)} className="mt-3 w-full">
        {t("Delete {name}", { name: gym.name })}
      </Button>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Delete {name}?", { name: gym.name })}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirm(false)}>{t("Keep it")}</Button>
            <Button variant="danger" onClick={() => remove(gym.id)}>
              {t("Delete")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t("Workouts logged here keep their sets. Their machine records stay separate from your other gyms.")}
        </p>
      </Sheet>
    </li>
  );
}

/**
 * Pins the gym to where the lifter stands, so a workout started there picks it by itself
 * (useAutoGym). Location is read once, on this tap.
 */
function GymPin({ gym }: { gym: GymLocation }) {
  const update = useLocationStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; denied?: boolean } | null>(null);
  const pinned = gym.lat !== undefined && gym.lng !== undefined;
  const t = useT();

  async function pin() {
    setBusy(true);
    setMessage(null);
    try {
      const access = await requestAccess("location");
      if (access === "denied") {
        setMessage({ text: t("Location is off for ABOT, so the gym cannot be pinned."), denied: true });
        return;
      }
      const fix = await currentPosition();
      update(gym.id, { lat: fix.lat, lng: fix.lng });
      setMessage({ text: t("Pinned within {m} m.", { m: Math.round(fix.accuracy) }) });
    } catch {
      setMessage({ text: t("Could not find where you are. Try again near a window or outdoors.") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-ctl border border-line bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-xs text-text-muted">
          <MapPin aria-hidden="true" size={16} className={pinned ? "shrink-0 text-accent" : "shrink-0"} />
          {pinned ? t("Picked by itself when a workout starts here.") : t("Pin it to have workouts here pick it by themselves.")}
        </p>
        {pinned ? (
          <Button variant="ghost" onClick={() => update(gym.id, { lat: undefined, lng: undefined })} className="shrink-0">
            {t("Unpin")}
          </Button>
        ) : (
          <Button onClick={() => void pin()} disabled={busy} className="shrink-0">
            {busy ? t("Finding you…") : t("Pin to where I am")}
          </Button>
        )}
      </div>
      {message && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-text-muted">
            {message.text}
          </p>
          {message.denied && isNativeApp() && (
            <Button variant="ghost" onClick={() => void openAppSettings()} className="shrink-0">
              {t("Open settings")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

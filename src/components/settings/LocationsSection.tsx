"use client";

import { useId, useState } from "react";
import { Select } from "@/components/ui/Select";
import { useLocationStore } from "@/store/useLocationStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { GymLocation } from "@/types/workout";
import { InfoTip } from "@/components/ui/InfoTip";
import { Check, LocateFixed, MapPin } from "lucide-react";
import { currentPosition, openAppSettings, requestAccess } from "@/lib/native/permissions";
import { isNativeApp } from "@/lib/native/files";
import { findNearbyGyms, type NearbyGym } from "@/lib/nearby-gyms";
import { useT } from "@/i18n";
import { NumberField } from "@/components/ui/NumberField";
import { PLATE_SETS } from "@/lib/plate-calculator";
import { equipmentUnit, gymSetup, setupPatch, standardSetup, type GymSetup } from "@/lib/gym-equipment";

export function LocationsSection() {
  const { locations, add, update, setDefault } = useLocationStore();
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

      <NearbyGymFinder
        taken={locations}
        onPick={(g) => {
          const gym = add(g.name);
          update(gym.id, { lat: g.lat, lng: g.lng });
        }}
      />

      <MarkGymHere />

      <p className="text-xs text-text-muted">{t("Not on the map? Add it by name:")}</p>
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
          className="h-11 min-w-0 flex-1 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base placeholder:text-text-muted"
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
  const [name, setName] = useState(gym.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const base = `gym-${gym.id}`;
  const t = useT();
  const unit = equipmentUnit(gym);
  const setup = gymSetup(gym, unit)!;
  const standard = PLATE_SETS[unit];
  const save = (next: GymSetup) => update(gym.id, setupPatch(next, unit));
  // The unit's standard sizes plus any odd ones this gym has, heaviest first.
  const sizes = [...new Set([...standard.plates, ...setup.plates])].sort((a, b) => b - a);
  const bars = standard.bars.some((b) => b.weight === setup.bar) ? standard.bars : [...standard.bars, { weight: setup.bar, label: "Gym bar" }];

  function togglePlate(p: number) {
    const i = setup.plates.indexOf(p);
    if (i >= 0) save({ ...setup, plates: setup.plates.filter((_, k) => k !== i), pairs: setup.pairs.filter((_, k) => k !== i) });
    else save({ ...setup, plates: [...setup.plates, p], pairs: [...setup.pairs, undefined] });
  }
  function setPairs(p: number, n: number | null) {
    const i = setup.plates.indexOf(p);
    save({ ...setup, pairs: setup.pairs.map((v, k) => (k === i ? (n === null ? undefined : Math.max(0, Math.round(n))) : v)) });
  }

  return (
    <li className="rounded-ctl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold">{gym.name}</h3>
        {gym.isDefault ? (
          <span className="text-xs font-semibold text-accent">{t("Default")}</span>
        ) : (
          <Button variant="ghost" onClick={onMakeDefault} className="min-h-11 px-2 text-xs">
            {t("Make default")}
          </Button>
        )}
      </div>
      <div className="mt-2 flex flex-col gap-3">
        <div>
          <label htmlFor={`${base}-name`} className="mb-1 block text-xs text-text-muted">
            {t("Name")}
          </label>
          <input
            id={`${base}-name`}
            value={name}
            maxLength={80}
            onChange={(e) => {
              setName(e.target.value);
              // A gym always keeps a name: an empty field is not saved.
              if (e.target.value.trim()) {
                setNameError(null);
                update(gym.id, { name: e.target.value });
              } else setNameError(t("A gym needs a name"));
            }}
            onBlur={() => {
              if (!name.trim()) {
                setName(gym.name);
                setNameError(null);
              }
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${base}-name-error` : undefined}
            className="h-11 w-full min-w-0 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
          />
          {nameError && (
            <p id={`${base}-name-error`} role="alert" className="mt-1 text-xs text-failure">
              {nameError}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="mb-1 text-xs text-text-muted">{t("Weights marked in")}</legend>
          <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-ctl border border-line p-1">
            {(["kg", "lbs"] as const).map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => {
                  if (u === unit) return;
                  // 20 kg plates are no whole number of pounds: a switch starts from that unit's standard set.
                  update(gym.id, setupPatch(standardSetup(u), u));
                }}
                className={`min-h-11 rounded-lg text-sm font-semibold ${unit === u ? "bg-ink/[0.1] text-text" : "text-text-muted hover:text-text"}`}
              >
                {u === "kg" ? "kg" : "lb"}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor={`${base}-bar`} className="mb-1 block text-xs text-text-muted">
            {t("Bar")}
          </label>
          <Select
            id={`${base}-bar`}
            value={setup.bar}
            onChange={(bar) => save({ ...setup, bar })}
            options={bars.map((b) => ({ value: b.weight, label: `${b.weight} ${unit === "kg" ? "kg" : "lb"} · ${t(b.label)}` }))}
            className="w-full"
          />
        </div>

        <fieldset>
          <legend className="mb-1 text-xs text-text-muted">{t("Plates: tap the sizes this gym has. Pairs blank means plenty.")}</legend>
          <ul className="flex flex-col divide-y divide-line rounded-ctl border border-line">
            {sizes.map((p) => {
              const i = setup.plates.indexOf(p);
              const on = i >= 0;
              const label = `${p} ${unit === "kg" ? "kg" : "lb"}`;
              return (
                <li key={p} className="flex items-center gap-2 px-2">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePlate(p)}
                    className={`num my-1 min-h-11 min-w-20 rounded-lg px-3 text-sm font-semibold ${on ? "bg-accent text-on-accent" : "border border-line-strong text-text-muted"}`}
                  >
                    {label}
                  </button>
                  {on && (
                    <>
                      <span aria-hidden="true" className="ml-auto text-xs text-text-muted">
                        {t("Pairs")}
                      </span>
                      <NumberField
                        id={`${base}-pairs-${p}`}
                        value={setup.pairs[i] ?? null}
                        onCommit={(n) => setPairs(p, n)}
                        max={50}
                        placeholder={t("Any")}
                        aria-label={t("Pairs of {plate}", { plate: label })}
                        className="!h-11 !w-20 !text-base"
                      />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <AddPlateSize unit={unit} onAdd={(p) => !setup.plates.includes(p) && save({ ...setup, plates: [...setup.plates, p], pairs: [...setup.pairs, undefined] })} />
        </fieldset>
      </div>
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

/** An odd plate size (0.5 kg fractionals, 55 lb bumpers) the standard list does not have. */
function AddPlateSize({ unit, onAdd }: { unit: "kg" | "lbs"; onAdd: (plate: number) => void }) {
  const t = useT();
  const [v, setV] = useState<number | null>(null);
  const id = useId();
  return (
    <form
      className="mt-2 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v === null || v <= 0) return;
        onAdd(Math.round(v * 100) / 100);
        setV(null);
      }}
    >
      <label htmlFor={id} className="sr-only">
        {t("Other plate size in {unit}", { unit: unit === "kg" ? "kg" : "lb" })}
      </label>
      <NumberField id={id} value={v} onCommit={setV} max={100} placeholder={t("Other size ({unit})", { unit: unit === "kg" ? "kg" : "lb" })} className="!h-11 min-w-0 flex-1 !px-3 !text-left !text-base" />
      <Button type="submit" variant="ghost" className="shrink-0">
        {t("Add size")}
      </Button>
    </form>
  );
}

/**
 * "Find gyms near me": one GPS fix, then the named gyms around it from OpenStreetMap. Picking one
 * adds it already pinned, so workouts there pick it by themselves. The position goes to the map
 * service only on this tap, and the button says so.
 */
export function NearbyGymFinder({ taken, onPick }: { taken: GymLocation[]; onPick: (g: NearbyGym) => void }) {
  const t = useT();
  const [phase, setPhase] = useState<"idle" | "locating" | "searching" | "done">("idle");
  const [results, setResults] = useState<NearbyGym[]>([]);
  const [message, setMessage] = useState<{ text: string; denied?: boolean } | null>(null);
  const busy = phase === "locating" || phase === "searching";
  const has = (g: NearbyGym) => taken.some((l) => l.name.toLowerCase() === g.name.toLowerCase() && l.lat !== undefined);

  async function search() {
    setMessage(null);
    setResults([]);
    setPhase("locating");
    try {
      const access = await requestAccess("location");
      if (access === "denied") {
        setMessage({ text: t("Location is off for ABOT, so nearby gyms cannot be found."), denied: true });
        return setPhase("idle");
      }
      let fix;
      try {
        fix = await currentPosition();
      } catch {
        setMessage({ text: t("Could not find where you are. Try again near a window or outdoors.") });
        return setPhase("idle");
      }
      setPhase("searching");
      const found = await findNearbyGyms(fix);
      setResults(found);
      if (found.length === 0) setMessage({ text: t("No gyms on the map within 5 km. Many local gyms are not mapped yet: mark yours where you stand, below.") });
      setPhase("done");
    } catch (e) {
      setMessage({ text: e instanceof Error ? t(e.message) : t("Could not reach the map service. Check your connection and try again.") });
      setPhase("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="primary" onClick={() => void search()} disabled={busy} aria-busy={busy}>
        <LocateFixed aria-hidden="true" size={18} />
        {phase === "locating" ? t("Finding you…") : phase === "searching" ? t("Searching the map…") : t("Find gyms near me")}
      </Button>
      <p className="text-xs text-text-muted">{t("Sends your position once to OpenStreetMap to list the gyms around you.")}</p>

      {message && (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-text-muted">
            {message.text}
          </p>
          {message.denied && isNativeApp() && (
            <Button variant="ghost" onClick={() => void openAppSettings()} className="shrink-0">
              {t("Open settings")}
            </Button>
          )}
        </div>
      )}

      {results.length > 0 && (
        <>
          <ul aria-label={t("Gyms near you")} className="divide-y divide-line overflow-hidden rounded-ctl border border-line bg-surface">
            {results.map((g) => {
              const added = has(g);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    disabled={added}
                    onClick={() => onPick(g)}
                    aria-label={added ? t("{name}, added", { name: g.name }) : t("Add {name}", { name: g.name })}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <MapPin aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{g.name}</span>
                      {g.address && <span className="block truncate text-xs text-text-muted">{g.address}</span>}
                    </span>
                    <span className="num shrink-0 text-xs text-text-muted">{g.distanceM < 1000 ? `${g.distanceM} m` : `${(g.distanceM / 1000).toFixed(1)} km`}</span>
                    {added && <Check aria-hidden="true" size={16} className="shrink-0 text-accent" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-text-muted">{t("Map data © OpenStreetMap contributors")}</p>
        </>
      )}
    </div>
  );
}

/**
 * For a gym the map does not have (many local gyms are not on OpenStreetMap): at the gym, name it
 * and its position is taken from the phone, once, on this tap. Workouts started there pick it by
 * themselves (AutoGym). No map service is asked.
 */
export function MarkGymHere({ onMarked }: { onMarked?: (gymId: string) => void }) {
  const t = useT();
  const { locations, add, update, setDefault } = useLocationStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"idle" | "locating">("idle");
  const [message, setMessage] = useState<{ text: string; denied?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark() {
    const n = name.trim();
    if (!n) return setError(t("Enter a gym name"));
    setMessage(null);
    setPhase("locating");
    try {
      const access = await requestAccess("location");
      if (access === "denied") {
        setMessage({ text: t("Location is off for ABOT, so the gym cannot be pinned."), denied: true });
        return;
      }
      const fix = await currentPosition();
      const first = locations.length === 0;
      const gym = add(n);
      update(gym.id, { lat: fix.lat, lng: fix.lng });
      if (first) setDefault(gym.id);
      onMarked?.(gym.id);
      setOpen(false);
      setName("");
      setMessage({ text: t("{name} marked here, within {m} m. Workouts started here are tagged with it.", { name: n, m: Math.round(fix.accuracy) }) });
    } catch {
      setMessage({ text: t("Could not find where you are. Try again near a window or outdoors.") });
    } finally {
      setPhase("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={() => setOpen(true)}>
        <MapPin aria-hidden="true" size={18} />
        {t("At the gym? Mark it here")}
      </Button>
      {message && (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-sm text-text-muted">
            {message.text}
          </p>
          {message.denied && isNativeApp() && (
            <Button variant="ghost" onClick={() => void openAppSettings()} className="shrink-0">
              {t("Open settings")}
            </Button>
          )}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("Mark your gym here")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void mark();
          }}
        >
          <p className="mb-3 text-sm text-text-muted">{t("Your phone's position is saved with the name, on this device only. No map service is asked.")}</p>
          <label htmlFor="mark-gym-name" className="mb-1 block text-sm font-semibold">
            {t("Gym name")}
          </label>
          <input
            id="mark-gym-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={80}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "mark-gym-error" : undefined}
            className="h-12 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 text-base"
          />
          {error && (
            <p id="mark-gym-error" role="alert" className="mt-1 text-xs text-failure">
              {error}
            </p>
          )}
          <Button type="submit" variant="primary" disabled={phase === "locating"} aria-busy={phase === "locating"} className="mt-3 w-full">
            <MapPin aria-hidden="true" size={18} />
            {phase === "locating" ? t("Finding you…") : t("Save gym at my position")}
          </Button>
        </form>
      </Sheet>
    </div>
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

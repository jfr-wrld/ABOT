"use client";

import { useSettingsStore } from "@/store/useSettingsStore";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatClock } from "@/lib/calc";

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

export default function SettingsPage() {
  return (
    <HydrationGate>
      <SettingsScreen />
    </HydrationGate>
  );
}

function SettingsScreen() {
  const s = useSettingsStore();
  const field = "h-11 rounded-ctl border border-line-strong bg-surface-2 px-3 text-base text-text";

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Settings" back={{ href: "/", label: "Home" }} />
      <div className="flex flex-col gap-5 px-4 pt-4">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Weight unit</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Weight unit">
            {(["kg", "lbs"] as const).map((u) => (
              <label
                key={u}
                className={`flex min-h-11 cursor-pointer items-center justify-center rounded-ctl border text-sm font-semibold ${
                  s.weightUnit === u ? "border-accent bg-accent-tint" : "border-line-strong bg-surface-2 text-text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="unit"
                  value={u}
                  checked={s.weightUnit === u}
                  onChange={() => s.update({ weightUnit: u })}
                  className="sr-only"
                />
                {u}
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-muted">Stored in kg; this only changes what you see and type.</p>
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="default-rest" className="text-sm font-semibold">
            Default rest timer for new exercises
          </label>
          <select
            id="default-rest"
            value={s.defaultRestSeconds}
            onChange={(e) => s.update({ defaultRestSeconds: Number(e.target.value) })}
            className={field}
          >
            {REST_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {formatClock(r)}
              </option>
            ))}
          </select>
        </div>

        <Toggle
          id="rest-alert"
          label="Vibrate and beep when rest ends"
          checked={s.restTimerAlert}
          onChange={(v) => s.update({ restTimerAlert: v })}
        />
        <Toggle id="show-rpe" label="Show RPE column in the logger" checked={s.showRpe} onChange={(v) => s.update({ showRpe: v })} />

        <div className="flex items-center justify-between gap-3">
          <label htmlFor="first-day" className="text-sm font-semibold">
            Week starts on
          </label>
          <select
            id="first-day"
            value={s.firstDayOfWeek}
            onChange={(e) => s.update({ firstDayOfWeek: Number(e.target.value) as 0 | 1 })}
            className={field}
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </div>

        <p className="text-xs text-text-muted">
          All data is stored in this browser only. Clearing site data removes it.
        </p>
      </div>
    </main>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
          checked ? "border-accent bg-accent-solid" : "border-line-strong bg-surface-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-6 rounded-full bg-white transition-[left] ${checked ? "left-7" : "left-0.5"}`}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

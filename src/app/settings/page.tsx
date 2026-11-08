"use client";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Select } from "@/components/ui/Select";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { BackupSection } from "@/components/settings/BackupSection";
import { StorageSection } from "@/components/settings/StorageSection";
import { SyncSection } from "@/components/settings/SyncSection";
import { WorkoutReminderSettings } from "@/components/settings/WorkoutReminderSettings";
import { LocationsSection } from "@/components/settings/LocationsSection";
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

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title="Settings" back={{ href: "/", label: "Home" }} />
      <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
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
          <Select
            id="default-rest"
            value={s.defaultRestSeconds}
            onChange={(defaultRestSeconds) => s.update({ defaultRestSeconds })}
            options={REST_OPTIONS.map((r) => ({ value: r, label: formatClock(r) }))}
            className="!text-base"
          />
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
          <Select
            id="first-day"
            value={s.firstDayOfWeek}
            onChange={(firstDayOfWeek: 0 | 1) => s.update({ firstDayOfWeek })}
            options={[
              { value: 1, label: "Monday" },
              { value: 0, label: "Sunday" },
            ]}
            className="!text-base"
          />
        </div>

        <div className="border-t border-line pt-5">
          <LocationsSection />
        </div>

        <div id="schedule" className="scroll-mt-16 border-t border-line pt-5">
          <WorkoutReminderSettings />
        </div>

        <div id="sync" className="scroll-mt-16 border-t border-line pt-5">
          <SyncSection />
        </div>

        <div className="border-t border-line pt-5">
          <StorageSection />
        </div>

        <div className="border-t border-line pt-5">
          <BackupSection />
        </div>
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
          checked ? "border-accent bg-accent" : "border-line-strong bg-surface-2"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-0.5 size-6 rounded-full transition-[left] ${checked ? "left-7 bg-black" : "left-0.5 bg-white"}`}
        />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

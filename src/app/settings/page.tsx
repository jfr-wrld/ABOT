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
import { InfoTip } from "@/components/ui/InfoTip";
import { LiveStatusSetting } from "@/components/settings/LiveStatusSetting";
import { AppVersion } from "@/components/settings/AppVersion";
import { AppPermissionsSection } from "@/components/settings/AppPermissions";
import { isNativeApp } from "@/lib/native/files";

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
          <legend className="mb-2">
            <InfoTip title={<span className="text-sm font-semibold">Weight unit</span>} name="weight unit">
              Stored in kg; this only changes what you see and type.
            </InfoTip>
          </legend>
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
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <InfoTip
            title={
              <label htmlFor="default-rest" className="text-sm font-semibold">
                Default rest
              </label>
            }
            name="default rest"
          >
            The rest timer an exercise starts with when you add it. Each exercise can change its own.
          </InfoTip>
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
          label="Rest alert"
          info="Vibrate and beep when the rest countdown reaches zero."
          checked={s.restTimerAlert}
          onChange={(v) => s.update({ restTimerAlert: v })}
        />
        <Toggle
          id="show-rpe"
          label="RPE column"
          info="Rate of perceived exertion, 1 to 10: how hard each set felt. Shown in the logger next to weight and reps."
          checked={s.showRpe}
          onChange={(v) => s.update({ showRpe: v })}
        />
        <LiveStatusSetting />

        <div className="flex items-center justify-between gap-3">
          <InfoTip
            title={
              <label htmlFor="first-day" className="text-sm font-semibold">
                Week starts on
              </label>
            }
            name="week start"
          >
            Where weekly charts, streaks and this week&apos;s figures begin.
          </InfoTip>
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

        {isNativeApp() && (
          <div className="border-t border-line pt-5">
            <AppPermissionsSection />
          </div>
        )}

        <div className="border-t border-line pt-5">
          <StorageSection />
        </div>

        <div className="border-t border-line pt-5">
          <BackupSection />
        </div>

        <AppVersion />
      </div>
    </main>
  );
}

function Toggle({
  id,
  label,
  info,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  info: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <InfoTip
        title={
          <label htmlFor={id} className="text-sm font-semibold">
            {label}
          </label>
        }
        name={label}
      >
        {info}
      </InfoTip>
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

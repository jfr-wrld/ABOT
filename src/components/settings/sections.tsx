"use client";

import { useSettingsStore } from "@/store/useSettingsStore";
import { Select } from "@/components/ui/Select";
import { InfoTip } from "@/components/ui/InfoTip";
import { formatClock } from "@/lib/calc";
import { isNativeApp } from "@/lib/native/files";
import { BackupSection } from "./BackupSection";
import { StorageSection } from "./StorageSection";
import { SyncSection } from "./SyncSection";
import { WorkoutReminderSettings } from "./WorkoutReminderSettings";
import { LocationsSection } from "./LocationsSection";
import { LiveStatusSetting } from "./LiveStatusSetting";
import { AppPermissionsSection } from "./AppPermissions";
import { Choice, Toggle } from "./controls";
import type { AppLanguage, AppTheme } from "@/types/workout";

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

export const LANGUAGE_LABEL: Record<AppLanguage, string> = { auto: "Phone", en: "English", id: "Indonesia" };
export const THEME_LABEL: Record<AppTheme, string> = { system: "System", dark: "Dark", light: "Light" };

/** Language, theme, units, and where the week begins. */
export function GeneralSection() {
  const s = useSettingsStore();
  return (
    <div className="flex flex-col gap-5">
      <Choice
        name="language"
        label="Language"
        info="Phone follows your phone's language: Indonesian when it is set to Indonesian, English otherwise."
        value={s.language}
        options={(["auto", "en", "id"] as const).map((v) => ({ value: v, label: LANGUAGE_LABEL[v] }))}
        onChange={(language) => s.update({ language })}
      />
      <Choice
        name="theme"
        label="Theme"
        info="System follows your phone's light or dark mode."
        value={s.theme}
        options={(["system", "dark", "light"] as const).map((v) => ({ value: v, label: THEME_LABEL[v] }))}
        onChange={(theme) => s.update({ theme })}
      />
      <Choice
        name="unit"
        label="Weight unit"
        info="Stored in kg; this only changes what you see and type."
        value={s.weightUnit}
        options={(["kg", "lbs"] as const).map((u) => ({ value: u, label: u }))}
        onChange={(weightUnit) => s.update({ weightUnit })}
      />
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
    </div>
  );
}

/** Rest timer, logger columns, and gyms. */
export function WorkoutSection() {
  const s = useSettingsStore();
  return (
    <div className="flex flex-col gap-5">
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
      <div className="border-t border-line pt-5">
        <LocationsSection />
      </div>
    </div>
  );
}

/** Everything that rings or shows outside the app. */
export function NotificationsSection() {
  return (
    <div className="flex flex-col gap-5">
      <LiveStatusSetting />
      <div id="schedule" className="scroll-mt-16">
        <WorkoutReminderSettings />
      </div>
      {isNativeApp() && (
        <div className="border-t border-line pt-5">
          <AppPermissionsSection />
        </div>
      )}
    </div>
  );
}

/** Cloud backup, the backup file, and what the phone keeps. */
export function DataSection() {
  return (
    <div className="flex flex-col gap-5">
      <div id="sync" className="scroll-mt-16">
        <SyncSection />
      </div>
      <div className="border-t border-line pt-5">
        <BackupSection />
      </div>
      <div className="border-t border-line pt-5">
        <StorageSection />
      </div>
    </div>
  );
}

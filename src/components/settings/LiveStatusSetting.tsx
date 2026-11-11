"use client";

import { useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { useReminderStore } from "@/store/useReminderStore";
import { liveStatusEnabled, setLiveStatusEnabled } from "@/lib/notifications/useLiveWorkoutNotification";
import { isNativeApp } from "@/lib/native/files";
import { openNotificationSettings } from "@/lib/native/permissions";
import { LiveCapsuleSettings } from "./LiveCapsuleSettings";
import { useT } from "@/i18n";
import { Switch } from "./controls";

/**
 * Settings row: the workout status notification shown while ABOT is in the background. Access
 * itself is asked for by NotificationAccess above it.
 */
export function LiveStatusSetting() {
  const permission = useReminderStore((s) => s.permission);
  const requestPermission = useReminderStore((s) => s.requestPermission);
  const [enabled, setEnabled] = useState(liveStatusEnabled);
  const t = useT();

  const unsupported = permission === "unsupported";
  const blocked = permission === "denied";
  const on = enabled && permission === "granted";
  const app = isNativeApp();
  // Android will no longer ask: the switch leads to ABOT's notification settings instead.
  const openSettings = () => openNotificationSettings().catch(() => {});

  async function toggle() {
    if (app && blocked) return openSettings();
    if (on) {
      setLiveStatusEnabled(false);
      setEnabled(false);
      return;
    }
    const asked = Date.now();
    if (permission !== "granted") await requestPermission();
    // No dialog (an instant no): only Android settings can turn notifications back on.
    if (app && useReminderStore.getState().permission !== "granted" && Date.now() - asked < 500) return openSettings();
    if (useReminderStore.getState().permission === "granted") {
      setLiveStatusEnabled(true);
      setEnabled(true);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <InfoTip
          title={
            <label htmlFor="live-status" className="text-sm font-semibold">
              {app ? t("Live timer in the status bar") : t("Status outside the app")}
            </label>
          }
          name={app ? t("live timer") : t("status outside the app")}
        >
          {app
            ? t("While a workout runs, the status bar shows the rest countdown or the workout time, even with ABOT closed or the screen locked. Pull it down to add 30 seconds, skip rest or log the next set. It rings when rest is over.")
            : t("While a workout runs and you leave ABOT, a notification shows the workout, when rest ends and your next set. Phones only give the Dynamic Island and live updates to installed native apps, so this is a notification.")}
        </InfoTip>
        <Switch id="live-status" checked={on} disabled={unsupported || (blocked && !app)} onChange={() => void toggle()} />
      </div>
      {app && on && <LiveCapsuleSettings />}
    </div>
  );
}

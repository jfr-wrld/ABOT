"use client";

import { useCallback, useEffect, useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { useReminderStore } from "@/store/useReminderStore";
import { liveStatusEnabled, setLiveStatusEnabled } from "@/lib/notifications/useLiveWorkoutNotification";
import { isNativeApp } from "@/lib/native/files";
import { exactAlarmsAllowed, openExactAlarmSettings, testRestAlert } from "@/lib/native/notify";
import { openNotificationSettings } from "@/lib/native/permissions";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { Button } from "@/components/ui/Button";
import { LiveCapsuleSettings } from "./LiveCapsuleSettings";
import { useT } from "@/i18n";
import { Switch } from "./controls";

/** Settings row: the workout status notification shown while ABOT is in the background. */
export function LiveStatusSetting() {
  const permission = useReminderStore((s) => s.permission);
  const requestPermission = useReminderStore((s) => s.requestPermission);
  const [enabled, setEnabled] = useState(liveStatusEnabled);
  const [tested, setTested] = useState<string | null>(null);
  const t = useT();

  const unsupported = permission === "unsupported";
  const blocked = permission === "denied";
  const on = enabled && permission === "granted";
  const app = isNativeApp();
  // Android 12+ can deliver alarms late unless exact alarms are allowed for ABOT.
  const [exact, setExact] = useState(true);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const checkExact = useCallback(() => {
    if (app && on) void exactAlarmsAllowed().then(setExact);
  }, [app, on]);
  useEffect(checkExact, [checkExact]);
  // Coming back from Android settings re-checks exact alarms and notification access.
  useAppResumed(checkExact);

  async function openSettings() {
    setSettingsError(null);
    try {
      await openNotificationSettings();
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : String(err));
    }
  }

  async function toggle() {
    // Android will no longer ask: the switch leads to ABOT's notification settings instead.
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
          {blocked &&
            " " +
              (app
                ? t("Notifications are off for ABOT; turn them on in Android settings.")
                : t("Notifications are blocked for ABOT; allow them in the browser or phone settings."))}
          {unsupported && " " + t("This browser cannot show notifications.")}
        </InfoTip>
        <Switch id="live-status" checked={on} disabled={unsupported || (blocked && !app)} onChange={() => void toggle()} />
      </div>
      {app && on && <LiveCapsuleSettings />}
      {app && blocked && (
        <div className="mt-2 rounded-ctl border border-line bg-surface-2 p-3">
          <p className="text-xs text-text-muted">{t("Notifications are off for ABOT, so the rest alarm and the workout status cannot show.")}</p>
          <Button onClick={() => void openSettings()} className="mt-2 w-full">
            {t("Turn on in Android settings")}
          </Button>
          {settingsError && (
            <p role="alert" className="mt-2 text-xs text-failure">
              {settingsError}
            </p>
          )}
        </div>
      )}
      {app && on && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-text-muted">
            {tested ?? t("Check the sound of the rest-over alert.")}
          </p>
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() =>
              void testRestAlert().then(
                (shown) =>
                  setTested(shown ? t("Alert sent. Check the sound and the notification.") : t("Android blocked it. Turn on notifications for ABOT.")),
                () => setTested(t("The alert could not be sent.")),
              )
            }
          >
            {t("Test alert")}
          </Button>
        </div>
      )}
      {app && on && !exact && (
        <div className="mt-2 rounded-ctl border border-line bg-surface-2 p-3">
          <p className="text-xs text-text-muted">{t("Android may ring the rest alarm a few minutes late. Allow alarms for ABOT to ring on the second.")}</p>
          <Button onClick={() => void openExactAlarmSettings()} className="mt-2 w-full">
            {t("Allow on-time alarms")}
          </Button>
        </div>
      )}
    </div>
  );
}

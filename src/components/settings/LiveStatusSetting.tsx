"use client";

import { useEffect, useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { useReminderStore } from "@/store/useReminderStore";
import { liveStatusEnabled, setLiveStatusEnabled } from "@/lib/notifications/useLiveWorkoutNotification";
import { isNativeApp } from "@/lib/native/files";
import { exactAlarmsAllowed, openExactAlarmSettings, testRestAlert } from "@/lib/native/notify";
import { Button } from "@/components/ui/Button";

/** Settings row: the workout status notification shown while ABOT is in the background. */
export function LiveStatusSetting() {
  const permission = useReminderStore((s) => s.permission);
  const requestPermission = useReminderStore((s) => s.requestPermission);
  const [enabled, setEnabled] = useState(liveStatusEnabled);
  const [tested, setTested] = useState<string | null>(null);

  const unsupported = permission === "unsupported";
  const blocked = permission === "denied";
  const on = enabled && permission === "granted";
  const app = isNativeApp();
  // Android 12+ can deliver alarms late unless exact alarms are allowed for ABOT.
  const [exact, setExact] = useState(true);
  useEffect(() => {
    if (!app || !on) return;
    const check = () => void exactAlarmsAllowed().then(setExact);
    check();
    // Coming back from Android settings re-checks.
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [app, on]);

  async function toggle() {
    if (on) {
      setLiveStatusEnabled(false);
      setEnabled(false);
      return;
    }
    if (permission !== "granted") await requestPermission();
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
              Status outside the app
            </label>
          }
          name="status outside the app"
        >
          {app
            ? "While a workout runs and you leave ABOT, a notification shows the workout and your next set, and rings when rest is over."
            : "While a workout runs and you leave ABOT, a notification shows the workout, when rest ends and your next set. Phones only give the Dynamic Island and live updates to installed native apps, so this is a notification."}
          {blocked && (app ? " Notifications are off for ABOT; turn them on in Android settings." : " Notifications are blocked for ABOT; allow them in the browser or phone settings.")}
          {unsupported && " This browser cannot show notifications."}
        </InfoTip>
        <button
          id="live-status"
          type="button"
          role="switch"
          aria-checked={on}
          disabled={unsupported || blocked}
          onClick={() => void toggle()}
          className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors disabled:opacity-40 ${
            on ? "border-accent bg-accent" : "border-line-strong bg-surface-2"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-0.5 size-6 rounded-full transition-[left] ${on ? "left-7 bg-black" : "left-0.5 bg-white"}`}
          />
          <span className="sr-only">{on ? "On" : "Off"}</span>
        </button>
      </div>
      {app && on && (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-text-muted">
            {tested ?? "Check the sound of the rest-over alert."}
          </p>
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() =>
              void testRestAlert().then(
                (shown) => setTested(shown ? "Alert sent. Check the sound and the notification." : "Android blocked it. Turn on notifications for ABOT."),
                () => setTested("The alert could not be sent."),
              )
            }
          >
            Test alert
          </Button>
        </div>
      )}
      {app && on && !exact && (
        <div className="mt-2 rounded-ctl border border-line bg-surface-2 p-3">
          <p className="text-xs text-text-muted">Android may ring the rest alarm a few minutes late. Allow alarms for ABOT to ring on the second.</p>
          <Button onClick={() => void openExactAlarmSettings()} className="mt-2 w-full">
            Allow on-time alarms
          </Button>
        </div>
      )}
    </div>
  );
}

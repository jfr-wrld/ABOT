"use client";

import { GetAppNudge } from "@/components/get-app/GetAppNudge";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useReminderStore } from "@/store/useReminderStore";
import { isNativeApp } from "@/lib/native/files";
import { exactAlarmsAllowed, openExactAlarmSettings, testRestAlert } from "@/lib/native/notify";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";
import { Toggle } from "./controls";

/**
 * The end of a rest: the pips and beep in the app, and in the Android app the alarm that rings
 * with ABOT closed, its test, and the on-time alarms Android 12+ may hold back.
 */
export function RestAlertSetting() {
  const t = useT();
  const on = useSettingsStore((s) => s.restTimerAlert);
  const update = useSettingsStore((s) => s.update);
  const granted = useReminderStore((s) => s.permission === "granted");
  const app = isNativeApp();
  const [tested, setTested] = useState<string | null>(null);
  const [exact, setExact] = useState(true);
  const checkExact = useCallback(() => {
    if (app && granted) void exactAlarmsAllowed().then(setExact);
  }, [app, granted]);
  useEffect(checkExact, [checkExact]);
  // Coming back from Android settings re-checks exact alarms.
  useAppResumed(checkExact);

  return (
    <div className="flex flex-col gap-2">
      <Toggle
        id="rest-alert"
        label={t("Rest alert")}
        info={t("Three short pips at 3, 2, 1, then a beep and a vibration when rest reaches zero.")}
        checked={on}
        onChange={(v) => {
          update({ restTimerAlert: v });
          // Let the lifter hear what the end of a rest sounds like.
          if (v) feedback.restZero();
        }}
      />
      {!app && on && <GetAppNudge trigger="rest-timer" line={t("A browser tab goes quiet when the screen locks. The Android app rings the rest alarm with the screen off.")} />}
      {app && granted && on && (
        <div className="flex items-center justify-between gap-3">
          <p role="status" className="text-xs text-text-muted">
            {tested ?? t("Check the sound of the rest-over alert.")}
          </p>
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() =>
              void testRestAlert().then(
                (shown) => setTested(shown ? t("Alert sent. Check the sound and the notification.") : t("Android blocked it. Turn on notifications for ABOT.")),
                () => setTested(t("The alert could not be sent.")),
              )
            }
          >
            {t("Test alert")}
          </Button>
        </div>
      )}
      {app && granted && on && !exact && (
        <div className="rounded-ctl border border-line bg-surface-2 p-3">
          <p className="text-xs text-text-muted">{t("Android may ring the rest alarm a few minutes late. Allow alarms for ABOT to ring on the second.")}</p>
          <Button onClick={() => void openExactAlarmSettings()} className="mt-2 w-full">
            {t("Allow on-time alarms")}
          </Button>
        </div>
      )}
    </div>
  );
}

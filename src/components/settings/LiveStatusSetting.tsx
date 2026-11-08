"use client";

import { useState } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { askPermission, notificationPermission, type PermissionState } from "@/lib/notifications/reminder-service";
import { liveStatusEnabled, setLiveStatusEnabled } from "@/lib/notifications/useLiveWorkoutNotification";

/** Settings row: the workout status notification shown while ABOT is in the background. */
export function LiveStatusSetting() {
  // Settings renders behind the hydration gate, so the browser state is readable on first render.
  const [permission, setPermission] = useState<PermissionState>(notificationPermission);
  const [enabled, setEnabled] = useState(liveStatusEnabled);

  const unsupported = permission === "unsupported";
  const blocked = permission === "denied";
  const on = enabled && permission === "granted";

  async function toggle() {
    if (on) {
      setLiveStatusEnabled(false);
      setEnabled(false);
      return;
    }
    const p = permission === "granted" ? "granted" : await askPermission();
    setPermission(p);
    if (p === "granted") {
      setLiveStatusEnabled(true);
      setEnabled(true);
    }
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <InfoTip
        title={
          <label htmlFor="live-status" className="text-sm font-semibold">
            Status outside the app
          </label>
        }
        name="status outside the app"
      >
        While a workout runs and you leave ABOT, a notification shows the workout, when rest ends and your next set.
        Phones only give the Dynamic Island and live updates to installed native apps, so this is a notification.
        {blocked && " Notifications are blocked for ABOT; allow them in the browser or phone settings."}
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
  );
}

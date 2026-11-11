import type { DevicePrefs } from "@/data/backup";
import { useReminderStore } from "@/store/useReminderStore";
import { liveStatusEnabled, setLiveStatusEnabled } from "@/lib/notifications/useLiveWorkoutNotification";
import { useCapsulePrefs } from "@/lib/live-capsule";

/** This phone's notification choices, for the backup file. */
export function currentDevicePrefs(): DevicePrefs {
  const { mode, detail } = useCapsulePrefs.getState();
  return { reminders: useReminderStore.getState().schedule, liveStatus: liveStatusEnabled(), capsule: { mode, detail } };
}

/** Puts a backup's notification choices on this phone; the reminder week is handed to the system again. */
export function applyDevicePrefs(p: DevicePrefs | undefined): void {
  if (!p) return;
  if (p.reminders) useReminderStore.getState().update(p.reminders);
  if (p.liveStatus !== undefined) setLiveStatusEnabled(p.liveStatus);
  if (p.capsule) useCapsulePrefs.getState().set(p.capsule);
}

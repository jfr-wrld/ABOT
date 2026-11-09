/**
 * Later than this after zero, the app was asleep when rest ended: in the Android app the system
 * alarm already rang, and a beep on return would be a second, stale alarm.
 */
export const REST_ALARM_GRACE_MS = 3000;

/**
 * Whether the page plays the rest-over alarm itself. In the Android app the page rings while it
 * is on screen and Android rings while it is not (LiveWorkoutReceiver skips its alarm when the
 * app is in front), so the lifter hears exactly one.
 */
export function pageRingsRestOver({ alert, native, visible, overdueMs }: { alert: boolean; native: boolean; visible: boolean; overdueMs: number }): boolean {
  if (!alert || overdueMs > REST_ALARM_GRACE_MS) return false;
  return !native || visible;
}

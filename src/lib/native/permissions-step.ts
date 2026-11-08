import { isNativeApp } from "./files";

/** Per device, like the intro flag: whether the app's permissions step has been shown. */
const KEY = "abot.permissionsSeen";

export function markPermissionsSeen(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Without storage the step may show again; harmless.
  }
}

/** Where to go instead of `to` the first time, in the Android app only. */
export function withPermissionsStep(to: string): string {
  if (!isNativeApp()) return to;
  try {
    if (localStorage.getItem(KEY) === "1") return to;
  } catch {
    return to;
  }
  return `/permissions?next=${encodeURIComponent(to)}`;
}

import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "./files";

/**
 * Camera and location access. In the Android app they go through the app-local AppPermissions
 * plugin (android/app/src/main/java/app/abot/gym/AppPermissionsPlugin.java); in a browser the
 * page asks at the moment of use, so only location's state can be read ahead.
 */

export type Access = "granted" | "denied" | "prompt";
export type AccessKind = "camera" | "location";

type NativeState = "granted" | "denied" | "prompt" | "prompt-with-rationale";

interface AppPermissionsPlugin {
  checkPermissions(): Promise<Record<AccessKind, NativeState>>;
  requestPermissions(opts: { permissions: AccessKind[] }): Promise<Record<AccessKind, NativeState>>;
  openAppSettings(): Promise<void>;
  openNotificationSettings(): Promise<void>;
}

const AppPermissions = registerPlugin<AppPermissionsPlugin>("AppPermissions");

/** "prompt-with-rationale" (turned down once) can still be asked again. */
const access = (s: NativeState | undefined): Access => (s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt");

export async function checkAccess(kind: AccessKind): Promise<Access> {
  if (isNativeApp()) return access((await AppPermissions.checkPermissions())[kind]);
  if (kind === "location" && typeof navigator !== "undefined" && navigator.permissions) {
    try {
      const { state } = await navigator.permissions.query({ name: "geolocation" });
      return state === "granted" ? "granted" : state === "denied" ? "denied" : "prompt";
    } catch {
      return "prompt";
    }
  }
  return "prompt";
}

export async function requestAccess(kind: AccessKind): Promise<Access> {
  if (isNativeApp()) return access((await AppPermissions.requestPermissions({ permissions: [kind] }))[kind]);
  if (kind === "location") {
    // A browser asks on the first position request.
    return currentPosition().then(
      () => "granted" as const,
      (e: GeolocationPositionError) => (e?.code === 1 ? "denied" : "prompt"),
    );
  }
  return "prompt";
}

/** ABOT's page in Android settings, for an access the lifter turned down for good. */
export function openAppSettings(): Promise<void> {
  return AppPermissions.openAppSettings();
}

/** ABOT's notification page in Android settings. */
export function openNotificationSettings(): Promise<void> {
  return AppPermissions.openNotificationSettings();
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
}

/** One position fix, or a rejection after `timeoutMs`. */
export function currentPosition(timeoutMs = 8000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 5 * 60_000 },
    );
  });
}

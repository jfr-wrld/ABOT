import { registerPlugin } from "@capacitor/core";
import { isNativeApp } from "./files";

/** android/app/src/main/java/app/abot/gym/AppIconPlugin.java */
interface AppIconNative {
  getIcon(): Promise<{ id: string }>;
  setIcon(opts: { id: string }): Promise<{ id: string; changed: boolean }>;
}

// Never resolve a Promise to this object: Capacitor plugin proxies answer `then`.
const AppIcon = registerPlugin<AppIconNative>("AppIcon");

/**
 * Makes the phone's launcher icon the chosen one. Only in the Android app; does nothing when it
 * is already that icon, so calling it on every start is cheap. Errors are swallowed: the icon on
 * the home screen is cosmetic and must never block the app.
 */
export async function applyLauncherIcon(id: string): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const now = await AppIcon.getIcon();
    if (now.id !== id) await AppIcon.setIcon({ id });
  } catch {
    // An older APK without the plugin: the icon stays as it is.
  }
}

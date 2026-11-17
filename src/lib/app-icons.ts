import ICONS from "@/data/app-icons.json";
import type { AppIconId } from "@/types/workout";

/**
 * The logo variants: a tile colour and a mark colour. The same list draws the launcher icons
 * (scripts/make-app-icons.mjs), names the Android aliases (.Launcher<Id>, AndroidManifest.xml)
 * and colours the logo inside the app. Ids and alias names never change once shipped.
 */
export interface AppIcon {
  id: AppIconId;
  label: string;
  bg: string;
  fg: string;
}

export const APP_ICONS = ICONS as AppIcon[];

export function appIcon(id: string | undefined): AppIcon {
  return APP_ICONS.find((i) => i.id === id) ?? APP_ICONS[0]!;
}

/** The variant as CSS variables for .logo-tile and the marks that follow it. */
export function logoTokens(id: string | undefined): Record<"--logo-bg" | "--logo-fg", string> {
  const i = appIcon(id);
  return { "--logo-bg": i.bg, "--logo-fg": i.fg };
}

import type { SettingsSection } from "./labels";

/*
 * What Settings search finds: each setting by the name it shows, the section that holds it, and
 * the element to scroll to there. Plain data with no React, so src/i18n/dynamic-keys.ts can list
 * the names for the translation check.
 */

export interface SettingsEntry {
  title: string;
  section: SettingsSection;
  /** Element id in that section; the page scrolls it into view. */
  anchor?: string;
  /** Other words people search with, matched in English only. */
  also?: string;
  /** Only in the Android app, or only in a browser. */
  nativeOnly?: boolean;
  webOnly?: boolean;
  /** A page outside Settings instead of a section. */
  href?: string;
}

export const SETTINGS_INDEX: SettingsEntry[] = [
  { title: "Language", section: "general", anchor: "setting-language", also: "bahasa english indonesia" },
  { title: "Theme", section: "general", anchor: "setting-theme", also: "dark light mode gelap terang" },
  { title: "Visual effects", section: "general", anchor: "setting-effects", also: "battery animation lite" },
  { title: "Weight unit", section: "general", anchor: "setting-unit", also: "kg lbs pounds" },
  { title: "Week starts on", section: "general", anchor: "first-day", also: "monday sunday" },
  { title: "Default rest", section: "workout", anchor: "default-rest", also: "timer" },
  { title: "RPE column", section: "workout", anchor: "show-rpe", also: "exertion" },
  { title: "Sounds & vibration", section: "workout", anchor: "tap-feedback", also: "haptic" },
  { title: "Gyms", section: "gyms", anchor: "gyms-heading", also: "location" },
  { title: "Bar", section: "gyms", also: "barbell plates calculator" },
  { title: "Find gyms near me", section: "gyms", also: "map nearby" },
  { title: "Rest alert", section: "notifications", anchor: "rest-alert", also: "alarm beep" },
  { title: "Live timer in the status bar", section: "notifications", anchor: "live-status", nativeOnly: true },
  { title: "Status outside the app", section: "notifications", anchor: "live-status", webOnly: true },
  { title: "Workout schedule", section: "notifications", anchor: "schedule", also: "reminder calendar" },
  { title: "App permissions", section: "notifications", anchor: "permissions-heading", nativeOnly: true, also: "camera location" },
  { title: "Health Connect", section: "health", anchor: "health-heading", also: "google fit samsung huawei" },
  { title: "Body", section: "health", href: "/profile/body", also: "body weight fat waist weigh-in" },
  { title: "Backup & Sync", section: "data", anchor: "sync", also: "google cloud sign in" },
  { title: "Backup file", section: "data", anchor: "backup-heading", also: "export import json" },
  { title: "Import from Hevy or Strong", section: "data", anchor: "csv-heading", also: "csv" },
  { title: "Storage on this device", section: "data", anchor: "storage-heading" },
  { title: "Delete my data", section: "data", anchor: "delete-heading", also: "account remove" },
  { title: "FAQ", section: "faq", also: "help question" },
  { title: "About ABOT", section: "about", also: "version licence privacy" },
];

/** Lower case without accents, for matching typed text. */
export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Entries whose text holds every typed word; titles that start with the query come first.
 * `label` gives an entry's searchable text in the app's language.
 */
export function searchSettings(query: string, entries: SettingsEntry[], label: (e: SettingsEntry) => string): SettingsEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const q = fold(query.trim());
  return entries
    .map((e) => ({ e, hay: fold(`${label(e)} ${e.title} ${e.also ?? ""}`), head: fold(label(e)).startsWith(q) || fold(e.title).startsWith(q) }))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => Number(b.head) - Number(a.head))
    .map((x) => x.e);
}

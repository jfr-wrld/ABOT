import type { AppLanguage, AppTheme } from "@/types/workout";

/*
 * Settings texts kept in constants, in a module with no React or store imports so
 * src/i18n/dynamic-keys.ts can list them for the translation coverage test.
 */

export type SettingsSection = "general" | "workout" | "notifications" | "health" | "data" | "faq" | "about";

export const SECTION_TITLE: Record<SettingsSection, string> = {
  general: "General",
  workout: "Workout",
  notifications: "Notifications",
  health: "Health apps",
  data: "Data & backup",
  faq: "FAQ",
  about: "About ABOT",
};

/** Option labels stay as written in every language, except "Phone", which is translated. */
export const LANGUAGE_LABEL: Record<AppLanguage, string> = { auto: "Phone", en: "English", id: "Bahasa Indonesia" };
export const THEME_LABEL: Record<AppTheme, string> = { system: "System", dark: "Dark", light: "Light" };

/** Questions people ask, answered in a line or two each. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Does ABOT work without internet?",
    a: "Yes. Workouts, routines and records are saved on your phone. Only exercise photos, the full catalog download and backup need a connection.",
  },
  {
    q: "Do I need an account?",
    a: "No. Sign in with Google only if you want a backup in the cloud or the same data on two phones.",
  },
  {
    q: "How are personal records counted?",
    a: "Once per lift per workout, for the heaviest weight, the best estimated 1RM and the most volume in a set. The first time you log a lift is your baseline, not a record.",
  },
  {
    q: "Why did the rest alarm not ring?",
    a: "Notifications must be on for ABOT: Settings, Notifications, then Test alert. If it rings late, allow on-time alarms there, and keep battery saver from stopping ABOT.",
  },
  {
    q: "How does ABOT pick my gym?",
    a: "Pin each gym in Settings, Workout, Gyms while you are there. A workout started within about 300 m of a pinned gym picks it, if location is allowed.",
  },
  {
    q: "How do I share a workout to Instagram Stories?",
    a: "Open a finished workout, tap Share story, pick a layout and an optional photo, then Share to Instagram and choose Stories. Your username comes from Profile.",
  },
  {
    q: "How do I move my data to a new phone?",
    a: "Sign in with Google on both phones, or export a backup file in Settings, Data, and import it on the new phone.",
  },
  {
    q: "How do I delete my data?",
    a: "Uninstalling ABOT removes everything from the phone. To delete your cloud backup as well, email us from the account you signed in with.",
  },
];

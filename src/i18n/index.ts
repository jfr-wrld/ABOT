import { useMemo, useSyncExternalStore } from "react";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { AppLanguage } from "@/types/workout";
import { ID } from "./id";

/**
 * English and Bahasa Indonesia. The English text is the key: `t("Start an empty workout")`
 * looks it up in the Indonesian dictionary (src/i18n/id/) and falls back to the English, so a
 * missing entry never shows blank. `{name}` placeholders are filled from `vars`.
 * src/i18n/coverage.test.ts fails when a literal passed to t() has no Indonesian entry.
 */

export type Lang = "en" | "id";
export type Vars = Record<string, string | number>;

/** "auto" follows the phone: Indonesian when its language is Indonesian, English otherwise. */
export function resolveLang(setting: AppLanguage, phone?: string): Lang {
  if (setting === "en" || setting === "id") return setting;
  const tag = (phone ?? (typeof navigator !== "undefined" ? navigator.language : "en")).toLowerCase();
  return tag.startsWith("id") || tag.startsWith("in") ? "id" : "en";
}

export function translate(lang: Lang, text: string, vars?: Vars): string {
  const s = lang === "id" ? (ID[text] ?? text) : text;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** English singular or plural by count, translated; `{n}` is the count. */
export function translateCount(lang: Lang, n: number, one: string, other: string, vars?: Vars): string {
  return translate(lang, n === 1 ? one : other, { n, ...vars });
}

export interface T {
  (text: string, vars?: Vars): string;
  /** `t.n(3, "{n} set", "{n} sets")` */
  n: (n: number, one: string, other: string, vars?: Vars) => string;
  lang: Lang;
  /** BCP 47 tag for Intl and toLocale*String. */
  locale: string;
}

const noop = () => () => {};

/** The current language. Static HTML is English; the app switches right after it loads. */
export function useLang(): Lang {
  const setting = useSettingsStore((s) => s.language);
  return useSyncExternalStore(
    noop,
    () => resolveLang(setting),
    () => "en",
  );
}

export function makeT(lang: Lang): T {
  const t = ((text: string, vars?: Vars) => translate(lang, text, vars)) as T;
  t.n = (n, one, other, vars) => translateCount(lang, n, one, other, vars);
  t.lang = lang;
  t.locale = lang === "id" ? "id-ID" : "en-US";
  return t;
}

export function useT(): T {
  const lang = useLang();
  return useMemo(() => makeT(lang), [lang]);
}

/** Outside React (notifications, exports): the language from the saved setting. */
export function currentT(): T {
  return makeT(resolveLang(useSettingsStore.getState().language));
}

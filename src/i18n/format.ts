import { id as idLocale } from "date-fns/locale";
import type { Locale } from "date-fns";
import type { Lang } from "./index";

/** date-fns locale for `format`, `formatDistance` and friends; undefined means English. */
export function dateFnsLocale(lang: Lang): Locale | undefined {
  return lang === "id" ? idLocale : undefined;
}

/** BCP 47 tag for toLocaleDateString / Intl in the chosen language. */
export const intlLocale = (lang: Lang) => (lang === "id" ? "id-ID" : "en-US");

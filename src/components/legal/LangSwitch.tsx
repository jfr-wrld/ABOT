"use client";

import type { LegalLang } from "./legal-content";

/** English / Bahasa Indonesia switch for the public pages (legal, about). */
export function LangSwitch({ lang, onPick }: { lang: LegalLang; onPick: (l: LegalLang) => void }) {
  return (
    <div role="group" aria-label="Language / Bahasa" className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => onPick(l)}
          className={`min-h-9 rounded-full px-3 ${lang === l ? "bg-ink/10 text-text" : "text-text-muted hover:text-text"}`}
        >
          {l === "en" ? "English" : "Bahasa Indonesia"}
        </button>
      ))}
    </div>
  );
}

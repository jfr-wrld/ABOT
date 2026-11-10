"use client";

import Link from "next/link";
import { useState } from "react";
import { BackLink } from "@/components/navigation/BackLink";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/i18n";
import { CONTACT_EMAIL, type LegalDoc, type LegalLang } from "./legal-content";

const OTHER = {
  privacy: { href: "/terms", en: "Terms of Use", id: "Ketentuan Penggunaan" },
  terms: { href: "/privacy", en: "Privacy Policy", id: "Kebijakan Privasi" },
} as const;

/**
 * A legal page: plain reading text, one column, with a language switch (the app's language by
 * default; the prerendered HTML Google reviews is English) and a link to the other document.
 * No dock: it is reached from Settings, the sign-in page and Google's consent screen.
 */
export function LegalPage({ which, docs }: { which: "privacy" | "terms"; docs: Record<LegalLang, LegalDoc> }) {
  const t = useT();
  const [picked, setPicked] = useState<LegalLang | null>(null);
  const lang: LegalLang = picked ?? (t.lang === "id" ? "id" : "en");
  const doc = docs[lang];
  const other = OTHER[which];

  return (
    <main className="flex flex-1 flex-col px-4 pt-4 pb-10" lang={lang}>
      <div className="flex items-center justify-between gap-2">
        <BackLink
          href="/"
          className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-ctl pr-3 pl-1 text-sm text-text-muted hover:bg-surface hover:text-text"
        >
          <ChevronLeft aria-hidden="true" size={18} />
          ABOT
        </BackLink>
        <div role="group" aria-label="Language / Bahasa" className="flex rounded-full border border-line p-0.5 text-xs font-semibold">
          {(["en", "id"] as const).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={lang === l}
              onClick={() => setPicked(l)}
              className={`min-h-9 rounded-full px-3 ${lang === l ? "bg-ink/10 text-text" : "text-text-muted hover:text-text"}`}
            >
              {l === "en" ? "English" : "Indonesia"}
            </button>
          ))}
        </div>
      </div>

      <article className="mt-4 flex max-w-[62ch] flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{doc.title}</h1>
          <p className="label-caps">{doc.updated}</p>
          <p className="text-[15px] leading-relaxed text-text-muted">{doc.intro}</p>
        </header>
        {doc.sections.map((s) => (
          <section key={s.heading} className="flex flex-col gap-2">
            <h2 className="text-base font-bold">{s.heading}</h2>
            {s.blocks.map((b, i) =>
              "p" in b ? (
                <p key={i} className="text-[15px] leading-relaxed">
                  {withEmail(b.p)}
                </p>
              ) : (
                <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed marker:text-text-muted">
                  {b.list.map((item) => (
                    <li key={item}>{withEmail(item)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
        <footer className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-4 text-sm">
          <Link href={other.href} className="font-semibold text-accent underline-offset-4 hover:underline">
            {other[lang]}
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-text-muted underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>
        </footer>
      </article>
    </main>
  );
}

/** The contact address as a mail link wherever it appears in the text. */
function withEmail(text: string) {
  const parts = text.split(CONTACT_EMAIL);
  if (parts.length === 1) return text;
  return parts.flatMap((part, i) =>
    i === 0
      ? [part]
      : [
          <a key={i} href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent underline-offset-4 hover:underline">
            {CONTACT_EMAIL}
          </a>,
          part,
        ],
  );
}

"use client";

import { useId, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { CONTACT_EMAIL, contactHref } from "@/lib/social";
import { useAppVersion } from "./AppVersion";
import { FAQ } from "./labels";
import { useT } from "@/i18n";

export { FAQ };

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  const base = useId();
  const t = useT();
  return (
    <ul className="flex flex-col gap-2">
      {FAQ.map((item, i) => {
        const expanded = open === i;
        return (
          <li key={item.q} className="rounded-ctl border border-line bg-surface">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`${base}-${i}`}
              onClick={() => setOpen(expanded ? null : i)}
              className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-semibold"
            >
              {t(item.q)}
              <ChevronDown aria-hidden="true" size={18} className={`shrink-0 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <p id={`${base}-${i}`} className="px-3 pb-3 text-sm text-text-muted">
                {t(item.a)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AboutSection() {
  const version = useAppVersion();
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="text-accent">
          <AbotMark size={56} />
        </span>
        <p className="text-xl font-extrabold tracking-tight">ABOT</p>
        <p className="text-sm text-text-muted">{t("A strength training log that works offline.")}</p>
        {version && <p className="num text-xs text-text-muted">{t("Version {version}", { version })}</p>}
      </div>

      <section aria-labelledby="about-privacy" className="panel p-3">
        <h2 id="about-privacy" className="text-sm font-semibold">
          {t("Your data")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "Your training stays on this phone. Signing in copies it to your own backup space so you can restore it. Nothing is sold, and no one else sees it.",
          )}
        </p>
      </section>

      <section aria-labelledby="about-credits" className="panel p-3">
        <h2 id="about-credits" className="text-sm font-semibold">
          {t("Credits")}
        </h2>
        <ul className="mt-1 flex flex-col gap-1 text-sm text-text-muted">
          <li>{t("Exercise data and photos: free-exercise-db (public domain).")}</li>
          <li>{t("Muscle map shapes: react-muscle-highlighter (MIT License).")}</li>
          <li>{t("Type: Plus Jakarta Sans and JetBrains Mono (SIL Open Font License).")}</li>
        </ul>
      </section>

      <a href={contactHref(version)} className="panel flex min-h-12 items-center gap-3 p-3 text-sm hover:border-line-hover">
        <Mail aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{t("Contact us")}</span>
          <span className="block truncate text-text-muted">{CONTACT_EMAIL}</span>
        </span>
      </a>
    </div>
  );
}

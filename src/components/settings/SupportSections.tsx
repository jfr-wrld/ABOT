"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ChevronDown, Mail } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { CONTACT_EMAIL, contactHref } from "@/lib/social";
import { useAppVersion } from "./AppVersion";
import { UpdateCheck } from "./UpdateCheck";
import { FAQ } from "./labels";
import { useT } from "@/i18n";
import { FOOD_PHOTOS } from "@/data/food-photos.generated";

/** Everyone whose Pexels photo shows a food in the guide, named once each. */
const PHOTO_AUTHORS = [...new Set(Object.values(FOOD_PHOTOS).filter((c) => c.site !== "Wikimedia Commons").map((c) => c.author).filter((a): a is string => !!a))].sort();
/** Commons photos are credited one by one: author, licence and a link to the file, as CC BY(-SA) asks. */
const COMMONS = Object.entries(FOOD_PHOTOS).filter(([, c]) => c.site === "Wikimedia Commons");

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

      <UpdateCheck />

      <section aria-labelledby="about-privacy" className="panel p-3">
        <h2 id="about-privacy" className="text-sm font-semibold">
          {t("Your data")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t(
            "Your training stays on this phone. Signing in copies it to your own backup space so you can restore it. Nothing is sold, and no one else sees it.",
          )}
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/privacy" className="font-semibold text-accent underline-offset-4 hover:underline">
            {t("Privacy Policy")}
          </Link>
          <Link href="/terms" className="font-semibold text-accent underline-offset-4 hover:underline">
            {t("Terms of Use")}
          </Link>
        </p>
      </section>

      <section aria-labelledby="about-credits" className="panel p-3">
        <h2 id="about-credits" className="text-sm font-semibold">
          {t("Credits")}
        </h2>
        <ul className="mt-1 flex flex-col gap-1 text-sm text-text-muted">
          <li>{t("Exercise data and photos: free-exercise-db (public domain).")}</li>
          <li>
            {t("Extended exercise library: Open Exercise Atlas (data CC0 1.0). Illustrations CC0 1.0, or MIT License: Monk Mode, Copyright (c) 2026 Yağız Eren Tunay.")}
          </li>
          <li>{t("Muscle map shapes: react-muscle-highlighter (MIT License).")}</li>
          <li>{t("Type: Plus Jakarta Sans and JetBrains Mono (SIL Open Font License).")}</li>
          <li>{t("Food values: Tabel Komposisi Pangan Indonesia (Kemenkes RI) and USDA FoodData Central (public domain).")}</li>
          <li>
            <details>
              <summary className="cursor-pointer">{t("Food photos: Pexels (free to use). Photographers")}</summary>
              <p className="mt-1 text-xs leading-relaxed">{PHOTO_AUTHORS.join(", ")}</p>
            </details>
          </li>
          {COMMONS.length > 0 && (
            <li>
              <details>
                <summary className="cursor-pointer">{t("Food photos from Wikimedia Commons")}</summary>
                <ul className="mt-1 flex flex-col gap-1 text-xs leading-relaxed">
                  {COMMONS.map(([id, c]) => (
                    <li key={id}>
                      <a href={c.page} target="_blank" rel="noopener noreferrer" className="underline">
                        {id.replace(/-/g, " ")}
                      </a>
                      {` · ${c.author ?? t("unknown author")} · ${c.license}`}
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )}
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

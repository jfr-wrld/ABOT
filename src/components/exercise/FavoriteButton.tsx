"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/** Starred exercise ids as a set, and a toggle. Stored in settings, so they back up and sync. */
export function useFavorites(): { favorites: ReadonlySet<string>; toggle: (id: string) => void } {
  const ids = useSettingsStore((s) => s.favoriteExercises);
  const update = useSettingsStore((s) => s.update);
  const favorites = useMemo(() => new Set(ids), [ids]);
  const toggle = (id: string) => {
    const now = useSettingsStore.getState().favoriteExercises;
    update({ favoriteExercises: now.includes(id) ? now.filter((x) => x !== id) : [id, ...now].slice(0, 200) });
  };
  return { favorites, toggle };
}

/** A 44 px star that stars or unstars one exercise. */
/** `overlay`: on a dark disc over a photo (the detail page); `plain`: in a list row. */
export function FavoriteButton({ id, name, tone = "plain" }: { id: string; name: string; tone?: "plain" | "overlay" }) {
  const t = useT();
  const { favorites, toggle } = useFavorites();
  const on = favorites.has(id);
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={t("Favorite {name}", { name })}
      onClick={(e) => {
        // Rows are links: a star tap must not open the exercise.
        e.preventDefault();
        e.stopPropagation();
        feedback.tick();
        toggle(id);
      }}
      className={`flex size-11 shrink-0 items-center justify-center transition-colors ${
        tone === "overlay"
          ? `rounded-full bg-black/40 backdrop-blur hover:bg-black/60 ${on ? "text-accent" : "text-white"}`
          : `rounded-ctl hover:bg-ink/[0.05] ${on ? "text-accent" : "text-text-muted hover:text-text"}`
      }`}
    >
      <Star aria-hidden="true" size={18} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

"use client";

import { useId } from "react";
import type { MuscleGroup } from "@/types/workout";
import { useT } from "@/i18n";
import { muscleNames } from "@/components/exercise/MuscleTags";
import { regionLevels, type Level, type Region } from "./regions";
import { BODY_BACK, BODY_FRONT, OUTLINE_BACK, OUTLINE_FRONT, type BodyPart } from "./bodyPaths.generated";

/** Parts that are body, not muscle: drawn flat and never highlighted. */
const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);

function Parts({ parts, levels, glowId }: { parts: BodyPart[]; levels: Partial<Record<Region, Level>>; glowId: string }) {
  return (
    <>
      {parts.map((p) => {
        const level = NON_MUSCLE.has(p.slug) ? undefined : levels[p.slug as Region];
        return (
          <g
            key={p.slug}
            data-region={p.slug}
            data-level={NON_MUSCLE.has(p.slug) ? "body" : (level ?? "none")}
            filter={level === "primary" ? `url(#${glowId})` : undefined}
          >
            {p.d.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={level ? "var(--color-accent)" : NON_MUSCLE.has(p.slug) ? "var(--color-surface-2)" : "var(--color-muscle-off)"}
                fillOpacity={level === "secondary" ? 0.4 : 1}
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

/**
 * Anatomical front and back body (paths from react-muscle-highlighter, MIT) with the exercise's
 * primary muscles in the accent colour with a soft glow, secondary muscles at 40%.
 */
export function MuscleMap({
  primary,
  secondary = [],
  width = 280,
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  width?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const levels = regionLevels(primary, secondary);
  const t = useT();
  const names = (ms: MuscleGroup[]) => muscleNames(ms, t, ", ") || t("none");
  const description = t("Primary: {primary}. Secondary: {secondary}.", { primary: names(primary), secondary: names(secondary) });
  return (
    <figure className="mx-auto" style={{ maxWidth: width }}>
      <svg role="img" aria-labelledby={`${uid}-t`} viewBox="0 30 1448 1360" className="block h-auto w-full">
        <title id={`${uid}-t`}>{description}</title>
        <defs>
          {/* Glow marks the primary muscles only: the focal point of the figure. */}
          <filter id={`${uid}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Parts parts={BODY_FRONT} levels={levels} glowId={`${uid}-glow`} />
        <Parts parts={BODY_BACK} levels={levels} glowId={`${uid}-glow`} />
        <g fill="none" stroke="var(--color-line-strong)" strokeWidth={2.5}>
          <path d={OUTLINE_FRONT} />
          <path d={OUTLINE_BACK} />
        </g>
      </svg>
      <figcaption className="mt-1 grid grid-cols-2 text-center text-xs text-text-muted" aria-hidden="true">
        <span>{t("Front")}</span>
        {/* "Back" alone is the navigation word in the dictionary. */}
        <span>{t.lang === "en" ? "Back" : t("Back (side)")}</span>
      </figcaption>
    </figure>
  );
}

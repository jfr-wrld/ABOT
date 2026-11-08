import { useId } from "react";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/types/workout";
import { muscleForRegion, regionLevels, type Level, type Region } from "./regions";
import { BODY_BACK, BODY_FRONT, OUTLINE_BACK, OUTLINE_FRONT, type BodyPart } from "./bodyPaths.generated";

/** Parts that are body, not muscle: drawn flat and never highlighted. */
const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);

function Parts({
  parts,
  levels,
  glowId,
  onSelect,
}: {
  parts: BodyPart[];
  levels: Partial<Record<Region, Level>>;
  glowId: string;
  onSelect?: (r: Region) => void;
}) {
  return (
    <>
      {parts.map((p) => {
        const body = NON_MUSCLE.has(p.slug);
        const level = body ? undefined : levels[p.slug as Region];
        const tappable = onSelect && !body;
        const label = tappable ? MUSCLE_GROUP_LABELS[muscleForRegion(p.slug as Region)] : undefined;
        return (
          <g
            key={p.slug}
            data-region={p.slug}
            data-level={body ? "body" : (level ?? "none")}
            filter={level === "primary" ? `url(#${glowId})` : undefined}
            {...(tappable
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": `Filter by ${label}`,
                  "aria-pressed": level === "primary",
                  onClick: () => onSelect(p.slug as Region),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(p.slug as Region);
                    }
                  },
                  className: "cursor-pointer outline-none [&:focus-visible>path]:stroke-accent [&:focus-visible>path]:[stroke-width:6] hover:opacity-80",
                }
              : {})}
          >
            {p.d.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={level ? "var(--color-accent)" : NON_MUSCLE.has(p.slug) ? "var(--color-surface-2)" : "#3a3a40"}
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
  onSelectRegion,
}: {
  primary: MuscleGroup[];
  secondary?: MuscleGroup[];
  width?: number;
  /** Makes each muscle a button (used as the library's body map filter). */
  onSelectRegion?: (r: Region) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const levels = regionLevels(primary, secondary);
  const names = (ms: MuscleGroup[]) => ms.map((m) => MUSCLE_GROUP_LABELS[m]).join(", ");
  const description = `Primary: ${names(primary) || "none"}. Secondary: ${names(secondary) || "none"}.`;
  return (
    <figure className="mx-auto" style={{ maxWidth: width }}>
      <svg role={onSelectRegion ? "group" : "img"} aria-labelledby={`${uid}-t`} viewBox="0 30 1448 1360" className="block h-auto w-full">
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
        <Parts parts={BODY_FRONT} levels={levels} glowId={`${uid}-glow`} onSelect={onSelectRegion} />
        <Parts parts={BODY_BACK} levels={levels} glowId={`${uid}-glow`} onSelect={onSelectRegion} />
        <g fill="none" stroke="var(--color-line-strong)" strokeWidth={2.5}>
          <path d={OUTLINE_FRONT} />
          <path d={OUTLINE_BACK} />
        </g>
      </svg>
      <figcaption className="mt-1 grid grid-cols-2 text-center text-xs text-text-muted" aria-hidden="true">
        <span>Front</span>
        <span>Back</span>
      </figcaption>
    </figure>
  );
}

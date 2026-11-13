import { useId } from "react";
import { initials } from "@/lib/profile";
import { useT } from "@/i18n";

export const HEX = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/**
 * The lifter as a weight plate: the same flat-top hexagon as the ABOT mark, outlined in Volt.
 * Inside sits their photo, else their initials in mono, else the plate's hole.
 */
export function ProfileAvatar({
  name,
  photo,
  size = 72,
  ringed = false,
  decorative = false,
}: {
  name: string;
  photo?: string | null;
  size?: number;
  /** A page-coloured edge around the plate, for when it overlaps a cover. */
  ringed?: boolean;
  /** Hidden from assistive tech, for when the surrounding control already names it. */
  decorative?: boolean;
}) {
  const clipId = `hex-${useId().replace(/:/g, "")}`;
  const letters = initials(name);
  const t = useT();
  const label = photo ? (name.trim() ? t("Photo of {name}", { name: name.trim() }) : t("Photo of you")) : (letters ?? t("No name set"));
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })} className="shrink-0" overflow="visible">
      <defs>
        <clipPath id={clipId}>
          <path d={HEX} />
        </clipPath>
      </defs>
      {ringed && <path d={HEX} fill="var(--color-bg)" stroke="var(--color-bg)" strokeWidth={14} strokeLinejoin="round" />}
      <path d={HEX} fill="var(--color-surface)" />
      {photo ? (
        <image href={photo} x="4" y="4" width="92" height="92" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : letters ? (
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--color-text)"
          fontFamily="var(--font-mono)"
          fontWeight={700}
          fontSize={letters.length > 1 ? 30 : 36}
          letterSpacing="-1"
        >
          {letters}
        </text>
      ) : (
        <circle cx="50" cy="50" r="14" fill="none" stroke="var(--color-accent)" strokeWidth={3} />
      )}
      <path d={HEX} fill="none" stroke="var(--color-accent)" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

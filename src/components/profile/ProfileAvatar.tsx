import { useId } from "react";
import { initials } from "@/lib/profile";

const HEX = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/**
 * The lifter as a weight plate: the same flat-top hexagon as the ABOT mark, outlined in Volt.
 * Inside sits their photo, else their initials in mono, else the plate's hole.
 */
export function ProfileAvatar({ name, photo, size = 72 }: { name: string; photo?: string | null; size?: number }) {
  const clipId = `hex-${useId().replace(/:/g, "")}`;
  const letters = initials(name);
  const label = photo ? `Photo of ${name.trim() || "you"}` : (letters ?? "No name set");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label} className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          <path d={HEX} />
        </clipPath>
      </defs>
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

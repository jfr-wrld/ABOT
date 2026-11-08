import { initials } from "@/lib/profile";

/**
 * The lifter as a weight plate: the same flat-top hexagon as the ABOT mark, outlined in Volt,
 * with their initials stamped in mono where the plate's hole would be. No name yet: the plain mark.
 */
export function ProfileAvatar({ name, size = 72 }: { name: string; size?: number }) {
  const letters = initials(name);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={letters ?? "No name set"}
      className="shrink-0"
    >
      <path
        d="M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z"
        fill="var(--color-surface)"
        stroke="var(--color-accent)"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {letters ? (
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
    </svg>
  );
}

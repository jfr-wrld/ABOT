"use client";

import { useId, type ReactNode } from "react";

/**
 * A small drawing of each grip, stance or cable attachment, so a choice reads at a glance:
 * where the hands sit on the bar and which way they face, how the feet stand, what hangs on the
 * cable. Drawn here rather than taken from an icon set: no set has these. 24 px grid, the same
 * stroke as the app's other icons. Hands are filled; the knuckles (four bumps) show the side the
 * back of the hand faces: above the bar for overhand, below for underhand.
 */
const BAR = <path d="M1.5 12h21" strokeWidth={2.2} />;

/**
 * A fist on a horizontal bar at x, taken literally: over the bar for an overhand grip, hanging
 * under it for underhand. The finger gaps face the way the fingers wrap.
 */
function Hand({ x, under = false }: { x: number; under?: boolean }) {
  // The gaps are cut out with a mask, so they show whatever is behind the icon.
  const id = `h${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const y = under ? 10.5 : 4.5;
  const gapY = under ? y + 5.6 : y + 0.4;
  return (
    <g>
      <mask id={id}>
        <rect x={x - 3.2} y={y - 0.2} width={6.4} height={9.4} fill="#fff" />
        {[-1.4, 0, 1.4].map((dx) => (
          <rect key={dx} x={x + dx - 0.4} y={gapY} width={0.8} height={3} fill="#000" />
        ))}
      </mask>
      <rect x={x - 3} y={y} width={6} height={9} rx={2.2} fill="currentColor" stroke="none" mask={`url(#${id})`} />
    </g>
  );
}

/** A hand closed on a vertical handle (palms facing in). */
function SideHand({ x }: { x: number }) {
  return <rect x={x - 1.6} y={9} width={3.2} height={6} rx={1.2} fill="currentColor" stroke="none" />;
}

function Foot({ x, y = 15, turn = 0 }: { x: number; y?: number; turn?: number }) {
  return <ellipse cx={x} cy={y} rx={1.6} ry={3.2} transform={`rotate(${turn} ${x} ${y})`} fill="currentColor" stroke="none" />;
}

const ICONS: Record<string, ReactNode> = {
  // Width on the bar.
  wide: (
    <>
      {BAR}
      <Hand x={4.6} />
      <Hand x={19.4} />
    </>
  ),
  close: (
    <>
      {BAR}
      <Hand x={8.8} />
      <Hand x={15.2} />
    </>
  ),
  // Which way the hands face.
  overhand: (
    <>
      {BAR}
      <Hand x={7} />
      <Hand x={17} />
    </>
  ),
  underhand: (
    <>
      {BAR}
      <Hand x={7} under />
      <Hand x={17} under />
    </>
  ),
  mixed: (
    <>
      {BAR}
      <Hand x={7} />
      <Hand x={17} under />
    </>
  ),
  neutral: (
    <>
      <path d="M8 5v14M16 5v14" />
      <SideHand x={8} />
      <SideHand x={16} />
    </>
  ),
  hook: (
    <>
      <circle cx={12} cy={12} r={6} />
      <path d="M8.5 9.5c1.5 2 5.5 2 7 0" />
      <path d="M8 14.5c2-1.5 6-1.5 8 0" strokeWidth={2.4} />
    </>
  ),
  thumbless: (
    <>
      {BAR}
      <Hand x={7} />
      <Hand x={17} />
      <path d="M4 17l4-3M20 17l-4-3" strokeDasharray="1.5 1.5" />
    </>
  ),
  // Bench angle and tempo.
  incline: (
    <>
      <path d="M4 19h16" />
      <path d="M7 19l9-11" strokeWidth={2.6} />
    </>
  ),
  decline: (
    <>
      <path d="M4 19h16" />
      <path d="M5 11l13 6" strokeWidth={2.6} />
    </>
  ),
  paused: (
    <>
      <circle cx={12} cy={12} r={8} />
      <path d="M10 9v6M14 9v6" />
    </>
  ),
  // Squat bar position: a head and shoulders, the bar high on the traps or lower on the back.
  "high-bar": (
    <>
      <circle cx={12} cy={6} r={2.5} />
      <path d="M6 18c0-4 2.5-7 6-7s6 3 6 7" />
      <path d="M3 10.5h18" strokeWidth={2.4} />
    </>
  ),
  "low-bar": (
    <>
      <circle cx={12} cy={6} r={2.5} />
      <path d="M6 18c0-4 2.5-7 6-7s6 3 6 7" />
      <path d="M3 14h18" strokeWidth={2.4} />
    </>
  ),
  // Lunges: a step forward or back.
  front: (
    <>
      <path d="M5 12h13M14 8l4 4-4 4" />
    </>
  ),
  // Stance seen from above.
  "wide-stance": (
    <>
      <Foot x={4.5} y={12} turn={-20} />
      <Foot x={19.5} y={12} turn={20} />
    </>
  ),
  "narrow-stance": (
    <>
      <Foot x={10} y={12} />
      <Foot x={14} y={12} />
    </>
  ),
  conventional: (
    <>
      {BAR}
      <Foot x={10} y={17} />
      <Foot x={14} y={17} />
      <Hand x={6} />
      <Hand x={18} />
    </>
  ),
  sumo: (
    <>
      {BAR}
      <Foot x={4} y={17} turn={-25} />
      <Foot x={20} y={17} turn={25} />
      <Hand x={9.5} />
      <Hand x={14.5} />
    </>
  ),
  deficit: (
    <>
      <Foot x={9} y={10} />
      <Foot x={15} y={10} />
      <path d="M4 15.5h16v3H4z" />
      <path d="M2 21h20" />
    </>
  ),
  "feet-elevated": (
    <>
      <path d="M3 18l12-5" strokeWidth={2.4} />
      <path d="M15 13h6v6h-6z" />
      <path d="M4 18v2" />
    </>
  ),
  "knees-down": (
    <>
      <path d="M4 12l10 4" strokeWidth={2.4} />
      <circle cx={15} cy={17} r={1.6} fill="currentColor" stroke="none" />
      <path d="M2 20h20M4 12v6" />
    </>
  ),
  // One dumbbell in one hand.
  "single-arm": (
    <>
      <path d="M4 12h16" strokeWidth={2.2} />
      <path d="M4 8v8M7 9v6M17 9v6M20 8v8" strokeWidth={2.2} />
      <Hand x={12} />
    </>
  ),
  "single-leg": (
    <>
      <Foot x={9} y={15} />
      <ellipse cx={16} cy={9} rx={1.6} ry={3.2} strokeDasharray="1.5 1.5" />
    </>
  ),
  seated: (
    <>
      <circle cx={10} cy={5} r={2} />
      <path d="M10 8v6h6v6M6 14h4M6 9v11" />
    </>
  ),
  standing: (
    <>
      <circle cx={12} cy={4.5} r={2} />
      <path d="M12 7.5v7M12 14.5l-3 6M12 14.5l3 6M8 10h8" />
    </>
  ),
  reverse: (
    <>
      <path d="M19 12H6M10 8l-4 4 4 4" />
    </>
  ),
  // Cable attachments, hanging from the cable at the top.
  "straight-bar": (
    <>
      <path d="M12 2v6" />
      <path d="M5 10h14" strokeWidth={2.6} />
      <path d="M12 8l-2 2M12 8l2 2" />
    </>
  ),
  "wide-bar": (
    <>
      <path d="M12 2v6" />
      <path d="M2 13l3-3h14l3 3" strokeWidth={2.4} />
      <path d="M12 8v2" />
    </>
  ),
  "v-handle": (
    <>
      <path d="M12 2v5" />
      <path d="M12 7l-5 11M12 7l5 11" strokeWidth={2.2} />
      <path d="M5.5 18h3M15.5 18h3" strokeWidth={2.4} />
    </>
  ),
  "mag-grip": (
    <>
      <path d="M12 2v5" />
      <path d="M4 9h16" strokeWidth={2.2} />
      <path d="M6 9v9M18 9v9" strokeWidth={2.4} />
    </>
  ),
  rope: (
    <>
      <path d="M12 2v6" />
      <path d="M12 8c-2 3-4 6-4.5 10M12 8c2 3 4 6 4.5 10" strokeWidth={2.2} />
      <circle cx={7.5} cy={19.5} r={1.8} fill="currentColor" stroke="none" />
      <circle cx={16.5} cy={19.5} r={1.8} fill="currentColor" stroke="none" />
    </>
  ),
  "single-handle": (
    <>
      <path d="M12 2v5" />
      <path d="M7 9.5c0-1.5 1-2.5 2.5-2.5h5C16 7 17 8 17 9.5V12c0 3.5-2 6-5 6s-5-2.5-5-6z" />
      <path d="M9 17.5h6" strokeWidth={2.6} />
    </>
  ),
  "ez-bar": (
    <>
      <path d="M12 2v6" />
      <path d="M3 10h3l2 2 2-2h4l2 2 2-2h3" strokeWidth={2.4} />
    </>
  ),
  "ankle-strap": (
    <>
      <path d="M12 2v5" />
      <rect x={7} y={9} width={10} height={6} rx={3} />
      <path d="M9 18h6l-1-3h-4z" fill="currentColor" stroke="none" />
    </>
  ),
};

export function VariationIcon({ variation, size = 20, className = "" }: { variation: string | undefined; size?: number; className?: string }) {
  const art = variation ? ICONS[variation] : null;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {art ?? (
        // Standard: the plain bar, hands at shoulder width.
        <>
          {BAR}
          <Hand x={7} />
          <Hand x={17} />
        </>
      )}
    </svg>
  );
}

export const HAS_ICON = (key: string) => key in ICONS;

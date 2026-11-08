import type { Equipment } from "@/types/workout";

/**
 * Line icons for gym equipment, drawn for ABOT because the icon set has no barbell, weight
 * stack, Smith machine or cable pulley. 24 px grid, 1.75 stroke, round caps, currentColor, to sit
 * with the Lucide icons used elsewhere. Without `equipment` it draws a plate ("all equipment").
 */
export function EquipmentIcon({ equipment, size = 22 }: { equipment?: Equipment; size?: number }) {
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
      className="shrink-0"
    >
      {SHAPES[equipment ?? "all"]}
    </svg>
  );
}

const SHAPES: Record<Equipment | "all", React.ReactNode> = {
  all: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 3.5v3M12 17.5v3" />
    </>
  ),
  barbell: (
    <>
      <path d="M1.5 12h21" />
      <rect x="4" y="6.5" width="2.5" height="11" rx="0.8" />
      <rect x="17.5" y="6.5" width="2.5" height="11" rx="0.8" />
      <rect x="6.5" y="8.5" width="2" height="7" rx="0.6" />
      <rect x="15.5" y="8.5" width="2" height="7" rx="0.6" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M8 12h8" />
      <rect x="3" y="7.5" width="5" height="9" rx="1.2" />
      <rect x="16" y="7.5" width="5" height="9" rx="1.2" />
    </>
  ),
  machine: (
    <>
      <path d="M5 21V3h14v18" />
      <rect x="8" y="10" width="8" height="9" rx="0.8" />
      <path d="M8 13h8M8 16h8M12 3v7" />
    </>
  ),
  smith_machine: (
    <>
      <path d="M5 3v18M19 3v18" />
      <path d="M2 10h20" />
      <rect x="6.5" y="6.5" width="2" height="7" rx="0.6" />
      <rect x="15.5" y="6.5" width="2" height="7" rx="0.6" />
    </>
  ),
  cable: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5v8.5" />
      <path d="M8 16h8l-1.5 4.5h-5z" />
    </>
  ),
  bodyweight: (
    <>
      <circle cx="12" cy="4.5" r="2" />
      <path d="M12 7.5v6.5M6 10l6-1.5 6 1.5M12 14l-3.5 7M12 14l3.5 7" />
    </>
  ),
  kettlebell: (
    <>
      <path d="M8.5 9a3.5 3.5 0 1 1 7 0" />
      <path d="M7 10.5h10a5.5 5.5 0 0 1 1 3.2A6 6 0 0 1 12 20a6 6 0 0 1-6-6.3 5.5 5.5 0 0 1 1-3.2z" />
    </>
  ),
  band: (
    <>
      <path d="M4 12c0-3 3.5-4.5 8-4.5s8 1.5 8 4.5-3.5 4.5-8 4.5S4 15 4 12z" />
      <path d="M7 12c0-1.2 2.2-2 5-2s5 .8 5 2-2.2 2-5 2-5-.8-5-2z" />
    </>
  ),
  other: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
};

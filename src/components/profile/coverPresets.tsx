import { useId, type ReactNode } from "react";
import type { CoverPresetId } from "@/lib/cover-presets";
import { FLAME_CORE, FLAME_MIDDLE, FLAME_OUTER } from "@/components/streak/flame-path";

/**
 * The ten drawn Profile covers, each a 600 x 200 SVG that fills the banner (slice), so they stay
 * sharp at any width and weigh nothing. Colours are fixed, not theme tokens: a cover is art and
 * looks the same in light and dark mode. Gradient ids are made unique per instance, since the
 * picker shows several at once.
 */
export function CoverArt({ id, className = "" }: { id: CoverPresetId; className?: string }) {
  const u = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className={`size-full ${className}`}>
      {ART[id](u)}
    </svg>
  );
}

const HEX = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

/** Deterministic pseudo-random numbers, so a cover draws the same every time. */
function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const ART: Record<CoverPresetId, (u: string) => ReactNode> = {
  "volt-glow": (u) => {
    const r = rand(7);
    return (
      <>
        <defs>
          <radialGradient id={`${u}g`} cx="0.78" cy="0.15" r="0.75">
            <stop offset="0" stopColor="#ccff00" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="#ccff00" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ccff00" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="600" height="200" fill="#09090b" />
        <rect width="600" height="200" fill={`url(#${u}g)`} />
        {Array.from({ length: 140 }, (_, i) => (
          <circle key={i} cx={r() * 600} cy={r() * 200} r={r() * 0.9 + 0.2} fill="#ccff00" opacity={r() * 0.35} />
        ))}
      </>
    );
  },
  inferno: (u) => (
    <>
      <defs>
        <linearGradient id={`${u}g`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#1a0505" />
          <stop offset="0.55" stopColor="#7f1d1d" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill={`url(#${u}g)`} />
      <g transform="translate(430 18) scale(1.1)" opacity="0.9">
        <path d={FLAME_OUTER} fill="#ea580c" />
        <path d={FLAME_MIDDLE} fill="#f59e0b" />
        <path d={FLAME_CORE} fill="#fde68a" />
      </g>
      <g transform="translate(330 90) scale(0.55)" opacity="0.5">
        <path d={FLAME_OUTER} fill="#ea580c" />
        <path d={FLAME_MIDDLE} fill="#f59e0b" />
      </g>
    </>
  ),
  "neon-grid": (u) => (
    <>
      <defs>
        <linearGradient id={`${u}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12002b" />
          <stop offset="0.55" stopColor="#4a044e" />
          <stop offset="0.56" stopColor="#0b0014" />
        </linearGradient>
        <linearGradient id={`${u}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#facc15" />
          <stop offset="1" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill={`url(#${u}s)`} />
      <circle cx="300" cy="110" r="58" fill={`url(#${u}sun)`} />
      {[78, 86, 94, 102].map((y, i) => (
        <rect key={y} x="230" y={y} width="140" height={2 + i} fill="#0b0014" />
      ))}
      <rect x="0" y="111" width="600" height="89" fill="#0b0014" />
      {Array.from({ length: 9 }, (_, i) => {
        const y = 112 + (i * i * 88) / 64;
        return <line key={`h${i}`} x1="0" y1={y} x2="600" y2={y} stroke="#22d3ee" strokeWidth="1" opacity={0.25 + i * 0.07} />;
      })}
      {Array.from({ length: 21 }, (_, i) => (
        <line key={`v${i}`} x1={300 + (i - 10) * 12} y1="112" x2={300 + (i - 10) * 80} y2="200" stroke="#e879f9" strokeWidth="1" opacity="0.55" />
      ))}
    </>
  ),
  "plate-honeycomb": (u) => (
    <>
      <defs>
        <linearGradient id={`${u}f`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ccff00" stopOpacity="0.05" />
          <stop offset="1" stopColor="#ccff00" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill="#111114" />
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 16 }, (_, col) => {
          const x = col * 46 + (row % 2) * 23 - 20;
          const y = row * 44 - 14;
          return <path key={`${row}-${col}`} d={HEX} transform={`translate(${x} ${y}) scale(0.42)`} fill="none" stroke={`url(#${u}f)`} strokeWidth="4" />;
        }),
      )}
      <path d={HEX} transform="translate(470 40) scale(1.3)" fill="#ccff00" opacity="0.12" />
    </>
  ),
  "brushed-steel": (u) => {
    const r = rand(11);
    return (
      <>
        <defs>
          <linearGradient id={`${u}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3f3f46" />
            <stop offset="0.4" stopColor="#a1a1aa" />
            <stop offset="0.55" stopColor="#e4e4e7" />
            <stop offset="0.7" stopColor="#71717a" />
            <stop offset="1" stopColor="#27272a" />
          </linearGradient>
        </defs>
        <rect width="600" height="200" fill={`url(#${u}g)`} />
        {Array.from({ length: 90 }, (_, i) => (
          <line key={i} x1="0" y1={i * 2.2 + r()} x2="600" y2={i * 2.2 + r()} stroke={r() > 0.5 ? "#ffffff" : "#000000"} strokeWidth="0.6" opacity={r() * 0.12} />
        ))}
      </>
    );
  },
  "gold-rush": (u) => (
    <>
      <defs>
        <linearGradient id={`${u}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0" />
          <stop offset="0.5" stopColor="#facc15" stopOpacity="0.55" />
          <stop offset="1" stopColor="#b45309" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill="#0c0a09" />
      {[60, 180, 330, 470].map((x, i) => (
        <polygon key={x} points={`${x},0 ${x + 40 + i * 6},0 ${x - 90 + i * 6},200 ${x - 130},200`} fill={`url(#${u}b)`} opacity={0.5 + i * 0.12} />
      ))}
      <line x1="0" y1="199" x2="600" y2="199" stroke="#facc15" strokeWidth="2" opacity="0.6" />
    </>
  ),
  "sunset-lift": (u) => (
    <>
      <defs>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#312e81" />
          <stop offset="0.5" stopColor="#db2777" />
          <stop offset="1" stopColor="#fb923c" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill={`url(#${u}g)`} />
      <circle cx="420" cy="120" r="38" fill="#fde68a" opacity="0.85" />
      <path d="M0 150 L80 105 L150 140 L240 80 L330 135 L420 95 L520 140 L600 110 L600 200 L0 200 Z" fill="#4c1d95" opacity="0.75" />
      <path d="M0 175 L110 135 L200 165 L300 125 L400 170 L500 140 L600 165 L600 200 L0 200 Z" fill="#1e1b4b" />
    </>
  ),
  terminal: () => {
    const r = rand(23);
    const rows = Array.from({ length: 9 }, () =>
      Array.from({ length: 6 }, () => `${Math.floor(r() * 5) + 1}x${Math.floor(r() * 8) + 5}`).join("  "),
    );
    return (
      <>
        <rect width="600" height="200" fill="#020a04" />
        {rows.map((line, i) => (
          <text key={i} x="12" y={22 + i * 21} fill="#22c55e" opacity={0.18 + (i % 3) * 0.08} fontFamily="monospace" fontSize="15" letterSpacing="2">
            {line}
          </text>
        ))}
        {Array.from({ length: 50 }, (_, i) => (
          <rect key={i} x="0" y={i * 4} width="600" height="1.2" fill="#000000" opacity="0.35" />
        ))}
        <rect x="470" y="150" width="11" height="18" fill="#4ade80" />
      </>
    );
  },
  topography: () => {
    const rings = (cx: number, cy: number, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const rx = 18 + i * 22;
        const ry = 10 + i * 13;
        return <ellipse key={`${cx}-${i}`} cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${-12 + i * 3} ${cx} ${cy})`} fill="none" stroke="#ccff00" strokeWidth="1" opacity={0.55 - i * 0.04} />;
      });
    return (
      <>
        <rect width="600" height="200" fill="#18181b" />
        {rings(440, 70, 11)}
        {rings(110, 170, 7)}
      </>
    );
  },
  "deep-ocean": (u) => (
    <>
      <defs>
        <linearGradient id={`${u}g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f766e" />
          <stop offset="1" stopColor="#0b1d3a" />
        </linearGradient>
      </defs>
      <rect width="600" height="200" fill={`url(#${u}g)`} />
      {[60, 95, 130, 165].map((y, i) => (
        <path
          key={y}
          d={`M0 ${y} C100 ${y - 22} 200 ${y + 22} 300 ${y} S500 ${y - 22} 600 ${y} L600 200 L0 200 Z`}
          fill="#0b1d3a"
          opacity={0.25 + i * 0.15}
        />
      ))}
      <path d="M0 60 C100 38 200 82 300 60 S500 38 600 60" fill="none" stroke="#5eead4" strokeWidth="1.5" opacity="0.6" />
    </>
  ),
};

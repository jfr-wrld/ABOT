"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Small drawn pieces for the body phase screens. Three macro colours only, all from the theme:
 * protein in Volt, carbs in the dim Volt, fat in the neutral line colour, so the figures read
 * as one family in light and dark.
 */
export const MACRO_COLOR = { protein: "var(--color-accent)", carbs: "var(--color-accent-dim)", fat: "var(--color-line-strong)" } as const;

/** A ring filled to `value / max`, drawn in on first show; children sit in the middle. */
export function Ring({
  value,
  max,
  size = 64,
  stroke = 6,
  color = "var(--color-accent)",
  children,
  label,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: reduce ? c * (1 - f) : c }}
          animate={{ strokeDashoffset: c * (1 - f) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>
    </span>
  );
}

/** Protein, carbs and fat as one bar split by their share of the calories. */
export function MacroBar({ protein, carbs, fat, className = "h-2" }: { protein: number; carbs: number; fat: number; className?: string }) {
  const kcal = [protein * 4, carbs * 4, fat * 9];
  const total = kcal.reduce((a, b) => a + b, 0) || 1;
  const colors = [MACRO_COLOR.protein, MACRO_COLOR.carbs, MACRO_COLOR.fat];
  return (
    <span aria-hidden="true" className={`flex w-full gap-0.5 overflow-hidden rounded-full ${className}`}>
      {kcal.map((k, i) =>
        k > 0 ? (
          <motion.span
            key={i}
            className="h-full"
            style={{ background: colors[i] }}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: k / total }}
            transition={{ type: "spring", stiffness: 140, damping: 22, delay: 0.1 + i * 0.06 }}
          />
        ) : null,
      )}
    </span>
  );
}

/** A donut of the three macros with the calories in the middle. */
export function MacroDonut({ protein, carbs, fat, size = 132, children }: { protein: number; carbs: number; fat: number; size?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const kcal = [protein * 4, carbs * 4, fat * 9];
  const total = kcal.reduce((a, b) => a + b, 0) || 1;
  const colors = [MACRO_COLOR.protein, MACRO_COLOR.carbs, MACRO_COLOR.fat];
  const gap = 3;
  let start = 0;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        {kcal.map((k, i) => {
          const len = Math.max(0, (k / total) * c - gap);
          const offset = -start;
          start += (k / total) * c;
          return (
            <motion.circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors[i]}
              strokeWidth={stroke}
              strokeDashoffset={offset}
              initial={{ strokeDasharray: reduce ? `${len} ${c}` : `0 ${c}` }}
              animate={{ strokeDasharray: `${len} ${c}` }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>
    </span>
  );
}

/** A tiny line of the last values; the latest point is marked. */
export function Sparkline({ values, width = 96, height = 32 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / span) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0">
      <motion.path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} />
      <circle cx={last[0]} cy={last[1]} r={3} fill="var(--color-accent)" />
    </svg>
  );
}

/** −5% … +5% change as a needle on a short track; centre is "no change". */
export function ChangeMeter({ pct }: { pct: number }) {
  const x = Math.max(-5, Math.min(5, pct));
  const left = 50 + x * 10;
  return (
    <span aria-hidden="true" className="relative block h-2 w-full rounded-full bg-track">
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
      <motion.span
        className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface ${x >= 0 ? "bg-accent" : "bg-failure"}`}
        initial={{ left: "50%" }}
        animate={{ left: `${left}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.2 }}
      />
    </span>
  );
}

/** Legend dots for the macro colours. */
export function MacroLegend({ protein, carbs, fat, labels }: { protein: number; carbs: number; fat: number; labels: [string, string, string] }) {
  const rows: [string, number, string][] = [
    [labels[0], protein, MACRO_COLOR.protein],
    [labels[1], carbs, MACRO_COLOR.carbs],
    [labels[2], fat, MACRO_COLOR.fat],
  ];
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map(([label, g, color]) => (
        <li key={label} className="flex items-center gap-2 text-sm">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="text-text-muted">{label}</span>
          <span className="num ml-auto font-bold">{g} g</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The block as a weight plate: one segment per week around a centre hole, lit in order as the
 * weeks pass (this week half-lit). The plate is ABOT's own mark, so the block reads as part of
 * the app rather than a generic progress ring.
 */
export function BlockPlate({ weeks, done, current, size = 168, children }: { weeks: number; done: number; current: number | null; size?: number; children?: ReactNode }) {
  const reduce = useReducedMotion();
  const c = size / 2;
  const outer = c - 2;
  const inner = c * 0.56;
  const gapDeg = weeks > 12 ? 2 : 3;
  const seg = 360 / weeks;
  const pt = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `${(c + r * Math.cos(a)).toFixed(2)},${(c + r * Math.sin(a)).toFixed(2)}`;
  };
  const arc = (i: number) => {
    const a0 = i * seg + gapDeg / 2;
    const a1 = (i + 1) * seg - gapDeg / 2;
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${pt(outer, a0)} A${outer},${outer} 0 ${large} 1 ${pt(outer, a1)} L${pt(inner, a1)} A${inner},${inner} 0 ${large} 0 ${pt(inner, a0)} Z`;
  };
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {Array.from({ length: weeks }, (_, i) => {
          const lit = i < done;
          const now = current !== null && i === current;
          const fill = lit ? "var(--color-accent)" : now ? "color-mix(in srgb, var(--color-accent) 45%, transparent)" : "var(--color-track)";
          return (
            <motion.path
              key={i}
              d={arc(i)}
              fill={fill}
              initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ transformOrigin: `${c}px ${c}px` }}
              transition={{ delay: reduce ? 0 : 0.05 + i * 0.045, type: "spring", stiffness: 260, damping: 22 }}
            />
          );
        })}
        <circle cx={c} cy={c} r={inner - 6} fill="none" stroke="var(--color-line)" strokeWidth={1} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>
    </span>
  );
}

/** The shape of each phase's body-weight line: falling, rising, flat with a cycle, stepped load. */
export function PhaseCurve({ phase, active, width = 120, height = 44 }: { phase: "CUTTING" | "BULKING" | "RECOMP" | "STRENGTH_PEAK"; active: boolean; width?: number; height?: number }) {
  const reduce = useReducedMotion();
  const paths = {
    CUTTING: "M4,8 C30,10 40,18 60,22 S95,34 116,38",
    BULKING: "M4,38 C30,36 40,28 60,24 S95,12 116,6",
    RECOMP: "M4,22 Q14,14 24,22 T44,22 T64,22 T84,22 T104,22 L116,22",
    STRENGTH_PEAK: "M4,38 L28,38 L28,28 L52,28 L52,18 L76,18 L76,8 L116,8",
  } as const;
  return (
    <svg width={width} height={height} viewBox="0 0 120 44" aria-hidden="true" className="block">
      <line x1={4} y1={42} x2={116} y2={42} stroke="var(--color-line)" strokeWidth={1} />
      <motion.path
        key={`${phase}-${active}`}
        d={paths[phase]}
        fill="none"
        stroke={active ? "var(--color-accent)" : "var(--color-line-strong)"}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/** A number with − and + either side: big figure, 44px buttons, keyboard and screen-reader friendly. */
export function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  unit,
  decimals = 0,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step: number;
  min: number;
  max: number;
  unit?: string;
  decimals?: number;
}) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
  const btn = "flex size-11 shrink-0 items-center justify-center rounded-ctl border border-ink/[0.12] bg-surface-2 text-text hover:border-ink/25 active:bg-press disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label={`${label}: −${step}`}>
        <span aria-hidden="true" className="text-lg font-bold">−</span>
      </button>
      <output aria-live="polite" className="num min-w-0 flex-1 text-center text-2xl font-bold">
        {value.toFixed(decimals)}
        {unit && <span className="ml-1 text-sm font-semibold text-text-muted">{unit}</span>}
      </output>
      <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label={`${label}: +${step}`}>
        <span aria-hidden="true" className="text-lg font-bold">+</span>
      </button>
    </div>
  );
}

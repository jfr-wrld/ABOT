"use client";

import { useEffect, useRef, useState } from "react";
import type { Exercise, MuscleGroup } from "@/types/workout";
import { CYCLE_SECONDS, GROUND, phaseAt, poseAt, rig, type Joints, type Pattern, type PhaseLabel } from "./patterns";
import type { Vec } from "./ik";

type Segment = "torso" | "upperArm" | "foreArm" | "thigh" | "shin";

/** Which body segments light up for a primary muscle. */
const SEGMENTS: Record<MuscleGroup, Segment[]> = {
  chest: ["torso"],
  back: ["torso"],
  lats: ["torso"],
  traps: ["torso"],
  lower_back: ["torso"],
  abs: ["torso"],
  neck: ["torso"],
  shoulders: ["upperArm"],
  biceps: ["upperArm"],
  triceps: ["upperArm"],
  forearms: ["foreArm"],
  quads: ["thigh"],
  hamstrings: ["thigh"],
  glutes: ["thigh"],
  adductors: ["thigh"],
  abductors: ["thigh"],
  calves: ["shin"],
  full_body: ["torso", "upperArm", "foreArm", "thigh", "shin"],
  cardio: [],
};

const NEAR = "#d4d4d8";
const FAR = "#52525b";
const ACCENT = "var(--color-accent)";

function Limb({ from, to, width, color, opacity = 1 }: { from: Vec; to: Vec; width: number; color: string; opacity?: number }) {
  return (
    <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={color} strokeOpacity={opacity} strokeWidth={width} strokeLinecap="round" />
  );
}

function Load({ at, equipment }: { at: Vec; equipment: Exercise["equipment"] }) {
  const [x, y] = at;
  switch (equipment) {
    case "barbell":
    case "smith_machine":
      return (
        <g>
          <circle cx={x} cy={y} r={11} fill="#27272a" stroke="#a1a1aa" strokeWidth={2} />
          <circle cx={x} cy={y} r={2.5} fill="#a1a1aa" />
        </g>
      );
    case "dumbbell":
      return <rect x={x - 6} y={y - 4} width={12} height={8} rx={2} fill="#a1a1aa" />;
    case "kettlebell":
      return (
        <g>
          <circle cx={x} cy={y + 7} r={6.5} fill="#a1a1aa" />
          <path d={`M${x - 4} ${y + 2} Q${x} ${y - 4} ${x + 4} ${y + 2}`} fill="none" stroke="#a1a1aa" strokeWidth={2} />
        </g>
      );
    case "cable":
      return <rect x={x - 5} y={y - 2} width={10} height={4} rx={1} fill="#a1a1aa" />;
    default:
      return null;
  }
}

function Figure({ j, lit }: { j: Joints; lit: Set<Segment> }) {
  const c = (s: Segment, near: boolean) => (lit.has(s) ? ACCENT : near ? NEAR : FAR);
  return (
    <g>
      {/* far side first so the near limbs overlap it */}
      <Limb from={j.hip} to={j.farKnee} width={8} color={c("thigh", false)} opacity={lit.has("thigh") ? 0.5 : 1} />
      <Limb from={j.farKnee} to={j.farAnkle} width={6.5} color={c("shin", false)} opacity={lit.has("shin") ? 0.5 : 1} />
      <Limb from={j.farAnkle} to={j.farToe} width={4} color={FAR} />
      <Limb from={j.shoulder} to={j.farElbow} width={6} color={c("upperArm", false)} opacity={lit.has("upperArm") ? 0.5 : 1} />
      <Limb from={j.farElbow} to={j.farHand} width={5} color={c("foreArm", false)} opacity={lit.has("foreArm") ? 0.5 : 1} />
      <Limb from={j.hip} to={j.shoulder} width={12} color={c("torso", true)} />
      <Limb from={j.shoulder} to={j.head} width={4} color={NEAR} />
      <circle cx={j.head[0]} cy={j.head[1]} r={8} fill={NEAR} />
      <Limb from={j.hip} to={j.knee} width={9} color={c("thigh", true)} />
      <Limb from={j.knee} to={j.ankle} width={7} color={c("shin", true)} />
      <Limb from={j.ankle} to={j.toe} width={4.5} color={NEAR} />
      <Limb from={j.shoulder} to={j.elbow} width={6.5} color={c("upperArm", true)} />
      <Limb from={j.elbow} to={j.hand} width={5.5} color={c("foreArm", true)} />
    </g>
  );
}

/** Static picture of a pattern at `progress` (0 = start pose, 1 = other end). */
export function MotionScene({
  pattern,
  progress,
  exercise,
  title,
}: {
  pattern: Pattern;
  progress: number;
  exercise: Pick<Exercise, "equipment" | "primaryMuscles">;
  title?: string;
}) {
  const j = rig(poseAt(pattern, progress));
  const lit = new Set(exercise.primaryMuscles.flatMap((m) => SEGMENTS[m]));
  const loadAt = pattern.loadAtFeet ? j.ankle : j.hand;
  return (
    <svg viewBox="0 -20 240 220" role="img" aria-label={title} className="block h-auto w-full">
      {title && <title>{title}</title>}
      <line x1={0} y1={GROUND} x2={240} y2={GROUND} stroke="#3f3f46" strokeWidth={2} />
      {pattern.props?.map((p, i) =>
        p.kind === "poly" ? (
          <polygon key={i} points={p.points.map((q) => q.join(",")).join(" ")} fill="#3f3f46" />
        ) : (
          <line key={i} x1={p.from[0]} y1={p.from[1]} x2={p.to[0]} y2={p.to[1]} stroke="#52525b" strokeWidth={p.width ?? 2} strokeLinecap="round" />
        ),
      )}
      {exercise.equipment === "cable" && pattern.anchor && (
        <>
          <circle cx={pattern.anchor[0]} cy={pattern.anchor[1]} r={4} fill="#52525b" />
          <line x1={pattern.anchor[0]} y1={pattern.anchor[1]} x2={j.hand[0]} y2={j.hand[1]} stroke="#71717a" strokeWidth={1.5} />
        </>
      )}
      <Figure j={j} lit={lit} />
      {pattern.tool === "wheel" ? (
        <circle cx={j.hand[0]} cy={GROUND - 8} r={8} fill="#27272a" stroke="#a1a1aa" strokeWidth={2} />
      ) : pattern.loadAtFeet ? (
        <line x1={loadAt[0] + 6} y1={loadAt[1] - 18} x2={loadAt[0] + 6} y2={loadAt[1] + 18} stroke="#a1a1aa" strokeWidth={4} strokeLinecap="round" />
      ) : (
        <Load at={loadAt} equipment={exercise.equipment} />
      )}
    </svg>
  );
}

/**
 * The animated rep. One requestAnimationFrame loop drives the cycle; when paused (or under
 * reduced motion) the figure rests where it stopped.
 */
export function MotionFigure({
  pattern,
  exercise,
  playing,
  onPhase,
}: {
  pattern: Pattern;
  exercise: Pick<Exercise, "name" | "equipment" | "primaryMuscles">;
  playing: boolean;
  onPhase: (label: PhaseLabel) => void;
}) {
  const [u, setU] = useState(0);
  const start = useRef<number | null>(null);
  const offset = useRef(0);
  const lastLabel = useRef<PhaseLabel | null>(null);

  useEffect(() => {
    if (!playing) {
      start.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (start.current === null) start.current = now - offset.current * CYCLE_SECONDS * 1000;
      const next = ((now - start.current) / (CYCLE_SECONDS * 1000)) % 1;
      offset.current = next;
      setU(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const phase = phaseAt(pattern, u);
  useEffect(() => {
    if (phase.label !== lastLabel.current) {
      lastLabel.current = phase.label;
      onPhase(phase.label);
    }
  }, [phase.label, onPhase]);

  return <MotionScene pattern={pattern} progress={phase.progress} exercise={exercise} title={`${exercise.name} animation`} />;
}

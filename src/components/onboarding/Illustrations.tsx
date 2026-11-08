"use client";

import { useEffect, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { Check, Dumbbell, House, Search, Trophy, WifiOff } from "lucide-react";

/*
 * The intro's three illustrations, drawn from ABOT's own parts (the set row, the rest capsule, the
 * hex plate) rather than stock art, each acting out what its slide says on a short loop. They are
 * decorative: the slide's heading and text carry the meaning. Reduced motion shows the end state.
 */

const LOOP = 3.6;
const SPRING = { type: "spring", stiffness: 300, damping: 24 } as const;

/** A phone outline at a fixed size, so the three scenes share one frame. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-[232px] w-[176px] overflow-hidden rounded-[30px] border border-white/[0.14] bg-black p-2.5 shadow-[0_0_0_6px_#121215]">
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-white/10" />
      {children}
    </div>
  );
}

/**
 * Slide 1: a finger taps the check, the row lights, a band of light passes, a record pops.
 * The loop is started from an effect: the intro's first slide mounts with initial animations
 * switched off (AnimatePresence initial={false}), which would otherwise leave it frozen.
 */
export function LogSetScene() {
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  useEffect(() => {
    void controls.start(reduce ? "still" : "loop");
  }, [controls, reduce]);

  const loop = (times: number[], ease: "easeInOut" | "easeOut" = "easeInOut") => ({
    duration: LOOP,
    repeat: Infinity,
    ease,
    times,
  });
  // One cycle: idle, finger travels in, presses at 35%, row stays lit until 85%, resets.
  const ROW_TIMES = [0, 0.3, 0.35, 0.85, 1];

  return (
    <div aria-hidden="true" className="relative flex w-full max-w-[320px] flex-col gap-2">
      <Row n={2} weight="100" reps="8" dim />
      <motion.div
        className="relative grid grid-cols-[36px_1fr_64px_44px_44px] items-center gap-1.5 overflow-hidden rounded-xl border border-white/[0.07] bg-surface p-1.5"
        animate={controls}
        variants={{
          still: { backgroundColor: "rgba(204, 255, 0, 0.08)", borderColor: "rgba(204, 255, 0, 0.3)" },
          loop: {
            backgroundColor: ["rgba(18, 18, 21, 1)", "rgba(18, 18, 21, 1)", "rgba(36, 44, 8, 1)", "rgba(36, 44, 8, 1)", "rgba(18, 18, 21, 1)"],
            borderColor: [
              "rgba(255, 255, 255, 0.07)",
              "rgba(255, 255, 255, 0.07)",
              "rgba(204, 255, 0, 0.3)",
              "rgba(204, 255, 0, 0.3)",
              "rgba(255, 255, 255, 0.07)",
            ],
            transition: loop(ROW_TIMES),
          },
        }}
      >
        <span className="num flex size-9 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-sm font-bold">3</span>
        <span className="num truncate text-[11px] text-text-muted">100 × 8</span>
        <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">102.5</span>
        <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">8</span>
        <motion.span
          className="flex size-11 items-center justify-center rounded-xl border border-white/[0.12] bg-surface-2 text-text-muted"
          animate={controls}
          variants={{
            still: { backgroundColor: "rgba(204, 255, 0, 1)", color: "rgba(0, 0, 0, 1)", borderColor: "rgba(204, 255, 0, 1)" },
            loop: {
              backgroundColor: ["rgba(28, 28, 33, 1)", "rgba(28, 28, 33, 1)", "rgba(204, 255, 0, 1)", "rgba(204, 255, 0, 1)", "rgba(28, 28, 33, 1)"],
              color: ["rgba(161, 161, 170, 1)", "rgba(161, 161, 170, 1)", "rgba(0, 0, 0, 1)", "rgba(0, 0, 0, 1)", "rgba(161, 161, 170, 1)"],
              borderColor: [
                "rgba(255, 255, 255, 0.12)",
                "rgba(255, 255, 255, 0.12)",
                "rgba(204, 255, 0, 1)",
                "rgba(204, 255, 0, 1)",
                "rgba(255, 255, 255, 0.12)",
              ],
              scale: [1, 1, 0.88, 1, 1],
              transition: loop([0, 0.3, 0.35, 0.42, 1]),
            },
          }}
        >
          <Check size={22} strokeWidth={3} />
        </motion.span>
        {/* The band of light that crosses a row when its set is ticked. */}
        <motion.span
          className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,transparent,rgb(204_255_0/0.35),transparent)]"
          style={{ x: -80 }}
          animate={controls}
          variants={{ still: { opacity: 0 }, loop: { x: [-80, -80, 340, 340], transition: loop([0, 0.36, 0.55, 1], "easeOut") } }}
        />
      </motion.div>
      <Row n={4} weight="" reps="" dim />

      {/* The record that the ticked set just set. */}
      <motion.span
        className="num absolute -top-3 right-14 inline-flex items-center gap-1 rounded-full border border-pr/50 bg-black px-2 py-0.5 text-[11px] font-semibold text-pr"
        style={{ opacity: 0 }}
        animate={controls}
        variants={{
          still: { opacity: 1 },
          loop: { opacity: [0, 0, 1, 1, 0], y: [8, 8, 0, 0, -4], scale: [0.8, 0.8, 1, 1, 0.95], transition: loop([0, 0.38, 0.46, 0.82, 0.9]) },
        }}
      >
        <Trophy size={11} /> PR
      </motion.span>

      {/* A fingertip: travels to the check, presses, lifts away. */}
      <motion.span
        className="absolute size-10 rounded-full border-2 border-white/70 bg-white/15"
        style={{ right: 2, top: 58, opacity: 0 }}
        animate={controls}
        variants={{
          still: { opacity: 0 },
          loop: {
            x: [60, 6, 0, 0, 60],
            y: [70, 8, 2, 2, 70],
            scale: [1, 1, 0.82, 1, 1],
            opacity: [0, 1, 1, 0, 0],
            transition: loop([0, 0.28, 0.35, 0.5, 1]),
          },
        }}
      />
    </div>
  );
}

function Row({ n, weight, reps, dim }: { n: number; weight: string; reps: string; dim?: boolean }) {
  return (
    <div className={`grid grid-cols-[36px_1fr_64px_44px_44px] items-center gap-1.5 rounded-xl border border-white/[0.07] bg-surface p-1.5 ${dim ? "opacity-45" : ""}`}>
      <span className="num flex size-9 items-center justify-center rounded-lg border border-white/10 text-sm font-bold">{n}</span>
      <span className="num text-[11px] text-text-muted">100 × 8</span>
      <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">{weight || "0"}</span>
      <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">{reps || "0"}</span>
      <span className="flex size-11 items-center justify-center rounded-xl border border-white/[0.12] text-text-muted">
        <Check size={22} strokeWidth={3} />
      </span>
    </div>
  );
}

/** Slide 2: a phone with the rest capsule above the dock, counting down inside the thumb's reach. */
export function RestScene() {
  const reduce = useReducedMotion();
  const [left, setLeft] = useState(90);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setLeft((s) => (s <= 75 ? 90 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [reduce]);
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div aria-hidden="true" className="relative">
      {/* The thumb's comfortable arc, drawn from the lower corner of the phone. */}
      <svg className="pointer-events-none absolute -bottom-4 -right-10 z-10 h-40 w-44 overflow-visible" viewBox="0 0 176 160" fill="none">
        <motion.path
          d="M170 158 C 150 80, 80 40, 8 52"
          stroke="#ccff00"
          strokeOpacity={0.55}
          strokeWidth={1.5}
          strokeDasharray="4 6"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
      <Phone>
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`h-7 rounded-lg border border-white/[0.07] ${i === 1 ? "bg-accent/10" : "bg-surface"}`} />
          ))}
        </div>
        <div className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1.5">
          <motion.div
            className="relative flex h-9 items-center gap-2 overflow-hidden rounded-full border border-accent/30 bg-black px-3"
            initial={reduce ? false : { y: 24, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ ...SPRING, delay: 0.5 }}
          >
            <span className="label-caps !text-[8px]">Rest</span>
            <span className="num text-sm font-extrabold text-accent">{clock}</span>
            <span className="ml-auto flex gap-2 text-text-muted">
              <span className="text-xs">−</span>
              <span className="text-xs">+</span>
            </span>
            <span className="absolute inset-x-3 bottom-0 h-px bg-white/10">
              <motion.span
                className="block h-full origin-left bg-accent"
                animate={{ scaleX: (left - 75) / 15 }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </span>
          </motion.div>
          <div className="flex h-10 items-center justify-around rounded-2xl border border-white/[0.08] bg-surface text-text-muted">
            <House size={14} />
            <Dumbbell size={14} className="text-accent" />
            <Search size={14} />
            <span className="size-3.5 rounded-sm border border-white/30" />
          </div>
        </div>
      </Phone>
    </div>
  );
}

/** Side-view plates, heaviest first: height and thickness in a 176-wide frame. */
const PLATES = [
  { h: 112, w: 14 },
  { h: 92, w: 12 },
  { h: 70, w: 10 },
];
/** Each plate's x on the sleeve, packed against the stop with a 3-unit gap, and the collar's. */
const placed = PLATES.map((p, i) => ({ ...p, x: 44 + PLATES.slice(0, i).reduce((n, q) => n + q.w + 3, 0) }));
const COLLAR_X = 44 + PLATES.reduce((n, q) => n + q.w + 3, 0);

/**
 * Slide 3: a barbell sleeve inside the phone is loaded plate by plate and clamped, with the
 * signal gone: everything is kept here, on this device.
 */
export function DeviceScene() {
  const reduce = useReducedMotion();
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setCycle((c) => c + 1), LOOP * 1000 + 600);
    return () => clearInterval(t);
  }, [reduce]);


  return (
    <div aria-hidden="true" className="relative">
      <Phone>
        <svg key={cycle} viewBox="0 0 156 190" className="h-[196px] w-full" fill="none">
          {/* The bar's sleeve and the stop it loads against. */}
          <rect x="8" y="91" width="140" height="8" rx="2" fill="#3f3f46" />
          <rect x="36" y="76" width="6" height="38" rx="1.5" fill="#71717a" />
          {placed.map((p, i) => (
            <motion.rect
              key={i}
              x={p.x}
              y={95 - p.h / 2}
              width={p.w}
              height={p.h}
              rx={2.5}
              fill="#ccff00"
              fillOpacity={1 - i * 0.18}
              initial={reduce ? false : { x: 140, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 + i * 0.32 }}
            />
          ))}
          {/* The collar clamps the plates on. */}
          <motion.rect
            x={COLLAR_X}
            y={84}
            width={9}
            height={22}
            rx={2}
            fill="#f4f4f5"
            initial={reduce ? false : { x: 120, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22, delay: 1.35 }}
          />
          <motion.text
            x="78"
            y="176"
            textAnchor="middle"
            className="num"
            fontSize="10"
            letterSpacing="1.5"
            fill="#a1a1aa"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          >
            SAVED ON DEVICE
          </motion.text>
        </svg>
      </Phone>
      <motion.span
        key={`signal-${cycle}`}
        className="absolute -right-3 -top-3 flex size-10 items-center justify-center rounded-full border border-white/15 bg-surface text-text-muted"
        initial={reduce ? false : { scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...SPRING, delay: 1.7 }}
      >
        <WifiOff size={18} />
      </motion.span>
    </div>
  );
}

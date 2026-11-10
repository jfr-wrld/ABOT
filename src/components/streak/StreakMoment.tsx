"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Share2 } from "lucide-react";
import dynamic from "next/dynamic";

// The share studio is not part of Home's first load; it is fetched in the background once the
// streak moment shows, so Share still works with no network.
const loadStudio = () => import("./StreakStudio");
const StreakStudio = dynamic(() => loadStudio().then((m) => m.StreakStudio), { ssr: false });
import { feedback } from "@/lib/feedback";
import { onBack } from "@/lib/native/back-stack";
import { useEffectsMode } from "@/components/layout/EffectsController";
import { markStreakShown, type StreakMoment as Moment } from "@/lib/streak-moment";
import { useT } from "@/i18n";
import { FLAME_CORE, FLAME_MIDDLE, FLAME_OUTER } from "./flame-path";

/**
 * How many times a loop of `duration` seconds repeats to fill about 8 s. The flame, embers and
 * glow used to loop for as long as the screen stayed open, redrawing a filtered SVG every frame;
 * after the moment has landed they come to rest.
 */
const LOOP_SECONDS = 8;
const loopsFor = (duration: number) => Math.max(1, Math.ceil(LOOP_SECONDS / duration));

/** Everything dramatic is timed from the moment the flame catches. */
const IGNITE = 0.35;
/** When the count rolls over to the new number. */
const ROLL = 0.85;
/** When this week's plate lights. */
const LIGHT = 1.15;
const VOLT = "#ccff00";
const EMBERS = 14;
const PLATE = "M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z";

// The flame in three layers, drawn for ABOT: a Volt body with a side tongue, a yellow heart, a
// near-white core. Each layer flickers on its own clock so the fire never repeats in step.
const OUTER = FLAME_OUTER;
const MIDDLE = FLAME_MIDDLE;
const CORE = FLAME_CORE;

const LAYERS = [
  { d: OUTER, fill: VOLT, duration: 1.5, scaleY: [1, 1.06, 0.97, 1.04, 1], skewX: [0, -2.5, 1.5, -1, 0] },
  { d: MIDDLE, fill: "#facc15", duration: 1.1, scaleY: [1, 0.95, 1.07, 0.98, 1], skewX: [0, 2, -2, 1, 0] },
  { d: CORE, fill: "#fffbe6", duration: 0.8, scaleY: [1, 1.08, 0.94, 1.05, 1], skewX: [0, -1.5, 1.5, 0, 0] },
] as const;

/**
 * The week streak grew. A spark rises in the dark and catches; the flame bursts up with a flash
 * and a ring, then keeps burning. The count rolls from the old number to the new one, and this
 * week's plate lights at the end of the row. One action closes it and opens the summary. With
 * the phone's reduced motion the finished screen appears without the movement; Lite effects keep
 * the opening and drop only the endless loops. Android's back closes it.
 */
export function StreakMoment({
  moment,
  sessionId,
  onClose,
}: {
  moment: Moment;
  /** The workout that grew the streak; left out when the lifter plays it again from Home. */
  sessionId?: string;
  onClose: () => void;
}) {
  const t = useT();
  // The moment plays even under Lite effects (it is short and rare); only the phone's own
  // "remove animations" setting stills it. Lite does drop the endless loops (embers, flicker).
  const reduce = useReducedMotion() ?? false;
  const effects = useEffectsMode();
  const loops = !reduce && effects === "full";
  const button = useRef<HTMLButtonElement>(null);
  const { before, after, weeks } = moment;
  const first = before === 0;

  const played = useRef(false);
  const [sharing, setSharing] = useState(false);
  // Mounted from the first Share tap on, so its close animation still plays afterwards.
  const [shared, setShared] = useState(false);
  useEffect(() => {
    void loadStudio();
  }, []);
  useEffect(() => {
    if (sessionId) markStreakShown(sessionId);
    // Finish was just tapped, so sound is allowed. Once, even when effects run twice in development.
    if (!played.current) feedback.streak();
    played.current = true;
    button.current?.focus();
    // Escape inside the share studio closes the studio only (its <dialog> handles it).
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]") && onClose();
    window.addEventListener("keydown", onKey);
    // Android's back closes it, instead of leaving the page or sending ABOT to the background.
    const offBack = onBack(onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      offBack();
    };
  }, [sessionId, onClose]);

  const at = (delay: number) => (reduce ? { duration: 0 } : { delay });

  return (
    // "user": the app's Lite setting turns motion off app-wide; here only the phone's setting counts.
    <MotionConfig reducedMotion="user">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-title"
      className="force-dark fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#09090b] text-text"
    >
      {/* The flash when the flame catches. */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, background: "radial-gradient(60% 45% at 50% 38%, rgb(204 255 0 / 0.55), transparent 70%)" }}
          animate={{ opacity: [0, 0.9, 0.25] }}
          transition={{ delay: IGNITE, duration: 0.7, times: [0, 0.15, 1] }}
        />
      )}
      {/* A slow glow that breathes under the flame for the first seconds. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[12%] mx-auto size-80 rounded-full"
        style={{ opacity: reduce ? 0.3 : 0, background: "radial-gradient(circle, rgb(204 255 0 / 0.35), transparent 65%)" }}
        animate={reduce ? undefined : { opacity: [0, 0.4, 0.25, 0.4], scale: [0.8, 1.05, 0.98, 1.05] }}
        transition={{ delay: IGNITE, duration: 3, times: [0, 0.2, 0.6, 1], repeat: loops ? loopsFor(3) : 0, repeatType: "mirror" }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] text-center">
        <Flame reduce={reduce} loops={loops} />

        <h1 id="streak-title" className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.22em] text-[#ccff00]">
          {!sessionId ? t("Your week streak") : first ? t("Streak started") : t("Streak extended")}
        </h1>

        <Count before={before} after={after} reduce={reduce} />
        <p className="text-base font-semibold">
          <span aria-hidden="true">{t.n(after, "week in a row", "weeks in a row")}</span>
          <span className="sr-only">{t.n(after, "{n}-week streak", "{n}-week streak")}</span>
        </p>

        <ol aria-label={t("Recent weeks")} className="mt-6 flex gap-2.5">
          {weeks.map((on, i) => {
            const current = i === weeks.length - 1;
            return (
              <li key={i} className="flex flex-col items-center gap-1.5">
                <motion.svg
                  viewBox="0 0 100 100"
                  width={30}
                  height={30}
                  aria-hidden="true"
                  style={current && !reduce ? { scale: 0.6, opacity: 0.4 } : undefined}
                  animate={current && !reduce ? { scale: [0.6, 1.35, 1], opacity: 1 } : undefined}
                  transition={current ? { ...at(LIGHT), duration: 0.45, times: [0, 0.6, 1] } : undefined}
                >
                  <path d={PLATE} fill="none" stroke={on ? VOLT : "rgb(255 255 255 / 0.25)"} strokeWidth={8} />
                  {on && (
                    // This week's plate starts as an outline and fills when it lights.
                    <motion.path
                      d={PLATE}
                      fill={VOLT}
                      style={{ filter: `drop-shadow(0 0 ${current ? 8 : 3}px rgb(204 255 0 / 0.6))` }}
                      // An SVG path takes its opacity as an attribute, so it starts from initial, not style.
                      initial={current && !reduce ? { opacity: 0 } : false}
                      animate={current && !reduce ? { opacity: 1 } : undefined}
                      transition={current ? { ...at(LIGHT), duration: 0.15 } : undefined}
                    />
                  )}
                </motion.svg>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${current ? "font-bold text-[#ccff00]" : "text-text-muted"}`}>
                  {current ? t("This wk") : `-${weeks.length - 1 - i}`}
                </span>
                <span className="sr-only">{on ? t("trained") : t("rest")}</span>
              </li>
            );
          })}
        </ol>

        <motion.p
          className="mt-6 max-w-[30ch] text-balance text-sm text-text-muted"
          style={reduce ? undefined : { opacity: 0, y: 8 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={at(LIGHT + 0.2)}
        >
          {weeks[weeks.length - 1]
            ? t("Train at least once next week to keep it burning.")
            : t("Train once this week to keep it burning.")}
        </motion.p>
      </div>

      <motion.div
        className="relative px-6 pb-[calc(24px+env(safe-area-inset-bottom))]"
        style={reduce ? undefined : { opacity: 0, y: 12 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
        transition={at(LIGHT + 0.35)}
      >
        <div className="mx-auto flex w-full max-w-[420px] gap-2">
          <motion.button
            type="button"
            onClick={() => {
              setShared(true);
              setSharing(true);
            }}
            whileTap={{ scale: 0.97 }}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-base font-semibold text-white hover:bg-white/10"
          >
            <Share2 aria-hidden="true" size={18} />
            {t("Share")}
          </motion.button>
          <motion.button
            ref={button}
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.97 }}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#ccff00] text-base font-bold text-[#09090b] shadow-[0_0_28px_rgb(204_255_0/0.35)] hover:brightness-110"
          >
            {t("Continue")}
          </motion.button>
        </div>
      </motion.div>
      {shared && <StreakStudio open={sharing} onClose={() => setSharing(false)} />}
    </div>
    </MotionConfig>
  );
}

/** The flame: a spark rises and catches, then three layers burn with embers drifting up. */
function Flame({ reduce, loops }: { reduce: boolean; loops: boolean }) {
  const embers = Array.from({ length: EMBERS }, (_, i) => ({
    x: ((i * 37) % 70) - 35,
    drift: (i % 2 ? 1 : -1) * (6 + (i % 4) * 4),
    size: 2 + (i % 3),
    delay: IGNITE + 0.1 + (i * 0.23) % 1.6,
    duration: 1.4 + (i % 4) * 0.25,
  }));
  return (
    <div aria-hidden="true" className="relative flex h-52 w-44 items-end justify-center">
      {!reduce && (
        <>
          {/* The spark before ignition. */}
          <motion.span
            className="absolute bottom-0 size-2 rounded-full bg-[#ccff00] shadow-[0_0_12px_#ccff00]"
            style={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0], y: [80, 20, -30, -40], scale: [0.6, 1, 1.4, 3] }}
            transition={{ duration: IGNITE + 0.05, times: [0, 0.3, 0.9, 1], ease: "easeOut" }}
          />
          {/* The ring that rolls out when it catches. */}
          <motion.span
            className="absolute bottom-6 size-40 rounded-full border-2 border-[#ccff00]"
            style={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: [0, 0.8, 0], scale: [0.3, 1.9] }}
            transition={{ delay: IGNITE, duration: 0.8, ease: "easeOut" }}
          />
          {loops &&
            embers.map((e, i) => (
            <motion.span
              key={i}
              className="absolute bottom-10 rounded-full"
              style={{ width: e.size, height: e.size, left: `calc(50% + ${e.x}px)`, opacity: 0, background: i % 3 ? "#ccff00" : "#facc15" }}
              animate={{ opacity: [0, 1, 0], y: [0, -150 - (i % 5) * 18], x: [0, e.drift] }}
              transition={{ delay: e.delay, duration: e.duration, repeat: loopsFor(e.duration), ease: "easeOut" }}
            />
          ))}
        </>
      )}
      <motion.svg
        viewBox="0 0 120 160"
        className="relative h-48 w-36 overflow-visible"
        style={{
          filter: "drop-shadow(0 0 22px rgb(204 255 0 / 0.55))",
          originY: 1,
          ...(reduce ? {} : { scale: 0, opacity: 0 }),
        }}
        animate={reduce ? undefined : { scale: [0, 1.28, 0.94, 1], opacity: 1 }}
        transition={{ delay: IGNITE, duration: 0.6, times: [0, 0.45, 0.75, 1], ease: "easeOut" }}
      >
        {LAYERS.map((l, i) => (
          <motion.path
            key={i}
            d={l.d}
            fill={l.fill}
            style={{ originX: 0.5, originY: 1 }}
            animate={loops ? { scaleY: [...l.scaleY], skewX: [...l.skewX] } : undefined}
            transition={{ delay: IGNITE + 0.5, duration: l.duration, repeat: loopsFor(l.duration), ease: "easeInOut" }}
          />
        ))}
      </motion.svg>
    </div>
  );
}

/** The old count slides up and away as the new one rises into place with a small pop. */
function Count({ before, after, reduce }: { before: number; after: number; reduce: boolean }) {
  const big = "num block text-7xl leading-none font-extrabold tracking-tight";
  if (reduce) {
    return (
      <span aria-hidden="true" className={`${big} mt-2 text-[#ccff00]`}>
        {after}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="relative mt-2 block h-[1.1em] overflow-hidden text-7xl">
      <motion.span
        className={`${big} text-text-muted`}
        style={{ y: "0%" }}
        animate={{ y: "-110%", opacity: 0 }}
        transition={{ delay: ROLL, duration: 0.3, ease: "easeIn" }}
      >
        {before}
      </motion.span>
      <motion.span
        className={`${big} absolute inset-x-0 top-0 text-[#ccff00]`}
        style={{ y: "110%", scale: 1 }}
        animate={{ y: "0%", scale: [1, 1.18, 1] }}
        transition={{ delay: ROLL + 0.12, duration: 0.5, ease: "easeOut", scale: { delay: ROLL + 0.3, duration: 0.35 } }}
      >
        {after}
      </motion.span>
    </span>
  );
}

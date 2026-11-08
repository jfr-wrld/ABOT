"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo, type Variants } from "framer-motion";
import { AbotMark } from "@/components/brand/AbotMark";
import { Button } from "@/components/ui/Button";
import { markOnboardingSeen } from "@/lib/onboarding";
import { DeviceScene, LogSetScene, RestScene } from "@/components/onboarding/Illustrations";

const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;
/** A swipe counts once the finger travels this far, or flicks faster than this. */
const SWIPE_PX = 60;
const SWIPE_VELOCITY = 400;

const slideVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 64, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { ...SPRING, staggerChildren: 0.07, delayChildren: 0.04 } },
  exit: (dir: number) => ({ x: dir * -64, opacity: 0, transition: { duration: 0.15 } }),
};
const itemVariants: Variants = {
  enter: { y: 14, opacity: 0 },
  center: { y: 0, opacity: 1, transition: SPRING },
  exit: { opacity: 0 },
};
/** The illustration travels further than the text, so the slide has depth as it moves. */
const artVariants: Variants = {
  enter: (dir: number) => ({ x: dir * 90, opacity: 0, scale: 0.94 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { type: "spring", stiffness: 220, damping: 26 } },
  exit: (dir: number) => ({ x: dir * -90, opacity: 0, transition: { duration: 0.15 } }),
};

/** Three things a new lifter needs before their first set; each one shows the real UI piece. */
const SLIDES = [
  {
    title: "Log a set in one tap",
    body: "Type the weight and reps, tap the check. Last time's numbers sit beside each set, and records light up as you beat them.",
    Visual: LogSetScene,
  },
  {
    title: "Rest sits by your thumb",
    body: "Tick a set and the rest countdown opens just above the dock, on every screen, with 15-second nudges and skip.",
    Visual: RestScene,
  },
  {
    title: "Your training stays on this phone",
    body: "Every workout saves to this device and works offline. Back it up to a file or your account whenever you like.",
    Visual: DeviceScene,
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [[index, dir], setPage] = useState<[number, number]>([0, 1]);
  const last = index === SLIDES.length - 1;
  const slide = SLIDES[index]!;

  function go(next: number) {
    if (next < 0 || next >= SLIDES.length) return;
    setPage([next, next > index ? 1 : -1]);
  }
  function finish(to: string) {
    markOnboardingSeen();
    router.replace(to);
  }
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) go(index + 1);
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) go(index - 1);
  }

  return (
    <main className="relative isolate flex min-h-[calc(100dvh-96px)] flex-1 flex-col overflow-hidden px-5 pt-4">
      <div className="flex items-center justify-between">
        <span className="text-accent">
          <AbotMark size={28} title="ABOT" />
        </span>
        {!last && (
          <button
            type="button"
            onClick={() => finish("/")}
            className="min-h-11 rounded-ctl px-3 text-sm font-semibold text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
          >
            Skip intro
          </button>
        )}
      </div>

      {/* A large plate behind the slides turns one flat per step, like a plate being loaded. */}
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute left-1/2 top-[18%] -z-0 size-[440px] -translate-x-1/2 text-white/[0.035]"
        animate={{ rotate: index * 60 }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
      >
        <path d="M27 8 L73 8 L96 50 L73 92 L27 92 L4 50 Z" fill="none" stroke="currentColor" strokeWidth={0.6} />
        <circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" strokeWidth={0.6} />
        <circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" strokeWidth={0.6} />
      </motion.svg>

      <section
        aria-roledescription="carousel"
        aria-label="Introduction"
        className="relative mt-6 flex flex-1 flex-col overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(index + 1);
          if (e.key === "ArrowLeft") go(index - 1);
        }}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={index}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${SLIDES.length}`}
            className="flex flex-1 cursor-grab touch-pan-y flex-col active:cursor-grabbing"
          >
            <motion.div custom={dir} variants={artVariants} className="flex min-h-64 items-center justify-center">
              <slide.Visual />
            </motion.div>
            <motion.h1 variants={itemVariants} className="mt-8 text-3xl font-bold leading-tight tracking-tight">
              {slide.title}
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-3 max-w-[34ch] text-base leading-relaxed text-text-muted">
              {slide.body}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </section>

      <div className="flex items-center justify-center gap-2 py-6" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <motion.span
            key={s.title}
            className="h-1.5 rounded-full"
            animate={{ width: i === index ? 24 : 6, backgroundColor: i === index ? "#ccff00" : "rgb(255 255 255 / 0.2)" }}
            transition={SPRING}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom))]">
        {last ? (
          <>
            <Button variant="primary" onClick={() => finish("/")} className="min-h-12 w-full text-base">
              Start training
            </Button>
            <Link
              href="/login"
              onClick={() => markOnboardingSeen()}
              className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
            >
              Back up with an account
            </Link>
          </>
        ) : (
          <Button variant="primary" onClick={() => go(index + 1)} className="min-h-12 w-full text-base">
            Next
          </Button>
        )}
      </div>
    </main>
  );
}

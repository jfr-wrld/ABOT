"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo, type Variants } from "framer-motion";
import { Check } from "lucide-react";
import { AbotMark } from "@/components/brand/AbotMark";
import { Button } from "@/components/ui/Button";
import { markOnboardingSeen } from "@/lib/onboarding";

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

/** Three things a new lifter needs before their first set; each one shows the real UI piece. */
const SLIDES = [
  {
    title: "Log a set in one tap",
    body: "Type the weight and reps, then tap the check. Your numbers from last time sit beside each set, one tap to reuse them.",
    Visual: SetRowVisual,
  },
  {
    title: "Rest runs up top",
    body: "Finish a set and the rest countdown opens in the capsule under the camera, on every screen, with 15-second nudges and skip.",
    Visual: IslandVisual,
  },
  {
    title: "Your training stays on this phone",
    body: "Workouts save to this device and keep working offline. Export a backup file from Settings whenever you want a copy.",
    Visual: PlateVisual,
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
    <main className="flex min-h-[calc(100dvh-96px)] flex-1 flex-col px-5 pt-4">
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
            <motion.div variants={itemVariants} className="flex min-h-56 items-center justify-center">
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

function SetRowVisual() {
  return (
    <div className="w-full max-w-[300px] rounded-xl border border-accent/20 bg-accent-tint p-1.5" aria-hidden="true">
      <div className="grid grid-cols-[36px_1fr_64px_44px_44px] items-center gap-1.5">
        <span className="num flex size-9 items-center justify-center rounded-lg border border-accent/25 bg-black/40 text-sm font-bold">1</span>
        <span className="num truncate text-[11px] text-text-muted">100 × 8</span>
        <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">102.5</span>
        <span className="num flex h-11 items-center justify-center rounded-ctl bg-well text-lg font-bold">8</span>
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-on-accent">
          <Check size={22} strokeWidth={3} />
        </span>
      </div>
    </div>
  );
}

function IslandVisual() {
  return (
    <div
      className="flex h-14 w-full max-w-[300px] items-center gap-2 rounded-[28px] border border-accent/25 bg-black px-5 shadow-[0_0_14px_rgb(204_255_0/0.14)]"
      aria-hidden="true"
    >
      <span className="label-caps">Rest</span>
      <span className="num text-xl font-extrabold text-accent">1:30</span>
    </div>
  );
}

function PlateVisual() {
  return (
    <span className="text-accent" aria-hidden="true">
      <AbotMark size={120} />
    </span>
  );
}

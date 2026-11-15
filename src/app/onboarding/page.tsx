"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, type PanInfo, type Variants } from "framer-motion";
import { AbotMark } from "@/components/brand/AbotMark";
import { Button } from "@/components/ui/Button";
import { markOnboardingSeen } from "@/lib/onboarding";
import { AppScene, DeviceScene, LogSetScene, RestScene } from "@/components/onboarding/Illustrations";
import { usePlatform } from "@/components/get-app/usePlatform";
import { APK_URL } from "@/lib/get-app";
import { Download } from "@/components/icons";
import { PlanSaved, PlanSetup, todaysPlanned } from "@/components/plan/PlanSetup";
import { applyPlan, type AppliedPlan } from "@/lib/apply-plan";
import { defaultAnswers } from "@/lib/training-plan";
import type { Routine } from "@/types/workout";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useT, type T } from "@/i18n";

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
const SLIDES = (t: T) =>
  [
    {
      title: t("Log a set in one tap"),
      body: t("Type weight and reps, tap the check. Last time sits beside each set."),
      Visual: LogSetScene,
    },
    {
      title: t("Rest sits by your thumb"),
      body: t("Tick a set and rest starts counting down, on every screen."),
      Visual: RestScene,
    },
    {
      title: t("Your training stays on this phone"),
      body: t("Saved on this phone, works offline. Back up anytime."),
      Visual: DeviceScene,
    },
  ];

/** Android browsers only: the one thing the web cannot do, and the app to get it. */
const APP_SLIDE = (t: T) => ({
  title: t("ABOT hits harder as an app (beta)"),
  body: t("Rest timer on the lock screen, an alarm with the screen off, reminders that arrive. Free beta."),
  Visual: AppScene,
});

export default function OnboardingPage() {
  const router = useRouter();
  const t = useT();
  const platform = usePlatform();
  const appSlide = platform === "android";
  const slides = appSlide ? [...SLIDES(t), APP_SLIDE(t)] : SLIDES(t);
  const [[index, dir], setPage] = useState<[number, number]>([0, 1]);
  // After the slides: set up the week, then start today's workout or go Home.
  const [planning, setPlanning] = useState(false);
  const [saved, setSaved] = useState<AppliedPlan | null>(null);
  const last = index === slides.length - 1;
  const slide = slides[index]!;

  function go(next: number) {
    if (next < 0 || next >= slides.length) return;
    setPage([next, next > index ? 1 : -1]);
  }
  // Android's permissions are asked when a feature first needs them (notifications when a
  // workout starts, location when a gym is pinned), and the full list after the first workout:
  // nothing stands between a new lifter and their first set.
  function finish(to: string) {
    markOnboardingSeen();
    router.replace(to);
  }
  function startFirst(r: Routine) {
    markOnboardingSeen();
    useWorkoutStore.getState().startFromRoutine(r);
    router.replace("/workout");
  }
  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_PX || info.velocity.x < -SWIPE_VELOCITY) go(index + 1);
    else if (info.offset.x > SWIPE_PX || info.velocity.x > SWIPE_VELOCITY) go(index - 1);
  }

  return (
    <main className="force-dark fixed inset-0 isolate z-30 flex h-dvh flex-col overflow-clip overscroll-none bg-bg px-5 pt-[calc(16px+env(safe-area-inset-top))]">
      {/* Logo, then the steps as segments (the same as the plan setup that follows, so the intro
          and the plan read as one run), then Skip in the app's glass. */}
      {!planning && (
        <div className="flex items-center gap-3">
          <span className="text-accent">
            <AbotMark size={28} title="ABOT" />
          </span>
          <ol aria-hidden="true" className="flex flex-1 gap-1">
            {slides.map((_, i) => (
              <li key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.12]">
                <motion.span className="block h-full origin-left rounded-full bg-accent" initial={false} animate={{ scaleX: i <= index ? 1 : 0 }} transition={SPRING} />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => finish("/")}
            className={`glass-icon flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-text ${last ? "invisible" : ""}`}
            tabIndex={last ? -1 : undefined}
          >
            {t("Skip intro")}
          </button>
        </div>
      )}
      {planning && (
        <span className="text-accent">
          <AbotMark size={28} title="ABOT" />
        </span>
      )}

      {planning ? (
        saved ? (
          <PlanSaved
            routines={Object.keys(saved.plan.routineIds).length}
            replaced={saved.replaced}
            kept={saved.kept}
            time={saved.plan.time}
            weekdays={saved.plan.weekdays}
            today={todaysPlanned(useRoutineStore.getState().routines, useReminderStore.getState().schedule)}
            onStart={startFirst}
            onHome={() => finish("/")}
          />
        ) : (
          <PlanSetup initial={defaultAnswers()} adjusting={false} onSave={(a) => setSaved(applyPlan(a))} onExit={() => finish("/")} exitLabel={t("Look around first")} />
        )
      ) : (
        <>
      <section
        aria-roledescription="carousel"
        aria-label={t("Introduction")}
        className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
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
            aria-label={t("{n} of {total}", { n: index + 1, total: slides.length })}
            className="flex flex-1 cursor-grab touch-pan-y flex-col active:cursor-grabbing"
          >
            {/* The scene fills the room above the words, standing on one soft light. */}
            <motion.div custom={dir} variants={artVariants} className="relative flex min-h-0 flex-1 items-center justify-center py-4">
              <div className="relative flex justify-center [@media(max-height:700px)]:[zoom:0.78] [@media(min-height:780px)]:[zoom:1.15]">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-8 left-1/2 h-16 w-[120%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgb(204_255_0/0.18),transparent)]"
                />
                <slide.Visual />
              </div>
            </motion.div>
            <motion.h1 variants={itemVariants} className="mt-2 text-[28px] font-bold leading-tight tracking-tight">
              {slide.title}
            </motion.h1>
            <motion.p variants={itemVariants} className="mt-2 max-w-[34ch] text-base leading-relaxed text-text-muted">
              {slide.body}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </section>

      <div className="flex flex-col gap-2 pb-[calc(16px+env(safe-area-inset-bottom))] pt-6">
        {last && appSlide ? (
          <>
            <a href={APK_URL} rel="noopener" className="tap flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent">
              <Download aria-hidden="true" size={18} />
              {t("Download for Android")}
            </a>
            <button
              type="button"
              onClick={() => setPlanning(true)}
              className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
            >
              {t("Keep using the web")}
            </button>
          </>
        ) : last ? (
          <>
            <Button variant="primary" onClick={() => setPlanning(true)} className="min-h-12 w-full text-base">
              {t("Start training")}
            </Button>
            <Link
              href="/login"
              onClick={() => markOnboardingSeen()}
              className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-text-muted transition-colors hover:bg-ink/[0.05] hover:text-text"
            >
              {t("Back up with an account")}
            </Link>
          </>
        ) : (
          <Button variant="primary" onClick={() => go(index + 1)} className="min-h-12 w-full text-base">
            {t("Next")}
          </Button>
        )}
      </div>
        </>
      )}
    </main>
  );
}

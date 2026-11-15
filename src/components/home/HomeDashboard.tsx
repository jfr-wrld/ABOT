"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotionConfig, useTransform, type MotionValue } from "framer-motion";
import { Activity, CalendarDays, Check, ChevronRight, Dumbbell, Flame, Layers, MapPin, Play, Plus, Bell, RotateCcw, SlidersHorizontal, Timer, TrendingDown, TrendingUp, Trophy, Pause } from "@/components/icons";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useLocationStore } from "@/store/useLocationStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button, PRESS_SPRING } from "@/components/ui/Button";
import { AbotWordmark } from "@/components/brand/AbotMark";
import { ExerciseThumb } from "@/components/exercise/ExerciseThumb";
import { CountFromZero, Rise, useEntrance, usePlayEntrance } from "@/components/motion/Entrance";
import { RecoveryMap } from "@/components/anatomy/RecoveryMap";
import { PhaseCommandCard } from "@/components/phase/PhaseCommandCard";
import { GetAppBanner } from "@/components/get-app/GetAppBanner";
import { AnnouncementBanner } from "@/components/remote/AnnouncementBanner";
import { REGIONS, regionsFor } from "@/components/anatomy/regions";
import { feedback } from "@/lib/feedback";
import { startOfWeek } from "@/lib/analytics";
import { Sheet } from "@/components/ui/Sheet";
import { regionTelemetry, sleepFactor } from "@/lib/muscle-recovery";
import { estimateCalories } from "@/lib/calorie-estimator";
import { useNow } from "@/lib/useNow";
import { countSets, formatDuration, sessionDurationSec, sessionVolume } from "@/lib/calc";
import { formatVolume, toDisplay } from "@/lib/units";
import {
  nextProtocol,
  routineMinutes,
  prCounts,
  relativeDay,
  weekStrip,
  weeklyFrequency,
  weeklyVolume,
  type NextProtocol,
} from "@/lib/home";
import type { Exercise, MuscleGroup, Routine, WorkoutSession } from "@/types/workout";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import type { Weekday } from "@/lib/notifications/schedule";
import { historyPath } from "@/lib/routes";
import { isoTime } from "@/lib/safe-date";
import { Ring } from "@/components/phase/visuals";
import { liveSet } from "@/lib/live-set";
import { useT, type T } from "@/i18n";
import { MuscleIcon } from "@/components/icons/MuscleIcon";
import { routineFocus, trainingFocus } from "@/lib/training-focus";
import { weekStreak } from "@/lib/analytics";
import { asRoutine, comeback, dismissWelcomeBack, welcomeBackDismissed } from "@/lib/comeback";
import { currentStreak, type StreakMoment as StreakMomentData } from "@/lib/streak-moment";
import { StreakMoment } from "@/components/streak/StreakMoment";
import { EmptyArt } from "@/components/ui/EmptyArt";
import { routineSummary } from "@/lib/routine-summary";
import { LiftList } from "@/components/routines/RoutineCard";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { useInbox } from "@/components/notifications/useInbox";
import { MuscleMap } from "@/components/anatomy/MuscleMap";
import { useSplashGone } from "@/components/animations/SplashScreen";

/** A machined module: Carbon fill, hairline edge, tight padding. */
const TILE = "rounded-card border border-line bg-surface p-3";
const SPRING = { type: "spring", stiffness: 300, damping: 26 } as const;

/**
 * Home as "today first": the week as one rail (trained days lit, planned days ringed, any day
 * tappable), the selected day as the one large card with its workout and Start, the week's
 * numbers on one row, then the body phase and the latest workouts. Every figure comes from
 * finished workouts on this device.
 */
export function HomeDashboard() {
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  // The running clock ticks inside ActiveCard; the rest of Home only needs the date.
  const now = useNow(60_000);

  const next = useMemo(() => nextProtocol(routines, sessions, schedule, now), [routines, sessions, schedule, now]);
  const days = useMemo(() => weekStrip(sessions, now, firstDayOfWeek), [sessions, now, firstDayOfWeek]);
  // The day the hero shows: today unless another day of this week was tapped.
  const [picked, setPicked] = useState<number | null>(null);
  const day = days.find((d) => d.start === picked) ?? days.find((d) => d.isToday) ?? days[0]!;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-4">
      <header className="flex flex-col gap-3">
        {/* Theme switch, the mark in the middle, notifications (owner, 2026-11-15). Settings
            moved to the gear on Profile. */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center">
          <ThemeToggle />
          <h1 className="justify-self-center">
            <AbotWordmark />
          </h1>
          <NotificationsBell />
        </div>
        <AnnouncementBanner />
        <WeekRail
          days={days}
          sessions={sessions}
          byId={byId}
          streak={weekStreak(sessions, now, firstDayOfWeek)}
          selected={day.start}
          onSelect={(start) => setPicked(days.find((d) => d.start === start)?.isToday ? null : start)}
        />
        <GetAppBanner />
      </header>

      {!active && <WelcomeBack now={now} />}

      {/* Stacked like a wallet (owner, 2026-11-15, after GoPay): the week's numbers on a Volt card
          behind, the day's card laid over its lower edge in front. */}
      <WalletStack
        activeId={active?.id ?? null}
        today={active ? <ActiveCard /> : <DayHero day={day} next={next} byId={byId} now={now} />}
        todayStrip={<TodayStrip next={next} />}
        week={<WeekCard now={now} />}
        weekStrip={<NumbersRow now={now} />}
      />

      <Rise step={0.07} order={2}>
        <PhaseCommandCard now={now} />
      </Rise>

      <Rise step={0.07} order={3}>
        <RecentWorkouts unit={weightUnit} byId={byId} now={now} />
      </Rise>
    </main>
  );
}

/** The stack plays once per session, so coming back to Home does not deal the cards again. */
const STACKED_KEY = "abot.home.stacked";

/**
 * The week's numbers and the day's card as a wallet stack: the Volt card behind, the day's card
 * laid 36px over its lower edge, so the back card's bottom corners stay hidden under the front
 * card's straight sides. On the first visit of a session the cards are dealt: the back card drops
 * into place, then the front one slides up over it and settles.
 */
/** The swap, for the strip on the card behind (its tap layer). */
const StackSwap = createContext<(() => void) | null>(null);

/** How far the back card peeks out above the front one, and how much smaller it sits. */
const PEEK = 64;
const BACK_SCALE = 0.96;
const STACK_SPRING = { type: "spring", stiffness: 380, damping: 32 } as const;

type CardMotion = { x: MotionValue<number>; y: MotionValue<number>; scale: MotionValue<number>; opacity: MotionValue<number> };

/** One card's position as motion values, so dragging and swapping never re-render the page. */
function useCardMotion(y: number, scale: number, opacity: number): CardMotion {
  const mx = useMotionValue(0);
  const my = useMotionValue(y);
  const ms = useMotionValue(scale);
  const mo = useMotionValue(opacity);
  return useMemo(() => ({ x: mx, y: my, scale: ms, opacity: mo }), [mx, my, ms, mo]);
}

/**
 * The day's card and the week's as a wallet (owner, 2026-11-15): two cards with a fixed identity,
 * each always mounted with both faces, its full card and its Volt strip. The one in front shows its
 * full face; the one behind sits 64 px higher, a touch smaller, showing its strip. A swap moves the
 * cards, it never swaps their contents, and only transforms and opacity change, all on motion
 * values: no re-render per frame and nothing mounted mid-swap.
 *
 * The front card follows a sideways drag with no limit, tilting as it goes, while the card behind
 * rises to meet it. Let go past 30% of the width (or flick it) and it flies off that way as the
 * other takes its place, then drops back in behind; short of that it springs home. A tap on the
 * strip, or a sideways swipe on it, does the same. On the first visit of a session the cards are dealt.
 */
function WalletStack({
  activeId,
  today,
  todayStrip,
  week,
  weekStrip,
}: {
  activeId: string | null;
  today: ReactNode;
  todayStrip: ReactNode;
  week: ReactNode;
  weekStrip: ReactNode;
}) {
  const reduce = useReducedMotionConfig();
  // The front is kept here, not in Home: a swap then re-renders only this stack, and the two
  // cards, handed in as elements, are skipped by React (measured: re-rendering all of Home made
  // the frame after a swap the slowest one).
  const [front, onFront] = useHomeFront(activeId);
  const back: HomeSide = front === "today" ? "week" : "today";
  // Pages mount with AnimatePresence initial={false}, which skips `initial`: the deal starts from
  // these values and runs from an effect.
  const [deal] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      if (sessionStorage.getItem(STACKED_KEY)) return false;
      sessionStorage.setItem(STACKED_KEY, "1");
    } catch {
      // Without storage the cards are dealt on each visit.
    }
    return true;
  });
  const play = deal && !reduce;
  const at = (side: HomeSide) =>
    side === front ? [play ? PEEK + 70 : PEEK, 1, play ? 0 : 1] : [play ? -26 : 0, play ? 0.92 : BACK_SCALE, play ? 0 : 1];
  const [tY, tS, tO] = at("today");
  const [wY, wS, wO] = at("week");
  const todayMotion = useCardMotion(tY!, tS!, tO!);
  const weekMotion = useCardMotion(wY!, wS!, wO!);
  const cards = useMemo(() => ({ today: todayMotion, week: weekMotion }), [todayMotion, weekMotion]);
  const todayTilt = useTransform(todayMotion.x, (v) => v / 25);
  const weekTilt = useTransform(weekMotion.x, (v) => v / 25);

  // Dealt once the splash has gone, so the stack is seen being built, not behind it.
  const splashGone = useSplashGone((s) => s.gone);
  const dealt = useRef(false);
  useEffect(() => {
    if (!play || !splashGone || dealt.current) return;
    dealt.current = true;
    const f = cards[front];
    const b = cards[back];
    void animate(b.y, 0, { type: "spring", stiffness: 260, damping: 22, delay: 0.05 });
    void animate(b.scale, BACK_SCALE, { type: "spring", stiffness: 260, damping: 22, delay: 0.05 });
    void animate(b.opacity, 1, { duration: 0.2, delay: 0.05 });
    void animate(f.y, PEEK, { type: "spring", stiffness: 240, damping: 20, delay: 0.25 });
    void animate(f.opacity, 1, { duration: 0.2, delay: 0.25 });
  }, [play, splashGone, cards, front, back]);

  // When the front changes without a swap (a workout starts or ends), the cards move to their places.
  const committing = useRef(false);
  useEffect(() => {
    if (committing.current) return;
    const f = cards[front];
    const b = cards[back];
    const how = reduce ? { duration: 0 } : STACK_SPRING;
    for (const [mv, to] of [
      [f.x, 0],
      [f.y, PEEK],
      [f.scale, 1],
      [f.opacity, 1],
      [b.x, 0],
      [b.y, 0],
      [b.scale, BACK_SCALE],
      [b.opacity, 1],
    ] as const)
      if (dealt.current || !play) void animate(mv, to, how);
  }, [front, back, cards, reduce, play]);

  // The card on its way forward shows its full face already, as it rises.
  const [promoting, setPromoting] = useState<HomeSide | null>(null);
  const stack = useRef<HTMLDivElement>(null);
  const width = () => stack.current?.offsetWidth ?? 400;
  const commit = async (dir: 1 | -1) => {
    if (committing.current) return;
    committing.current = true;
    feedback.tick();
    const f = cards[front];
    const b = cards[back];
    if (reduce) {
      onFront(back);
      committing.current = false;
      return;
    }
    setPromoting(back);
    void animate(b.y, PEEK, STACK_SPRING);
    void animate(b.scale, 1, STACK_SPRING);
    await Promise.all([animate(f.x, dir * (width() + 60), { duration: 0.24, ease: [0.32, 0, 0.67, 0] }), animate(f.opacity, 0, { duration: 0.24 })]);
    // The card that left comes back behind: from just above, out of sight, then it drops in.
    f.x.set(0);
    f.y.set(-16);
    f.scale.set(BACK_SCALE);
    onFront(back);
    setPromoting(null);
    void animate(f.y, 0, STACK_SPRING);
    await animate(f.opacity, 1, { duration: 0.2 });
    committing.current = false;
  };
  const swap = () => void commit(-1);

  // A drag that ends a gesture must not also press what it started on (Start, a tile, a link).
  const [dragged, setDragged] = useState(false);
  // Links and photos would start the browser's own drag (pulled out of the page) and cancel ours.
  useEffect(() => {
    const el = stack.current;
    if (!el) return;
    const stop = (e: DragEvent) => e.preventDefault();
    el.addEventListener("dragstart", stop);
    return () => el.removeEventListener("dragstart", stop);
  }, []);
  const swallow = (e: React.MouseEvent) => {
    if (!dragged) return;
    e.preventDefault();
    e.stopPropagation();
    setDragged(false);
  };

  const faces: Record<HomeSide, { full: ReactNode; strip: ReactNode }> = {
    today: { full: today, strip: todayStrip },
    week: { full: week, strip: weekStrip },
  };
  // The hidden face fades by opacity alone, on its own layer; `inert` and aria-hidden take it out
  // of reach and of the accessibility tree. (Toggling `visibility`, which every element inside
  // inherits, recalculated the style of the whole card at the swap: the slowest frame, measured.)
  const shown = (on: boolean): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    pointerEvents: on ? undefined : "none",
    transition: "opacity 150ms ease",
    willChange: "opacity",
  });

  return (
    <div ref={stack} className="grid pb-16 [contain:layout]">
      {(["today", "week"] as const).map((side) => {
        const isFront = side === front;
        const m = cards[side];
        const full = isFront || promoting === side;
        return (
          <motion.div
            key={side}
            className="relative origin-top [grid-area:1/1]"
            // On their own layers from the start, so the first frame of a drag paints nothing.
            style={{ x: m.x, y: m.y, scale: m.scale, opacity: m.opacity, rotate: side === "today" ? todayTilt : weekTilt, zIndex: isFront ? 10 : 0, touchAction: "pan-y", willChange: "transform" }}
            drag={isFront ? "x" : false}
            dragMomentum={false}
            onPointerDown={() => setDragged(false)}
            onDragStart={() => setDragged(true)}
            onDrag={(_, info) => {
              const p = Math.min(Math.abs(info.offset.x) / 140, 1);
              cards[back].y.set(p * 10);
              cards[back].scale.set(BACK_SCALE + (1 - BACK_SCALE) * p);
            }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > width() * 0.3 || Math.abs(info.velocity.x) > 500) {
                void commit(info.offset.x < 0 ? -1 : 1);
                return;
              }
              void animate(m.x, 0, STACK_SPRING);
              void animate(cards[back].y, 0, STACK_SPRING);
              void animate(cards[back].scale, BACK_SCALE, STACK_SPRING);
            }}
            // Behind, the strip answers a sideways swipe too (it is too short to follow the finger).
            onPanStart={isFront ? undefined : () => setDragged(true)}
            onPanEnd={
              isFront
                ? undefined
                : (_, info) => {
                    if (Math.abs(info.offset.x) > 60 || Math.abs(info.velocity.x) > 500) void commit(info.offset.x < 0 ? -1 : 1);
                  }
            }
            onClickCapture={swallow}
          >
            <div className={isFront ? "wallet-front" : ""} style={shown(full)} inert={!full} aria-hidden={!full || undefined}>
              {faces[side].full}
            </div>
            <div className="absolute inset-0 flex flex-col" style={shown(!full)} inert={full} aria-hidden={full || undefined}>
              <StackSwap.Provider value={swap}>{faces[side].strip}</StackSwap.Provider>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

type HomeSide = "today" | "week";
const FRONT_KEY = "abot.home.front";
const FRONT_DURING_KEY = "abot.home.frontDuring";

/**
 * Which card leads Home: the day's (or the workout's) or the week's. The last swap is remembered
 * on this phone and opens Home that way next time. While a workout runs its card comes forward
 * (owner, 2026-11-15); a swap then holds for that workout only, and the saved choice is left alone.
 */
function useHomeFront(activeId: string | null): [HomeSide, (side: HomeSide) => void] {
  const read = (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Without storage the choice lasts until the page closes.
    }
  };
  const [saved, setSaved] = useState<HomeSide>(() => (read(FRONT_KEY) === "week" ? "week" : "today"));
  // A swap during a workout is kept for that workout (by its id), across pages and restarts.
  const [during, setDuring] = useState<{ id: string; side: HomeSide } | null>(() => {
    const [id, side] = (read(FRONT_DURING_KEY) ?? "").split("|");
    return id && (side === "week" || side === "today") ? { id, side } : null;
  });
  const front: HomeSide = activeId ? (during?.id === activeId ? during.side : "today") : saved;
  const set = (side: HomeSide) => {
    if (activeId) {
      setDuring({ id: activeId, side });
      write(FRONT_DURING_KEY, `${activeId}|${side}`);
      return;
    }
    setSaved(side);
    write(FRONT_KEY, side);
  };
  return [front, set];
}

/** The bell at the top right of Home, with a dot and count while something is new. */
function NotificationsBell() {
  const t = useT();
  const { unreadCount } = useInbox();
  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? t("Notifications, {n} new", { n: unreadCount }) : t("Notifications")}
      className="glass-icon relative flex size-11 items-center justify-center rounded-full text-text"
    >
      <Bell aria-hidden="true" size={22} variant="bold" />
      {unreadCount > 0 && (
        <span aria-hidden="true" className="num absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-on-accent ring-2 ring-bg">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

/* ---------------------------------------------------------------- welcome back */

/**
 * After ten days or more without a workout: no count of missed days, no broken streak, just
 * the last workout ready to repeat. The Coach Pill starts that session lighter (comeback).
 */
function WelcomeBack({ now }: { now: number }) {
  const t = useT();
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);
  const back = useMemo(() => comeback(sessions, now), [sessions, now]);
  const [hidden, setHidden] = useState(false);
  if (!back || hidden || welcomeBackDismissed(back.last.id)) return null;
  const { last } = back;

  return (
    <section aria-labelledby="welcome-back" className={`${TILE} flex flex-col gap-3 p-4`}>
      <div>
        <p className="field-label text-accent">{t("Welcome back")}</p>
        <h2 id="welcome-back" className="mt-1 text-lg font-bold tracking-tight">
          {t("Pick up where you left off")}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {t("Last time: {name}, {n} days ago. Today's Coach targets start about 10% lighter.", { name: last.name, n: back.days })}
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <Button
          variant="primary"
          onClick={() => {
            useWorkoutStore.getState().startFromRoutine(asRoutine(last));
            router.push("/workout");
          }}
          className="min-h-12 text-base"
        >
          <RotateCcw aria-hidden="true" size={18} />
          <span className="truncate">{t("Repeat {name}", { name: last.name })}</span>
        </Button>
        <Button
          onClick={() => {
            dismissWelcomeBack(last.id);
            setHidden(true);
          }}
          className="min-h-12 !bg-transparent"
        >
          {t("Not now")}
        </Button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- week rail */

/** Long weekday name for Date#getDay numbering (7 Jan 2024 was a Sunday). */
const weekdayLong = (t: T, wd: number) => new Date(2024, 0, 7 + wd).toLocaleDateString(t.locale, { weekday: "long" });

/**
 * The week as seven tappable days, the strip and the plan in one: a trained day shows the muscle
 * that got the most sets with its focus (Push, Pull...), a planned day still to come a Volt ring
 * with the focus of its workout, the rest a dot. Tapping a day shows it in the hero. Above: the
 * month, the streak, and the plan (days and time) with Adjust.
 */
function WeekRail({
  days,
  sessions,
  byId,
  streak,
  selected,
  onSelect,
}: {
  days: ReturnType<typeof weekStrip>;
  sessions: WorkoutSession[];
  byId: Record<string, Exercise>;
  streak: number;
  selected: number;
  onSelect: (start: number) => void;
}) {
  const t = useT();
  const controls = useEntrance();
  const reduce = useReducedMotionConfig();
  const firstDay = useSettingsStore((st) => st.firstDayOfWeek);
  const schedule = useReminderStore((s) => s.schedule);
  const routines = useRoutineStore((s) => s.routines);
  const [replay, setReplay] = useState<StreakMomentData | null>(null);
  const planDays = schedule.enabled ? ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).filter((wd) => schedule.days[wd].on).length : 0;

  const cells = useMemo(
    () =>
      days.map((d) => {
        const wd = new Date(d.start).getDay() as Weekday;
        if (d.trained) {
          const f = trainingFocus(sessions.filter((s) => s.status === "completed" && s.startedAt >= d.start && s.startedAt < d.start + 86_400_000), byId);
          return { kind: "trained" as const, focus: f, label: f?.label ?? null };
        }
        const plan = schedule.enabled && schedule.days[wd].on && (d.isToday || d.isFuture);
        if (plan) {
          const r = routines.find((x) => x.id === schedule.days[wd].routineId);
          return { kind: "planned" as const, focus: null, label: r ? (routineFocus(r, byId)?.label ?? null) : null };
        }
        return { kind: "none" as const, focus: null, label: null };
      }),
    [days, sessions, byId, schedule, routines],
  );
  const month = new Date(days[0]!.start).toLocaleDateString(t.locale, { month: "long", year: "numeric" });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="field-label truncate">{month}</p>
        <div className="-my-2 -mr-2 flex shrink-0 items-center">
          {streak > 0 && (
            // The streak plays its flame again on a tap, the same screen as after Finish.
            <button
              type="button"
              onClick={() => setReplay(currentStreak(sessions, Date.now(), firstDay))}
              aria-haspopup="dialog"
              aria-label={t.n(streak, "{n}-week streak", "{n}-week streak")}
              className="tap num flex min-h-11 items-center gap-1 rounded-ctl px-2 text-xs font-bold text-accent hover:bg-accent/10"
            >
              <Flame aria-hidden="true" size={14} />
              <span aria-hidden="true">{t("{n} wk", { n: streak })}</span>
            </button>
          )}
          {planDays > 0 ? (
            <Link
              href="/plan"
              aria-label={t("Adjust your plan")}
              className="tap num flex min-h-11 items-center gap-1.5 rounded-ctl px-2 text-xs font-bold text-text-muted hover:bg-surface hover:text-text"
            >
              <span>{t("{n} days · {time}", { n: planDays, time: schedule.time })}</span>
              <SlidersHorizontal aria-hidden="true" size={14} className="text-accent" />
            </Link>
          ) : (
            <Link
              href="/plan"
              className="tap flex min-h-11 items-center gap-1 rounded-ctl px-2 text-xs font-bold text-accent hover:bg-accent/10"
            >
              <CalendarDays aria-hidden="true" size={14} />
              {t("Set up week")}
            </Link>
          )}
        </div>
      </div>
      {replay && <StreakMoment moment={replay} onClose={() => setReplay(null)} />}
      <ol aria-label={t("This week")} className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const date = new Date(d.start);
          const c = cells[i]!;
          const on = d.start === selected;
          const status =
            c.kind === "trained" ? t("trained") : d.isToday ? (c.kind === "planned" ? t("today, planned") : t("today")) : c.kind === "planned" ? t("planned") : d.isFuture ? "" : t("rest");
          return (
            <li key={d.start}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(d.start)}
                className={`tap flex w-full flex-col items-center gap-1 rounded-xl py-1.5 transition-colors ${on ? "tile border border-line bg-surface" : "hover:bg-surface/60"}`}
              >
                <span aria-hidden="true" className={`field-label ${d.isToday ? "!text-text" : ""}`}>
                  {date.toLocaleDateString(t.locale, { weekday: "narrow" })}
                </span>
                <span aria-hidden="true" className={`num text-xs font-bold leading-none ${d.isToday || on ? "text-text" : "text-text-muted"}`}>
                  {date.getDate()}
                </span>
                <span aria-hidden="true" className="relative flex size-10 items-center justify-center">
                  {c.kind === "trained" ? (
                    <motion.span
                      className={`tile flex size-full items-center justify-center rounded-lg border bg-accent-tint ${d.isToday ? "border-accent" : "border-accent/40"}`}
                      style={{ scale: 0.4, opacity: 0 }}
                      animate={controls}
                      variants={{
                        still: { scale: 1, opacity: 1 },
                        show: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 420, damping: 18, delay: 0.15 + i * 0.06 } },
                      }}
                    >
                      {c.focus ? <MuscleIcon muscle={c.focus.muscle} size={28} /> : <Check size={16} strokeWidth={3} className="text-accent" />}
                    </motion.span>
                  ) : c.kind === "planned" ? (
                    // A training day still to come: a ring where the muscle will light up, set into a
                    // small sunken well like an empty slot.
                    <span className="sunk flex size-full items-center justify-center rounded-lg bg-surface-2">
                      <motion.span
                        className={`size-3.5 rounded-full border-2 ${d.isToday ? "border-accent" : "border-accent/60"}`}
                        animate={d.isToday && !reduce ? { scale: [1, 1.25, 1] } : undefined}
                        transition={{ duration: 2.4, repeat: 2, ease: "easeInOut" }}
                      />
                    </span>
                  ) : (
                    <span className={`size-1.5 rounded-full ${d.isToday ? "bg-text" : "bg-ink/20"}`} />
                  )}
                </span>
                <span aria-hidden="true" className={`h-3 max-w-full truncate px-0.5 text-[10px] font-semibold leading-3 ${c.kind === "planned" ? "text-text" : "text-text-muted"}`}>
                  {c.label ? t(c.label) : ""}
                </span>
                <span className="sr-only">
                  {date.toLocaleDateString(t.locale, { weekday: "long", day: "numeric" })}
                  {c.label && `, ${t(c.label)}`}
                  {status && `, ${status}`}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ---------------------------------------------------------------- hero */

/** The muscles a routine works, as a small front and back map beside its name. */
function HeroMuscles({ routine, byId }: { routine: Routine; byId: Record<string, Exercise> }) {
  const muscles = routineSummary(routine, byId).muscles;
  if (muscles.length === 0) return null;
  return (
    <div className="w-24 shrink-0 [&_figcaption]:hidden">
      <MuscleMap primary={muscles} width={96} />
    </div>
  );
}

/** The muscles a finished workout worked: its lifts with a done set, or all its lifts when none is ticked. */
function sessionMuscles(s: WorkoutSession, byId: Record<string, Exercise>): MuscleGroup[] {
  const done = s.exercises.filter((e) => e.sets.some((st) => st.completed));
  return [...new Set((done.length ? done : s.exercises).flatMap((e) => byId[e.exerciseId]?.primaryMuscles ?? []))];
}

/** The routine's lifts folded under "See exercises", as on the routine cards. */
function HeroLifts({ routine, byId }: { routine: Routine; byId: Record<string, Exercise> }) {
  const t = useT();
  const sum = routineSummary(routine, byId);
  return (
    <div className="relative -mt-3">
      <LiftList
        items={sum.lines.map((l) => ({
          name: byId[l.exerciseId]?.name ?? t("Removed exercise"),
          detail: l.reps ? `${l.sets}×${l.reps}` : t("{n} sets", { n: l.sets }),
          superset: !!l.superset,
        }))}
      />
    </div>
  );
}

/** "TODAY · 16:30", "TOMORROW", "SATURDAY": when the hero's workout is. */
function whenLabel(t: T, start: number, now: number, time: string | null): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((start - today.getTime()) / 86_400_000);
  const day = diff === 0 ? t("Today") : diff === 1 ? t("Tomorrow") : weekdayLong(t, new Date(start).getDay());
  return time ? `${day} · ${time}` : day;
}

/**
 * The selected day as the one large card. Today: the planned (or next) workout with Start; on a
 * rest day, the rest and the next workout, with Train anyway; once trained, what was done. Another
 * day of the week: its planned workout, which can be started now too, or what was done.
 */
function DayHero({ day, next, byId, now }: { day: ReturnType<typeof weekStrip>[number]; next: NextProtocol | null; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const router = useRouter();
  const reduce = useReducedMotionConfig();
  const sessions = useWorkoutStore((s) => s.sessions);
  const routines = useRoutineStore((s) => s.routines);
  const schedule = useReminderStore((s) => s.schedule);
  const unit = useSettingsStore((s) => s.weightUnit);
  const defaultRest = useSettingsStore((s) => s.defaultRestSeconds);
  const { startEmpty, startFromRoutine } = useWorkoutStore.getState();

  const wd = new Date(day.start).getDay() as Weekday;
  const planned = schedule.enabled && schedule.days[wd].on;
  const plannedRoutine = planned ? (routines.find((r) => r.id === schedule.days[wd].routineId && r.exercises.length > 0) ?? null) : null;
  const hasPlan = schedule.enabled && ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).some((d) => schedule.days[d].on);
  const done = day.trained
    ? sessions.filter((s) => s.status === "completed" && s.startedAt >= day.start && s.startedAt < day.start + 86_400_000).sort((a, b) => b.startedAt - a.startedAt)
    : [];

  const empty = () => {
    startEmpty(defaultRest);
    // Straight to picking what to do: an empty workout has nothing else to show.
    router.push("/workout?add=1");
  };
  const start = (r: Routine) => {
    startFromRoutine(r);
    router.push("/workout");
  };
  const nextLine = next && next.why.kind !== "yours" && next.why.kind !== "after" ? t("Next: {name} · {day}", { name: next.routine.name, day: whenLabel(t, startOfNext(next, now), now, null) }) : null;

  let body: ReactNode;
  if (done.length > 0) {
    const s = done[0]!;
    const kg = done.reduce((n, x) => n + sessionVolume(x, byId), 0);
    const worked = [...new Set(done.flatMap((x) => sessionMuscles(x, byId)))];
    body = (
      <>
        {/* As for a planned workout: what was done on the left, the muscles it worked on the right. */}
        <div className="relative flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="field-label flex items-center gap-1.5">
            <Check aria-hidden="true" size={13} strokeWidth={3} className="text-accent" />
            {t("Done")} · {whenLabel(t, day.start, now, null)}
          </p>
          <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
            {s.name}
          </h2>
          <p className="num mt-1 flex items-center gap-3 text-sm text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Timer aria-hidden="true" size={14} />
              {formatDuration(sessionDurationSec(s))}
            </span>
            <span className="inline-flex items-center gap-1">
              <Dumbbell aria-hidden="true" size={14} />
              {formatVolume(toDisplay(kg, unit), unit)}
            </span>
          </p>
        </div>
        {worked.length > 0 && (
          <div className="w-24 shrink-0 [&_figcaption]:hidden">
            <MuscleMap primary={worked} width={96} />
          </div>
        )}
        </div>
        {day.isToday && next && (
          // Done for today, the next workout one tap away (another session, or tomorrow's early).
          <div className="relative flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
              {nextLine ?? t("Next: {name}", { name: next.routine.name })}
            </span>
            <Button onClick={() => start(next.routine)} aria-label={t("Start {name}", { name: next.routine.name })} className="min-h-11 shrink-0 !px-3 text-sm">
              <Play aria-hidden="true" size={15} />
              {t("Start")}
            </Button>
          </div>
        )}
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Link href={historyPath(s.id)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink/[0.12] text-base font-semibold hover:border-ink/25">
            {t("See summary")}
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
          <Button onClick={empty} aria-label={t("Start an empty workout")} className="size-12 !bg-transparent !px-0">
            <Plus aria-hidden="true" size={20} />
          </Button>
        </div>
      </>
    );
  } else {
    // The workout this card offers: the day's planned one, or (today, without one) the next.
    const routine = plannedRoutine ?? (day.isToday && !(hasPlan && !planned) ? (next?.routine ?? null) : null);
    const rest = !routine && (hasPlan || !day.isToday);
    if (routine) {
      const label = plannedRoutine
        ? whenLabel(t, day.start, now, schedule.time)
        : next && (next.why.kind === "tomorrow" || next.why.kind === "weekday")
          ? whenLabel(t, startOfNext(next, now), now, null)
          : t("Next up");
      body = (
        <>
          {/* The day and the routine on the left, the muscles it works as a small map on the right. */}
          <div className="relative flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="field-label">{label}</p>
              <h2 id="hero-heading" className="mt-1 truncate text-2xl font-bold tracking-tight">
                {routine.name}
              </h2>
              <p className="num mt-1 flex items-center gap-3 text-sm text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Timer aria-hidden="true" size={14} />
                  {t("{n} min", { n: routineMinutes(routine) })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers aria-hidden="true" size={14} />
                  {t.n(routine.exercises.length, "{n} exercise", "{n} exercises")}
                </span>
              </p>
            </div>
            <HeroMuscles routine={routine} byId={byId} />
          </div>
          <HeroLifts routine={routine} byId={byId} />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button variant="primary" onClick={() => start(routine)} aria-label={t("Start {name}", { name: routine.name })} className="min-h-12 text-base">
              <Play aria-hidden="true" size={18} />
              {t("Start")}
            </Button>
            <Button onClick={empty} aria-label={t("Start an empty workout")} className="size-12 !bg-transparent !px-0">
              <Plus aria-hidden="true" size={20} />
            </Button>
          </div>
        </>
      );
    } else if (rest) {
      // Today with a plan and nothing planned, or another day with nothing planned.
      const upcoming = day.isToday && next ? next.routine : null;
      body = (
        <>
          <div className="relative min-w-0">
            <p className="field-label">{whenLabel(t, day.start, now, null)}</p>
            <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
              {t("Rest day")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              {day.isToday ? (nextLine ?? t("Recovery is where the muscle grows.")) : day.isFuture ? t("Nothing planned for this day.") : t("No workout this day.")}
            </p>
          </div>
          {upcoming && <HeroLifts routine={upcoming} byId={byId} />}
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            {upcoming ? (
              <Button onClick={() => start(upcoming)} aria-label={t("Train anyway: {name}", { name: upcoming.name })} className="min-h-12 text-base">
                <Play aria-hidden="true" size={18} />
                {t("Train anyway")}
              </Button>
            ) : (
              <Button onClick={empty} className="min-h-12 text-base">
                <Play aria-hidden="true" size={18} />
                {t("Start an empty workout")}
              </Button>
            )}
            <Link
              href="/plan"
              aria-label={t("Adjust your plan")}
              className="raised flex size-12 items-center justify-center rounded-xl"
            >
              <SlidersHorizontal aria-hidden="true" size={18} />
            </Link>
          </div>
        </>
      );
    } else {
      body = (
        <>
          <div className="relative">
            <p className="field-label">{t("Next up")}</p>
            <h2 id="hero-heading" className="mt-1 text-2xl font-bold tracking-tight">
              {t("Free session")}
            </h2>
            <p className="mt-1 text-sm text-text-muted">{t("Or plan your week and ABOT reminds you.")}</p>
          </div>
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Button variant="primary" onClick={empty} className="min-h-12 text-base">
              <Play aria-hidden="true" size={18} />
              {t("Start an empty workout")}
            </Button>
            <Link
              href="/workout"
              aria-label={t("Create a routine")}
              className="raised flex size-12 items-center justify-center rounded-xl"
            >
              <Plus aria-hidden="true" size={20} />
            </Link>
          </div>
          <Link href="/plan" className="relative -mb-1 flex min-h-11 items-center justify-center gap-1.5 text-sm font-semibold text-accent">
            <CalendarDays aria-hidden="true" size={16} />
            {t("Set up your week")}
          </Link>
        </>
      );
    }
  }

  return (
    <section aria-labelledby="hero-heading" className={`${TILE} relative overflow-hidden p-4`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={day.start}
          className="flex flex-col gap-3"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {body}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/** The start of the day the next workout is on. */
function startOfNext(next: NextProtocol, now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (next.why.kind === "today") return d.getTime();
  if (next.why.kind === "tomorrow") return d.getTime() + 86_400_000;
  if (next.why.kind === "weekday") {
    const ahead = (next.why.weekday - d.getDay() + 7) % 7 || 7;
    return d.getTime() + ahead * 86_400_000;
  }
  return d.getTime();
}

function ActiveCard() {
  const t = useT();
  const now = useNow(1000);
  const active = useWorkoutStore((s) => s.active)!;
  const { byId } = useAllExercises();
  const live = liveSet(active);
  // The next exercise with a set still to do, after the one on the bar now.
  const at = live ? active.exercises.indexOf(live.exercise) : -1;
  const next = live ? active.exercises.slice(at + 1).find((e) => e.sets.some((st) => !st.completed)) : undefined;
  return (
    // An opaque surface with the Volt tint laid over it: it sits on the Volt week card, and a
    // see-through tint let that card show through its top edge.
    <Link
      href="/workout"
      className="block rounded-card border border-accent/40 bg-surface p-4 transition-colors hover:border-accent/70"
      style={{ backgroundImage: "linear-gradient(var(--color-accent-tint), var(--color-accent-tint)), var(--neo-card-face)" }}
    >
      <span className="field-label flex items-center gap-1.5 !text-accent">
        <motion.span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-accent"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.2, repeat: 3 }}
        />
        {t("Workout in progress")}
        <span className="num ml-auto inline-flex items-center gap-1 normal-case text-text-muted">
          <Timer aria-hidden="true" size={14} />
          {formatDuration(sessionDurationSec(active, now))}
        </span>
      </span>
      <span className="mt-1 block truncate text-xl font-bold tracking-tight">{active.name}</span>
      {/* What is on the bar now, and what comes after it (owner, 2026-11-15): one photo and the
          set count, not every exercise of the session. */}
      {live ? (
        <span className="tile mt-3 flex items-center gap-3 rounded-xl p-2.5">
          {byId[live.exercise.exerciseId] && <ExerciseThumb exercise={byId[live.exercise.exerciseId]!} size={56} />}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold">{byId[live.exercise.exerciseId]?.name ?? t("Removed exercise")}</span>
            <span className="num block text-sm font-semibold text-accent">
              {live.number === null ? t("Warm-up") : t("Set {n} of {of}", { n: live.number, of: live.of })}
            </span>
            {/* One dot per set of this exercise, filled once done. */}
            <span aria-hidden="true" className="mt-1.5 flex flex-wrap gap-1">
              {live.exercise.sets.map((st, i) => (
                <span key={i} className={`h-1.5 w-4 rounded-full ${st.completed ? "bg-accent" : st === live.set ? "bg-accent/45" : "bg-track"}`} />
              ))}
            </span>
          </span>
        </span>
      ) : (
        <span className="mt-2 block text-sm font-semibold text-text-muted">{active.exercises.length ? t("All sets done") : t("No exercises yet")}</span>
      )}
      {next && (
        <span className="mt-2 block truncate text-sm text-text-muted">
          {t("Next: {name}", { name: byId[next.exerciseId]?.name ?? t("Removed exercise") })}
        </span>
      )}
      <span className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-bold text-on-accent">
        <Play aria-hidden="true" size={18} />
        {t("Continue workout")}
      </span>
    </Link>
  );
}

/* ---------------------------------------------------------------- numbers */

/** Volume short enough for a third of the row: 12,400, then 124k. */
const shortVolume = (n: number, locale: string) => (n >= 100_000 ? `${Math.round(n / 1000).toLocaleString(locale)}k` : Math.round(n).toLocaleString(locale));

/**
 * The week in three figures on one row: sessions against the plan (or the 7 days), the volume
 * with its change on last week, and muscles ready, which opens the recovery map.
 */
function NumbersRow({ now }: { now: number }) {
  const onSwap = useContext(StackSwap);
  const t = useT();
  const playEntrance = usePlayEntrance();
  const sessions = useWorkoutStore((s) => s.sessions);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit: unit, firstDayOfWeek } = useSettingsStore();
  const { byId } = useAllExercises();
  const active = useWorkoutStore((s) => s.active);
  const sleep = useSettingsStore((s) => s.lastSleep);
  const [open, setOpen] = useState(false);

  const volume = useMemo(() => weeklyVolume(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const freq = weeklyFrequency(sessions, schedule, now, firstDayOfWeek);
  // Sets ticked in a workout still running tire the muscles too.
  const recovery = useMemo(() => regionTelemetry(active ? [...sessions, active] : sessions, byId, now, sleep), [sessions, active, byId, now, sleep]);
  const ready = REGIONS.filter((r) => recovery[r].stage === "fresh").length;
  const target = freq.target ?? 7;
  const perWeek = freq.target !== null;
  const change = volume.changePct;

  return (
    <>
    <section aria-label={t("This week")} className="wallet-card relative min-h-[100px] flex-1 overflow-hidden rounded-card">
      {/* Behind the day's card, sessions and volume bring the week to the front; "ready" keeps
          opening the recovery map. */}
      {onSwap && (
        <button type="button" onClick={onSwap} aria-label={t("Bring the week to the front")} className="absolute left-0 top-0 z-[1] h-16 w-2/3 hover:bg-ink/[0.03]" />
      )}
      <div className="grid h-16 grid-cols-3 divide-x divide-line">
      <div className="flex min-w-0 items-center gap-2 p-3">
        {/* One dash per planned session (owner, 2026-11-15): a whole ring reads as a plain circle,
            dashes read as "2 of 4". They light one by one when the card is dealt. */}
        <span aria-hidden="true" className="hidden shrink-0 min-[380px]:block">
          <Ring value={Math.min(freq.done, target)} max={target} size={36} stroke={4} segments={target} entrance={playEntrance} />
        </span>
        <div className="min-w-0">
          <p aria-hidden="true" className="num text-lg font-bold leading-tight tabular-nums">
            {freq.done}
            <span className="text-xs font-semibold text-text-muted">/{target}</span>
          </p>
          <p aria-hidden="true" className="field-label truncate">
            {perWeek ? t("Planned") : t("Days")}
          </p>
          <span className="sr-only">
            {perWeek ? t("{done} of {target} planned sessions this week", { done: freq.done, target }) : t("{done} of {target} days this week", { done: freq.done, target })}
          </span>
        </div>
      </div>

      <div className="min-w-0 p-3">
        <p className="num flex items-baseline gap-0.5 text-lg font-bold leading-tight tabular-nums">
          <CountFromZero delay={0.2} value={Math.round(toDisplay(volume.kg, unit))} format={(n) => shortVolume(n, t.locale)} />
          <span className="text-[11px] font-semibold text-text-muted">{unit}</span>
        </p>
        <p className="field-label flex items-center gap-1 truncate">
          {t("Volume")}
          {change !== null && (
            <span className={`num inline-flex items-center gap-0.5 normal-case ${change >= 0 ? "!text-text" : ""}`}>
              {change >= 0 ? <TrendingUp aria-hidden="true" size={11} className="text-accent" /> : <TrendingDown aria-hidden="true" size={11} />}
              {change > 0 ? "+" : ""}
              {change}%<span className="sr-only"> {t("against last week")}</span>
            </span>
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("Muscle recovery: {ready} of {total} muscles ready. Open the map.", { ready, total: REGIONS.length })}
        className="flex min-w-0 items-center gap-2 p-3 text-left transition-colors hover:bg-ink/[0.03]"
      >
        <span aria-hidden="true" className="tile hidden size-9 shrink-0 items-center justify-center rounded-full min-[380px]:flex"
          style={{ color: "var(--color-phase-bulk)", backgroundColor: "color-mix(in oklab, var(--color-phase-bulk) 16%, transparent)" }}>
          <Activity size={16} />
        </span>
        <span aria-hidden="true" className="min-w-0">
          <span className="num block text-lg font-bold leading-tight tabular-nums">
            {ready}
            <span className="text-xs font-semibold text-text-muted">/{REGIONS.length}</span>
          </span>
          <span className="field-label block truncate">{t("ready")}</span>
        </span>
      </button>

      </div>
    </section>
    {/* Outside the Volt card: inside it the sheet would inherit the card's re-pointed colours. */}
      <Sheet open={open} onClose={() => setOpen(false)} title={t("Muscle recovery")}>
        <RecoveryBody recovery={recovery} now={now} />
      </Sheet>
    </>
  );
}

/* ---------------------------------------------------------------- recent */

function RecentWorkouts({ unit, byId, now }: { unit: "kg" | "lbs"; byId: Record<string, Exercise>; now: number }) {
  const t = useT();
  const sessions = useWorkoutStore((s) => s.sessions);
  const recent = useMemo(() => [...sessions].sort((a, b) => b.startedAt - a.startedAt).slice(0, 3), [sessions]);
  const prs = useMemo(() => prCounts(recent, sessions, byId), [recent, sessions, byId]);

  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        {/* The heading reads as a heading (larger, bold, full colour); See all reads as a link
            (smaller, in the accent, like "Set up week" above). Both were the same small grey. */}
        <h2 id="recent-heading" className="text-lg font-bold tracking-tight">
          {t("Recent workouts")}
        </h2>
        {recent.length > 0 && (
          <Link
            href="/history/all"
            className="-mr-2 flex min-h-11 items-center gap-0.5 rounded-ctl px-2 text-sm font-semibold text-accent hover:underline underline-offset-4"
          >
            {t("See all")}
            <ChevronRight aria-hidden="true" size={14} />
          </Link>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-card border bg-surface py-6 text-center">
          <EmptyArt icon={Dumbbell} />
          <p className="text-sm text-text-muted">{t("No workouts yet.")}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border bg-surface">
          {recent.map((s, i) => (
            <RecentCard key={s.id} session={s} pr={prs[s.id] ?? 0} unit={unit} byId={byId} now={now} order={i} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentCard({
  session: s,
  pr,
  unit,
  byId,
  now,
  order,
}: {
  session: WorkoutSession;
  pr: number;
  unit: "kg" | "lbs";
  byId: Record<string, Exercise>;
  now: number;
  order: number;
}) {
  const t = useT();
  const controls = useEntrance();
  const bodyweightKg = useSettingsStore((st) => st.bodyweightKg);
  const gym = useLocationStore((st) => st.locations.find((l) => l.id === s.locationId)?.name);
  const { completed } = countSets(s);
  const est = estimateCalories(s, { bodyweightKg, byId });
  // Under a minute (a test tap, a mistake) the figure means nothing.
  const kcal = est.minutes >= 1 ? est.kcal : 0;
  const muscles = sessionMuscles(s, byId);
  const stats = (
    <p className="num flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-400">
      {gym && (
        <span className="inline-flex min-w-0 max-w-full items-center gap-1 font-sans">
          <MapPin aria-hidden="true" size={12} className="shrink-0" />
          <span className="sr-only">{t("Gym")}: </span>
          <span className="truncate">{gym}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Timer aria-hidden="true" size={12} />
        {formatDuration(sessionDurationSec(s))}
      </span>
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Dumbbell aria-hidden="true" size={12} />
        {formatVolume(sessionVolume(s, byId), unit)}
      </span>
      {kcal > 0 && (
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Flame aria-hidden="true" size={12} />
          {kcal} kcal
          <span className="sr-only"> {t("estimated")}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        <Layers aria-hidden="true" size={12} />
        {completed}
        <span className="sr-only"> {completed === 1 ? t("set") : t("sets")}</span>
      </span>
    </p>
  );
  const prChip = pr > 0 && (
    <span className="num inline-flex shrink-0 items-center gap-1 rounded-full border border-pr/40 px-1.5 py-px text-[11px] font-semibold text-pr">
      <Trophy aria-hidden="true" size={11} />
      {pr} PR
    </span>
  );
  const when = (
    <time dateTime={isoTime(s.startedAt)} className="num shrink-0 text-xs text-text-muted">
      {relativeDay(s.startedAt, now, t)}
    </time>
  );

  return (
    <motion.li
      style={{ opacity: 0, x: -10 }}
      animate={controls}
      variants={{
        still: { opacity: 1, x: 0 },
        show: { opacity: 1, x: 0, transition: { ...SPRING, delay: 0.35 + Math.min(order, 6) * 0.05 } },
      }}
    >
      <motion.div whileTap={{ scale: 0.98 }} transition={PRESS_SPRING}>
        <Link href={historyPath(s.id)} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-ink/[0.03]">
          {/* The muscles it worked, one small map instead of a row of photos: quicker to read, and
              the same for every lift. It leads the row, about as tall as the title and figures. */}
          {muscles.length > 0 && (
            <div aria-hidden="true" data-muscles className="w-11 shrink-0">
              <MuscleMap primary={muscles} width={44} captions={false} />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-base font-semibold">{s.name}</span>
              {prChip}
              <span className="ml-auto">{when}</span>
            </div>
            {stats}
          </div>
          <ChevronRight aria-hidden="true" size={16} className="shrink-0 text-text-muted" />
        </Link>
      </motion.div>
    </motion.li>
  );
}

/** The recovery sheet's body: the map, last night's sleep when it changes the pace, and how it works. */
function RecoveryBody({ recovery, now }: { recovery: ReturnType<typeof regionTelemetry>; now: number }) {
  const t = useT();
  const sleep = useSettingsStore((s) => s.lastSleep);
  const speed = sleepFactor(sleep, now);
  return (
    <>
      <RecoveryMap data={recovery} now={now} />
      {speed !== 1 && sleep && (
        <p className="mt-3 text-xs font-semibold tabular-nums">
          {speed < 1
            ? t("Last night's sleep ({h}h {m}m) slows recovery to {pct}% of the usual rate.", { h: Math.floor(sleep.minutes / 60), m: sleep.minutes % 60, pct: Math.round(speed * 100) })
            : t("Last night's sleep ({h}h {m}m) speeds recovery to {pct}% of the usual rate.", { h: Math.floor(sleep.minutes / 60), m: sleep.minutes % 60, pct: Math.round(speed * 100) })}
        </p>
      )}
      <p className="mt-3 text-xs text-text-muted">{t("Each set tires the muscles it works. Big muscles recover in 72 hours, small ones in 48.")}</p>
    </>
  );
}

const DAY = 86_400_000;
const MUSCLE_GROUPS = (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).filter((m) => m !== "full_body" && m !== "cardio");

/**
 * The week in front (owner, 2026-11-15): six figures, each a door to its detail. Sessions against
 * the plan as dashes, volume with its change and a bar per day, muscles ready with the ones still
 * recovering lit, sets, time trained, and records in gold. Worked out from data Home already
 * holds; nothing animates but the sessions' dashes on the first visit.
 */
function WeekCard({ now }: { now: number }) {
  const t = useT();
  const play = usePlayEntrance();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const schedule = useReminderStore((s) => s.schedule);
  const { weightUnit: unit, firstDayOfWeek } = useSettingsStore();
  const sleep = useSettingsStore((s) => s.lastSleep);
  const { byId } = useAllExercises();
  const [open, setOpen] = useState(false);

  const fig = useMemo(() => {
    const start = startOfWeek(now, firstDayOfWeek);
    const week = sessions.filter((s) => s.status === "completed" && s.startedAt >= start && s.startedAt <= now);
    const perDay = Array.from({ length: 7 }, (_, i) =>
      week.filter((s) => s.startedAt >= start + i * DAY && s.startedAt < start + (i + 1) * DAY).reduce((n, s) => n + sessionVolume(s, byId), 0),
    );
    const records = Object.values(prCounts(week, sessions, byId)).reduce((a, b) => a + b, 0);
    return {
      perDay,
      today: Math.min(6, Math.floor((now - start) / DAY)),
      sets: week.reduce((n, s) => n + countSets(s).completed, 0),
      seconds: week.reduce((n, s) => n + sessionDurationSec(s, now), 0),
      records,
    };
  }, [sessions, now, firstDayOfWeek, byId]);
  const volume = useMemo(() => weeklyVolume(sessions, now, firstDayOfWeek, byId), [sessions, now, firstDayOfWeek, byId]);
  const freq = weeklyFrequency(sessions, schedule, now, firstDayOfWeek);
  const recovery = useMemo(() => regionTelemetry(active ? [...sessions, active] : sessions, byId, now, sleep), [sessions, active, byId, now, sleep]);
  const ready = REGIONS.filter((r) => recovery[r].stage === "fresh").length;
  const tired = MUSCLE_GROUPS.filter((m) => regionsFor(m).some((r) => recovery[r].stage !== "fresh"));
  const target = freq.target ?? 7;
  const change = volume.changePct;
  const max = Math.max(...fig.perDay, 1);

  // Three across, two down, so the card stands about as tall as the day's card it trades places
  // with (owner, 2026-11-15: the stack keeps its size). Each tile: a small picture, the figure,
  // its name.
  const tile = "tile flex min-w-0 flex-col gap-1 rounded-xl p-2.5 text-left transition-colors hover:bg-ink/[0.03]";
  const pic = "flex h-6 items-end";
  const label = "field-label truncate";
  const figure = "num truncate text-lg font-bold leading-tight";
  return (
    <section aria-label={t("This week")} className="rounded-card border border-line bg-surface p-3">
      <h2 className="px-1 pb-2 text-sm font-bold">{t("This week")}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Link href="/progress/calendar" className={tile}>
          <span aria-hidden="true" className={pic}>
            <Ring value={Math.min(freq.done, target)} max={target} size={24} stroke={3} segments={target} entrance={play} />
          </span>
          <span className={figure}>
            {freq.done}
            <span className="text-xs font-semibold text-text-muted">/{target}</span>
          </span>
          <span className={label}>{freq.target !== null ? t("Planned") : t("Days")}</span>
        </Link>

        <Link href="/progress/trend" className={tile}>
          {/* One bar per day of the week, today's lit. */}
          <span aria-hidden="true" className={`${pic} gap-[3px]`}>
            {fig.perDay.map((v, i) => (
              <span key={i} className={`w-1.5 rounded-full ${i === fig.today ? "bg-accent" : v > 0 ? "bg-text-muted/60" : "bg-track"}`} style={{ height: `${Math.max(14, (v / max) * 100)}%` }} />
            ))}
          </span>
          <span className={figure}>
            {shortVolume(toDisplay(volume.kg, unit), t.locale)}
            <span className="ml-0.5 text-[11px] font-semibold text-text-muted">{unit}</span>
          </span>
          <span className={`${label} flex items-center gap-1`}>
            {t("Volume")}
            {change !== null && (
              <span className="num inline-flex items-center gap-0.5 normal-case">
                {change >= 0 ? <TrendingUp aria-hidden="true" size={11} className="text-accent" /> : <TrendingDown aria-hidden="true" size={11} />}
                {change > 0 ? "+" : ""}
                {change}%<span className="sr-only"> {t("against last week")}</span>
              </span>
            )}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={t("Muscle recovery: {ready} of {total} muscles ready. Open the map.", { ready, total: REGIONS.length })}
          className={tile}
        >
          {/* The muscles still recovering, lit. */}
          <span aria-hidden="true" className={`${pic} overflow-hidden`}>
            <MuscleMap primary={tired} width={30} captions={false} />
          </span>
          <span aria-hidden="true" className={figure}>
            {ready}
            <span className="text-xs font-semibold text-text-muted">/{REGIONS.length}</span>
          </span>
          <span aria-hidden="true" className={label}>
            {t("ready")}
          </span>
        </button>

        <Link href="/history/all" className={tile}>
          <span aria-hidden="true" className={`${pic} text-text-muted`}>
            <Layers size={18} />
          </span>
          <span className={figure}>{fig.sets}</span>
          <span className={label}>{t("Sets")}</span>
        </Link>

        <Link href="/history/all" className={tile}>
          <span aria-hidden="true" className={`${pic} text-text-muted`}>
            <Timer size={18} />
          </span>
          <span className={figure}>{formatDuration(Math.round(fig.seconds))}</span>
          <span className={label}>{t("Training time")}</span>
        </Link>

        <Link href="/history/all" className={tile}>
          <span aria-hidden="true" className={`${pic} text-pr`}>
            <Trophy size={18} />
          </span>
          <span className={`${figure} text-pr`}>{fig.records}</span>
          <span className={label}>{t("Records")}</span>
        </Link>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("Muscle recovery")}>
        <RecoveryBody recovery={recovery} now={now} />
      </Sheet>
    </section>
  );
}

/**
 * The day's card when it sits behind the week's: one Volt line. A workout running shows the
 * exercise on the bar, its set and the clock, with a play button straight back to it; otherwise
 * the next workout. A tap anywhere else brings it to the front.
 */
/** A button on the Volt strip: dark ink on a faint ink plate, above the strip's swap layer. */
const STRIP_CTA =
  "relative z-[2] flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-on-accent)_12%,transparent)]";

function TodayStrip({ next }: { next: NextProtocol | null }) {
  const onSwap = useContext(StackSwap) ?? undefined;
  const t = useT();
  const router = useRouter();
  const active = useWorkoutStore((s) => s.active);
  const { byId } = useAllExercises();
  const now = useNow(1000, active !== null);
  const live = active ? liveSet(active) : null;
  const paused = active?.pausedAt !== undefined && active !== null;
  return (
    <section aria-label={active ? t("Workout in progress") : t("Next up")} className="wallet-card relative min-h-[100px] flex-1 overflow-hidden rounded-card">
      <button
        type="button"
        onClick={onSwap}
        aria-label={active ? t("Bring the workout to the front") : t("Bring today's plan to the front")}
        className="absolute inset-x-0 top-0 z-[1] h-16 hover:bg-ink/[0.03]"
      />
      <div className="flex h-16 items-center gap-3 px-3.5">
        <span className="min-w-0 flex-1">
          <span className="field-label flex items-center gap-1.5">
            {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-[currentColor]" />}
            {active ? (paused ? t("Paused") : t("Workout in progress")) : t("Next up")}
          </span>
          <span className="block truncate text-base font-bold">
            {active
              ? live
                ? `${byId[live.exercise.exerciseId]?.name ?? t("Removed exercise")} · ${live.number === null ? t("Warm-up") : t("Set {n} of {of}", { n: live.number, of: live.of })}`
                : active.name
              : next
                ? `${next.routine.name} · ${t("{n} exercises", { n: next.routine.exercises.length })}`
                : t("No workout planned")}
          </span>
        </span>
        {/* The card behind still acts: back to the workout, start the next one, or plan the week. */}
        {active ? (
          <>
            <span className="num shrink-0 text-sm font-semibold">{formatDuration(sessionDurationSec(active, now))}</span>
            {/* The workout is on: the strip pauses it, and resumes it (owner, 2026-11-15). */}
            <button
              type="button"
              aria-label={paused ? t("Resume") : t("Pause")}
              onClick={() => {
                feedback.tick();
                if (paused) useWorkoutStore.getState().resumeActive();
                else useWorkoutStore.getState().pauseActive();
              }}
              className={`${STRIP_CTA} size-11`}
            >
              {paused ? <Play aria-hidden="true" size={18} /> : <Pause aria-hidden="true" size={18} />}
            </button>
          </>
        ) : next ? (
          <button
            type="button"
            onClick={() => {
              feedback.tick();
              useWorkoutStore.getState().startFromRoutine(next.routine);
              router.push("/workout");
            }}
            className={`${STRIP_CTA} gap-1.5 px-4 text-sm font-bold`}
          >
            <Play aria-hidden="true" size={16} />
            {t("Start")}
          </button>
        ) : (
          <Link href="/plan" className={`${STRIP_CTA} px-4 text-sm font-bold`}>
            {t("Set up week")}
          </Link>
        )}
      </div>
    </section>
  );
}

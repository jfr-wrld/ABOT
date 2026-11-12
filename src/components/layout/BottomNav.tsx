"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { animate, motion, useMotionValue, useReducedMotionConfig, useSpring, useTransform, useVelocity } from "framer-motion";
import { feedback } from "@/lib/feedback";
/** Softer than the press spring, so the lens overshoots a touch, like liquid settling. */
const LENS_SPRING = { type: "spring", stiffness: 380, damping: 24, mass: 0.8 } as const;
import { Dumbbell, House, Search } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useHydration } from "@/store/hydration";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { normalizePath, usePagePath } from "@/components/layout/usePagePath";
import { useT } from "@/i18n";

/*
 * Four primary destinations, each a real page. Labels stay visible: no bare icons. Workout holds
 * the routines and Profile holds progress, so each tab also answers for its old address.
 */
const TABS = [
  { href: "/", label: "Home", Icon: House, also: [] },
  { href: "/workout", label: "Workout", Icon: Dumbbell, also: ["/routines"] },
  { href: "/exercises", label: "Exercises", Icon: Search, also: [] },
  { href: "/profile", label: "Profile", Icon: null, also: ["/progress"] },
] as const;

/**
 * usePathname suspends on dynamic routes under cacheComponents, so the dock renders a
 * same-size shell (no tab marked current) until the pathname is known.
 */
export function BottomNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <CurrentNav />
    </Suspense>
  );
}

/**
 * The dock belongs to the four top-level screens only. Detail screens (a workout in history, a
 * summary, an exercise, the routine editor, settings, sign-in, the intro) have their own way
 * back and get the whole screen.
 */
const DOCK_PATHS = ["/", "/workout", "/routines", "/exercises", "/profile", "/progress"];
export const showsDock = (pathname: string | null) => pathname === null || DOCK_PATHS.includes(normalizePath(pathname));

function CurrentNav() {
  const pathname = usePagePath();
  const shown = showsDock(pathname);
  // Pages pad for the dock, and the workout bar sits above it, through this one value.
  useEffect(() => {
    document.documentElement.style.setProperty("--dock-h", shown ? "96px" : "16px");
  }, [shown]);
  return <NavBar pathname={pathname} />;
}

/** How tightly the lens trails the finger while dragging. */
const FOLLOW_SPRING = { type: "spring", stiffness: 900, damping: 55, mass: 0.6 } as const;
/** Movement past this (px) turns a press into a drag; less is a tap on the link. */
const DRAG_FROM = 6;

/**
 * A floating dock, inset from the screen edges, in liquid glass: the app's only glass surface.
 * It lets the set list read through as it scrolls under, so the dock never feels like a lid.
 * The current tab is a brighter lens. Pressed and dragged along the dock, the lens follows the
 * finger, stretching with its speed, and lights each tab it passes; let go, it settles on the
 * nearest tab and opens it. A plain tap is still a link.
 */
function NavBar({ pathname }: { pathname: string | null }) {
  const hydrated = useHydration((s) => s.hydrated);
  const hasActive = useWorkoutStore((s) => s.active !== null);
  const { profileName, profilePhoto } = useSettingsStore();
  const t = useT();
  const router = useRouter();
  const reduceMotion = useReducedMotionConfig();
  const list = useRef<HTMLUListElement>(null);
  const [tabW, setTabW] = useState(0);
  // The tab the lens is over while a finger drags it; null when no drag is under way.
  const [hover, setHover] = useState<number | null>(null);
  const [pressed, setPressed] = useState(false);
  const drag = useRef<{ id: number; startX: number; dragging: boolean; at: number } | null>(null);
  const swallowClick = useRef(false);

  const currentIndex =
    pathname === null
      ? -1
      : TABS.findIndex(({ href, also }) => (href === "/" ? pathname === "/" : [href, ...also].some((p) => pathname.startsWith(p))));

  const x = useMotionValue(0);
  // Stretch with speed, like a drop pulled along: wider and a touch flatter the faster it goes.
  const speed = useVelocity(x);
  const stretch = useSpring(useTransform(speed, (v) => Math.min(Math.abs(v) / 2400, 0.22)), { stiffness: 500, damping: 40 });
  const scaleX = useTransform(stretch, (k) => 1 + k + (pressed ? 0.04 : 0));
  const scaleY = useTransform(stretch, (k) => 1 - k * 0.45 + (pressed ? 0.04 : 0));

  // Tab width, kept current as the window turns or resizes.
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => setTabW((el.clientWidth - 8) / TABS.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pathname]);

  // Between drags the lens rests on the current page's tab, sliding there on a soft spring.
  useEffect(() => {
    if (tabW === 0 || currentIndex < 0 || drag.current?.dragging) return;
    const to = currentIndex * tabW;
    if (reduceMotion) x.set(to);
    else void animate(x, to, LENS_SPRING);
  }, [currentIndex, tabW, reduceMotion, x]);

  if (!showsDock(pathname)) return null;

  const indexAt = (px: number) => Math.max(0, Math.min(TABS.length - 1, Math.round(px / tabW)));
  const follow = (clientX: number) => {
    const box = list.current!.getBoundingClientRect();
    const px = Math.max(0, Math.min(tabW * (TABS.length - 1), clientX - box.left - 4 - tabW / 2));
    // A stiff spring, not a jump: the lens catches up with the finger within a frame or two and
    // keeps its speed between moves, so it glides even when touch events arrive unevenly.
    if (reduceMotion) x.set(px);
    else void animate(x, px, FOLLOW_SPRING);
    const i = indexAt(px);
    if (i !== drag.current!.at) {
      drag.current!.at = i;
      feedback.tick();
      setHover(i);
    }
  };
  const end = (commit: boolean) => {
    const d = drag.current;
    drag.current = null;
    setPressed(false);
    setHover(null);
    if (!d?.dragging) return;
    const i = indexAt(x.get());
    swallowClick.current = true;
    if (reduceMotion) x.set(i * tabW);
    else void animate(x, i * tabW, LENS_SPRING);
    if (commit && i !== currentIndex) router.push(TABS[i]!.href);
    else if (!commit && currentIndex >= 0) void animate(x, currentIndex * tabW, LENS_SPRING);
  };

  const lit = hover ?? currentIndex;

  return (
    <nav
      aria-label={t("Primary")}
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]"
    >
      <ul
        ref={list}
        className="liquid-glass relative mx-auto flex max-w-[616px] touch-none select-none rounded-2xl p-1"
        onPointerDown={(e) => {
          if (tabW === 0 || (e.pointerType === "mouse" && e.button !== 0)) return;
          drag.current = { id: e.pointerId, startX: e.clientX, dragging: false, at: currentIndex };
          setPressed(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          if (!d.dragging) {
            if (Math.abs(e.clientX - d.startX) < DRAG_FROM) return;
            d.dragging = true;
            // The finger may leave the dock while dragging; it still steers the lens.
            list.current!.setPointerCapture(e.pointerId);
          }
          follow(e.clientX);
        }}
        onPointerUp={() => end(true)}
        onPointerCancel={() => end(false)}
        // A drag ends with a click on whatever link is under the finger; the drag already chose.
        onClickCapture={(e) => {
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* One lens for the whole dock, moved by the page and by the finger. */}
        {tabW > 0 && currentIndex >= 0 && (
          <motion.span
            aria-hidden="true"
            style={{ x, scaleX, scaleY, width: tabW }}
            className="glass-lens pointer-events-none absolute bottom-1 left-1 top-1 rounded-xl"
          />
        )}
        {TABS.map(({ href, label, Icon }, i) => {
          const current = i === currentIndex;
          const on = i === lit;
          const live = href === "/workout" && hydrated && hasActive;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                draggable={false}
                className={`tap relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors duration-150 hover:bg-ink/[0.05] ${
                  on ? "text-text" : "text-text-muted"
                }`}
              >
                <span className="relative">
                  {Icon ? (
                    <Icon aria-hidden="true" size={21} strokeWidth={on ? 2.25 : 1.75} className={`transition-colors duration-150 ${on ? "text-accent" : ""}`} />
                  ) : (
                    // The lifter's own plate; dimmed until it is the lit tab, like the other icons.
                    <span aria-hidden="true" className={`block transition-opacity ${on ? "" : "opacity-60 grayscale"}`}>
                      <ProfileAvatar name={profileName} photo={profilePhoto} size={22} decorative />
                    </span>
                  )}
                  {live && (
                    <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden="true" />
                  )}
                </span>
                <span className="relative truncate">{t(label)}</span>
                {live && <span className="sr-only">{t("(workout in progress)")}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

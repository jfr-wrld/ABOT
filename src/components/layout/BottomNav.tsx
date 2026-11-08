"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { Dumbbell, House, Search } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useHydration } from "@/store/hydration";
import { useSettingsStore } from "@/store/useSettingsStore";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { normalizePath, usePagePath } from "@/components/layout/usePagePath";

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

/**
 * A floating dock, inset from the screen edges. The blur is the app's only glass surface:
 * it lets the set list read through as it scrolls under, so the dock never feels like a lid.
 */
function NavBar({ pathname }: { pathname: string | null }) {
  const hydrated = useHydration((s) => s.hydrated);
  const hasActive = useWorkoutStore((s) => s.active !== null);
  const { profileName, profilePhoto } = useSettingsStore();
  if (!showsDock(pathname)) return null;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-[616px] rounded-2xl border border-ink/[0.08] bg-bg/80 p-1 shadow-[0_8px_32px_rgb(0_0_0/0.5)] backdrop-blur-xl">
        {TABS.map(({ href, label, Icon, also }) => {
          const current =
            pathname !== null &&
            (href === "/" ? pathname === "/" : [href, ...also].some((p) => pathname.startsWith(p)));
          const live = href === "/workout" && hydrated && hasActive;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors duration-150 hover:bg-ink/[0.05] active:bg-ink/[0.08] ${
                  current ? "bg-ink/[0.06] text-text" : "text-text-muted"
                }`}
              >
                <span className="relative">
                  {Icon ? (
                    <Icon aria-hidden="true" size={21} strokeWidth={current ? 2.25 : 1.75} className={current ? "text-accent" : ""} />
                  ) : (
                    // The lifter's own plate; dimmed until it is the current tab, like the other icons.
                    <span aria-hidden="true" className={`block transition-opacity ${current ? "" : "opacity-60 grayscale"}`}>
                      <ProfileAvatar name={profileName} photo={profilePhoto} size={22} decorative />
                    </span>
                  )}
                  {live && (
                    <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-accent ring-2 ring-bg" aria-hidden="true" />
                  )}
                </span>
                <span className="truncate">{label}</span>
                {live && <span className="sr-only">(workout in progress)</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

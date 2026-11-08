"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Dumbbell, House, ListChecks, Search } from "lucide-react";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useHydration } from "@/store/hydration";

/* Five primary destinations, each a real page. Labels stay visible: no bare icons. */
const TABS = [
  { href: "/", label: "Home", Icon: House },
  { href: "/workout", label: "Workout", Icon: Dumbbell },
  { href: "/routines", label: "Routines", Icon: ListChecks },
  { href: "/exercises", label: "Exercises", Icon: Search },
  { href: "/progress", label: "Progress", Icon: BarChart3 },
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

function CurrentNav() {
  return <NavBar pathname={usePathname()} />;
}

/**
 * A floating dock, inset from the screen edges. The blur is the app's only glass surface:
 * it lets the set list read through as it scrolls under, so the dock never feels like a lid.
 */
function NavBar({ pathname }: { pathname: string | null }) {
  const hydrated = useHydration((s) => s.hydrated);
  const hasActive = useWorkoutStore((s) => s.active !== null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]"
    >
      <ul className="mx-auto flex max-w-[616px] rounded-2xl border border-white/[0.08] bg-bg/80 p-1 shadow-[0_8px_32px_rgb(0_0_0/0.5)] backdrop-blur-xl">
        {TABS.map(({ href, label, Icon }) => {
          const current = pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));
          const live = href === "/workout" && hydrated && hasActive;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`relative flex h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors duration-150 hover:bg-white/[0.05] active:bg-white/[0.08] ${
                  current ? "bg-white/[0.06] text-text" : "text-text-muted"
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden="true" size={21} strokeWidth={current ? 2.25 : 1.75} className={current ? "text-accent" : ""} />
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

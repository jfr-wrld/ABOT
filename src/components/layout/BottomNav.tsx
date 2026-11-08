"use client";

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

export function BottomNav() {
  const pathname = usePathname();
  const hydrated = useHydration((s) => s.hydrated);
  const hasActive = useWorkoutStore((s) => s.active !== null);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[640px]">
        {TABS.map(({ href, label, Icon }) => {
          const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const live = href === "/workout" && hydrated && hasActive;
          return (
            <li key={href} className="min-w-0 flex-1">
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors hover:bg-surface active:bg-surface-2 ${
                  current ? "text-text" : "text-text-muted"
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden="true" size={22} strokeWidth={current ? 2.25 : 1.75} />
                  {live && (
                    <span className="absolute -right-1.5 -top-0.5 size-2 rounded-full bg-accent" aria-hidden="true" />
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

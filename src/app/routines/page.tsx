"use client";

import { HydrationGate } from "@/components/ui/Loading";
import { RoutineLibrary } from "@/components/routines/RoutineLibrary";

/** Old address of the routine library, kept so links and bookmarks still land on it. */
export default function RoutinesPage() {
  return (
    <HydrationGate>
      <RoutineLibrary />
    </HydrationGate>
  );
}

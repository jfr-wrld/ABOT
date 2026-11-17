"use client";

import { HydrationGate } from "@/components/ui/Loading";
import { RoutineLibrary } from "@/components/routines/RoutineLibrary";

/**
 * The routine library's own address. /workout shows the same list only while no workout runs;
 * during one it is the logger, so this is the way to the routines then (Program links here).
 */
export default function RoutinesPage() {
  return (
    <HydrationGate>
      <RoutineLibrary />
    </HydrationGate>
  );
}

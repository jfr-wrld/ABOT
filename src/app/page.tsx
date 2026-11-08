"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { HydrationGate } from "@/components/ui/Loading";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export default function HomePage() {
  return (
    <HydrationGate>
      <HomeScreen />
    </HydrationGate>
  );
}

function HomeScreen() {
  const router = useRouter();
  const sessions = useWorkoutStore((s) => s.sessions);
  const active = useWorkoutStore((s) => s.active);
  const routines = useRoutineStore((s) => s.routines);
  // First open on a device with nothing logged: show the intro once. Anyone with data skips it.
  const [needsIntro] = useState(() => sessions.length === 0 && routines.length === 0 && active === null && !hasSeenOnboarding());
  useEffect(() => {
    if (needsIntro) router.replace("/onboarding");
  }, [needsIntro, router]);

  if (needsIntro) return null;
  return <HomeDashboard />;
}

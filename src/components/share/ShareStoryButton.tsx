"use client";

import { useState } from "react";
import type { WorkoutSession } from "@/types/workout";
import { Button } from "@/components/ui/Button";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { useLocationStore } from "@/store/useLocationStore";
import { buildStoryData, type StoryData } from "@/lib/story-data";
// Bundled with the page rather than loaded on tap, so the studio still opens with no signal
// right after a workout.
import { StoryCardStudio } from "./StoryCardStudio";

/**
 * Opens the Story Studio with data made at tap time. The arrow marks that the result leaves
 * ABOT for another app.
 */
export function StoryShareButton({
  makeData,
  variant = "secondary",
  className = "",
  label = "Share to IG Story",
}: {
  makeData: () => StoryData;
  variant?: "primary" | "secondary";
  className?: string;
  label?: string;
}) {
  const [data, setData] = useState<StoryData | null>(null);
  return (
    <>
      <Button variant={variant} onClick={() => setData(makeData())} className={className}>
        {label} <span aria-hidden="true">↗</span>
      </Button>
      {data && <StoryCardStudio open onClose={() => setData(null)} data={data} />}
    </>
  );
}

/** The share button for one finished workout (summary page and History Detail). */
export function ShareStoryButton({
  session,
  variant,
  className,
}: {
  session: WorkoutSession;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const sessions = useWorkoutStore((s) => s.sessions);
  const { weightUnit } = useSettingsStore();
  const { byId } = useAllExercises();
  const locations = useLocationStore((s) => s.locations);
  return (
    <StoryShareButton
      variant={variant}
      className={className}
      makeData={() => buildStoryData(session, sessions, byId, weightUnit, locations)}
    />
  );
}

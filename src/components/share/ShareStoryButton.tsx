"use client";

import { useState } from "react";
import type { WorkoutSession } from "@/types/workout";
import { Button } from "@/components/ui/Button";
// Bundled with the page rather than loaded on tap, so the studio still opens with no signal
// right after a workout.
import { StoryCardStudio } from "./StoryCardStudio";

/**
 * Entry point to the Story Studio. The arrow marks that the result leaves ABOT for another app.
 */
export function ShareStoryButton({
  session,
  variant = "secondary",
  className = "",
}: {
  session: WorkoutSession;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} className={className}>
        Share to IG Story <span aria-hidden="true">↗</span>
      </Button>
      {open && <StoryCardStudio open={open} onClose={() => setOpen(false)} session={session} />}
    </>
  );
}

"use client";

import Link from "next/link";
import type { Exercise } from "@/types/workout";
import { Sheet } from "@/components/ui/Sheet";
import { SmartExerciseMedia } from "@/components/exercise/SmartExerciseMedia";
import { ExerciseGuide } from "@/components/exercise/ExerciseGuide";
import { RecordsSummary } from "@/components/exercise/RecordsSummary";

/** Quick how-to during a workout: media, form cues and records, without leaving the session. */
export function ExerciseHowToSheet({
  exercise,
  locationId,
  open,
  onClose,
}: {
  exercise: Exercise;
  locationId?: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={exercise.name}>
      {open && (
        <div className="flex flex-col gap-3 pb-2">
          <SmartExerciseMedia exercise={exercise} />
          <ExerciseGuide exercise={exercise} showInstructions={false} />
          <RecordsSummary exercise={exercise} locationId={locationId} />
          <Link
            href={`/exercises/${exercise.id}`}
            className="inline-flex min-h-11 items-center justify-center rounded-ctl border border-line-strong text-sm font-semibold hover:bg-surface-2"
          >
            Full exercise details
          </Link>
        </div>
      )}
    </Sheet>
  );
}

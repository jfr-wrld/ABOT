import { Composition, Folder } from "remotion";
import { z } from "zod";
import { STORY_HEIGHT, STORY_PRESETS, STORY_WIDTH } from "@/lib/story-exporter";
import { STREAK_THEMES } from "@/lib/streak-card";
import { STORY_FPS, STORY_SECONDS } from "@/lib/story-motion";
import { StreakStory, WorkoutStory } from "./StoryCanvas";

const workoutSchema = z.object({
  layout: z.enum(STORY_PRESETS.map((p) => p.id) as [string, ...string[]]),
  sample: z.enum(["full-day", "one-lift", "many-records", "four-weeks"]),
  handle: z.string(),
  hideWatermark: z.boolean(),
});
const streakSchema = z.object({
  theme: z.enum(STREAK_THEMES.map((t) => t.id) as [string, ...string[]]),
  handle: z.string(),
  hideWatermark: z.boolean(),
});

const size = { width: STORY_WIDTH, height: STORY_HEIGHT, fps: STORY_FPS, durationInFrames: STORY_SECONDS * STORY_FPS };

/** One composition per workout layout and one for the streak: the same clips the phone encodes. */
export function Root() {
  return (
    <>
      <Folder name="Workout">
        {STORY_PRESETS.map((p) => (
          <Composition
            key={p.id}
            id={`workout-${p.id}`}
            component={WorkoutStory}
            schema={workoutSchema}
            defaultProps={{ layout: p.id, sample: "full-day" as const, handle: "jafarlifts", hideWatermark: false }}
            {...size}
          />
        ))}
      </Folder>
      <Folder name="Streak">
        <Composition
          id="streak"
          component={StreakStory}
          schema={streakSchema}
          defaultProps={{ theme: "volt-flame" as const, handle: "jafarlifts", hideWatermark: false }}
          {...size}
        />
      </Folder>
    </>
  );
}

import { useEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { renderStory, STORY_HEIGHT, STORY_WIDTH, type StoryFonts, type StoryPresetId } from "@/lib/story-exporter";
import { renderStreakCard, type StreakThemeId } from "@/lib/streak-card";
import { waitForFonts } from "./fonts";
import { storySample, streakSample, type Sample } from "./fixtures";

/**
 * One frame of an ABOT story, drawn by the app's own painter at this frame's time. Nothing here
 * is a copy of the design: tune the motion in src/lib (story-motion, story-exporter,
 * streak-card) and Studio redraws it.
 */
function useFrameCanvas(draw: (ctx: CanvasRenderingContext2D, fonts: StoryFonts, time: number) => void) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [fonts, setFonts] = useState<StoryFonts | null>(null);
  useEffect(() => waitForFonts(setFonts), []);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx && fonts) draw(ctx, fonts, frame / fps);
  });
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <canvas ref={ref} width={STORY_WIDTH} height={STORY_HEIGHT} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
}

export interface WorkoutProps {
  layout: StoryPresetId;
  sample: Sample;
  handle: string;
  hideWatermark: boolean;
  [key: string]: unknown;
}

export function WorkoutStory({ layout, sample, handle, hideWatermark }: WorkoutProps) {
  return useFrameCanvas((ctx, fonts, time) =>
    renderStory(ctx, storySample(sample, handle), { preset: layout, photo: null, overlay: 0.55, grayscale: false, hideWatermark }, fonts, time),
  );
}

export interface StreakProps {
  theme: StreakThemeId;
  handle: string;
  hideWatermark: boolean;
  [key: string]: unknown;
}

export function StreakStory({ theme, handle, hideWatermark }: StreakProps) {
  return useFrameCanvas((ctx, fonts, time) => renderStreakCard(ctx, streakSample(handle), { theme, hideWatermark }, fonts, time));
}

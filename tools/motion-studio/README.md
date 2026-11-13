# ABOT Motion Studio

Remotion Studio over the app's own story painters, for designing the motion of the share videos.
Design time only: nothing here ships in the app. The phone makes its MP4s with
`src/lib/video-export.ts` from the very same painters, so what plays here is what the phone encodes.

```bash
cd tools/motion-studio
npm install
npm run studio
```

- **Compositions:** `Workout/workout-<layout>` (the 8 layouts) and `Streak/streak`. Each is
  1080x1920 at 30 fps, 7 s.
- **Props**, editable in Studio's right panel:
  - the layout or streak theme;
  - the sample (a full day, one lift, many records, four weeks);
  - the @handle;
  - the watermark.
- **Where the motion lives:** change it in `src/lib/story-motion.ts` (beats and timings),
  `src/lib/story-exporter.ts` (workout layouts) and `src/lib/streak-card.ts` (streak). Studio
  redraws as you save.
- **Review sheets:** `npm run frames` (or `npm run frames -- workout-arcade`) renders frames at
  0, 1, 2, 3, 4.5, 6 and 6.7 s to `out/frames/`.
  - On a machine that cannot download Remotion's browser, set `REMOTION_BROWSER` to an
    installed Chrome or Chromium.
- **Licence:** ABOT uses Remotion under its free licence (an individual or a team of at most 3).
  Renders are test renders (`--is-production=false`) and pass no licence key.

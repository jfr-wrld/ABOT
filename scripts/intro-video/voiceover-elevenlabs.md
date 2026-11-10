# ABOT intro: voice-over for ElevenLabs

The same 22 lines as `voiceover.md`, written for ElevenLabs. Times are seconds from the start of
`video-out/abot-intro.mp4` (101 s), from `timeline.mjs`.

## Settings

- **Model: Eleven v3.** Only v3 acts on the audio tags in square brackets, such as `[sighs]` or
  `[excited]`, and does not read them aloud. Older models (Multilingual v2, Flash) read them as words,
  so with those, delete the tags and keep only the words.
- **Stability: Natural.** "Creative" overacts the meme lines; "Robust" ignores the tags.
- **Voice:** one narrator, mid-low, warm, a little dry. A conversational male or female voice from
  the Voice Library works; avoid "announcer" voices, which flatten the deadpan opening.
- **Pauses:** v3 takes no `<break>` tags. Use "..." for a beat, a full stop for a short stop, and an
  em dash for a cut-off.
- **ABOT** is said as one word, "AY-bot". If the voice spells it out, write `Aybot`.

## Clips, one per generation

Generating each line as its own clip keeps the sync: place each clip at its start time. Copy the
line under each label; the `#` lines are only labels.

```
# 01 · 0.4 s · problem
[deadpan] Me, every leg day.

# 02 · 1.4 s · problem
[confused] How much did I squat... last week?

# 03 · 5.7 s · problem
[sighs] [sarcastic] My notes? ...Useless.

# 04 · 6.9 s · problem
[flatly] No progress. No idea.

# 05 · 8.7 s · problem
[whispers] There's a better way.

# 06 · 11.9 s · hook
[confident] ABOT. Lift heavy. Log everything.

# 07 · 15.0 s · log
[warmly] One tap per set. Last week's numbers are already filled in.

# 08 · 21.8 s · bar
[calm] Rest timer running.

# 09 · 25.0 s · bar
[upbeat] Pause, finish a set or add one, right from the bar.

# 10 · 28.4 s · routines
[warmly] Build your own routines, or start from seventeen ready programs.

# 11 · 35.4 s · exercises
[confident] Eighty-eight exercises, each with photos, steps and the muscles they work.

# 12 · 42.0 s · progress
[proudly] Watch every kilo add up... week after week.

# 13 · 48.4 s · history
[excited] New records get counted, and a body map shows what you trained.

# 14 · 56.0 s · streak
[warmly] Train every week, and your streak keeps burning.

# 15 · 60.4 s · streak
[excited] Keep the fire going!

# 16 · 64.0 s · story
[playfully] Share any workout as a story, in eleven layouts.

# 17 · 71.5 s · share
[playfully] Or show off your streak. [laughs] Twelve themes, all free.

# 18 · 78.5 s · phase
[punchy] Cut. Bulk. Recomp. Peak.

# 19 · 80.8 s · phase
[calm] Calories and macros follow your training.

# 20 · 85.0 s · settings
[playfully] English or Bahasa Indonesia. Dark or light. Kilos or pounds.

# 21 · 90.0 s · trust
[reassuring] Works offline. No ads, no tracking. Your data stays on your phone.

# 22 · 96.2 s · outro
[confident] ABOT. The gym progress tracker. Free on Android and the web.
```

Line 18 must land one word per beat (78.5, 79.0, 79.5, 80.0). If the clip runs long, generate the
four words as four clips and place each on its beat.

## One take, if you prefer

For a single generation, paste this. The long "......" gaps leave room to cut the take into clips;
the timing will still need placing by hand.

```
[deadpan] Me, every leg day. ...... [confused] How much did I squat... last week? ......
[sighs] [sarcastic] My notes? ...Useless. ...... [flatly] No progress. No idea. ......
[whispers] There's a better way. ......
[confident] ABOT. Lift heavy. Log everything. ......
[warmly] One tap per set. Last week's numbers are already filled in. ......
[calm] Rest timer running. ...... [upbeat] Pause, finish a set or add one, right from the bar. ......
[warmly] Build your own routines, or start from seventeen ready programs. ......
[confident] Eighty-eight exercises, each with photos, steps and the muscles they work. ......
[proudly] Watch every kilo add up... week after week. ......
[excited] New records get counted, and a body map shows what you trained. ......
[warmly] Train every week, and your streak keeps burning. ...... [excited] Keep the fire going! ......
[playfully] Share any workout as a story, in eleven layouts. ......
[playfully] Or show off your streak. [laughs] Twelve themes, all free. ......
[punchy] Cut. Bulk. Recomp. Peak. ...... [calm] Calories and macros follow your training. ......
[playfully] English or Bahasa Indonesia. Dark or light. Kilos or pounds. ......
[reassuring] Works offline. No ads, no tracking. Your data stays on your phone. ......
[confident] ABOT. The gym progress tracker. Free on Android and the web.
```

## Mixing it in

Duck the soundtrack about 6 dB under the voice. Send the clips over (named `vo-01` to `vo-22`) and
they can be placed at these times with ffmpeg (`adelay` per clip, then `amix`) and muxed onto the
video, or dropped on a timeline in any editor.

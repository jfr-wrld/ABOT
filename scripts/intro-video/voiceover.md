# ABOT intro: voice-over script

For `video-out/abot-intro.mp4` (101 s). Times are in seconds from the start of the video, taken
from `timeline.mjs`. Each line fits its scene at a normal pace (about 2.3 words a second) and stays
clear of the big sound hits. Keep this file in step if the timeline changes.

## Voice

- One voice, male or female, mid-low, warm, a little dry.
- 0 to 10 s (the meme): deadpan, tired, like a friend telling a story against himself.
- From 10 s: confident and upbeat, never shouty.
- Leave the sound effects room: no voice over the BOOM (4.0 s) or the logo hit (10.6 s).

Style prompt for Google AI Studio (Gemini TTS), pasted above the text:

> Read this as the voice-over for a fast, funny gym app ad. Follow the expression in square brackets
> before each line; do not read the brackets aloud. The first five lines are deadpan, like a meme.
> From "ABOT." on, sound confident, warm and upbeat. Never shout.

## Expressions

Each line starts with tags in square brackets. Gemini TTS acts on them and does not read them:

- Sounds: `[sigh]`, `[laughing]`, `[uhm]`.
- Pauses: `[short pause]`, `[medium pause]`, `[long pause]`.
- Delivery, as plain words: `[deadpan]`, `[confused]`, `[sarcastic]`, `[confident]`, `[excited]`,
  `[warm]`, `[proud]`, `[playful]`, `[calm]`, `[punchy]`, `[slowly]`, `[whispering]`.

If a tag gets read aloud, move that mood into the style prompt and drop the tag. Sound and pause
tags are the most reliable.

## Lines

| # | Start | Scene | Expression | Line |
|---|------:|-------|------------|------|
| 1 | 0.4 | problem | `[deadpan]` | Me, every leg day. |
| 2 | 1.4 | problem | `[confused]` | How much did I squat `[short pause]` last week? |
| 3 | 5.7 | problem | `[sigh] [sarcastic]` | My notes? `[short pause]` Useless. |
| 4 | 6.9 | problem | `[deadpan] [slowly]` | No progress. `[short pause]` No idea. |
| 5 | 8.7 | problem | `[whispering]` | There's a better way. |
| 6 | 11.9 | hook | `[confident] [punchy]` | ABOT. `[short pause]` Lift heavy. Log everything. |
| 7 | 15.0 | log | `[warm] [confident]` | One tap per set. Last week's numbers are already filled in. |
| 8 | 21.8 | bar | `[calm]` | Rest timer running. |
| 9 | 25.0 | bar | `[punchy]` | Pause, finish a set or add one, right from the bar. |
| 10 | 28.4 | routines | `[warm]` | Build your own routines, or start from seventeen ready programs. |
| 11 | 35.4 | exercises | `[confident]` | Eighty-eight exercises, each with photos, steps and the muscles they work. |
| 12 | 42.0 | progress | `[proud]` | Watch every kilo add up, `[short pause]` week after week. |
| 13 | 48.4 | history | `[excited]` | New records get counted, and a body map shows what you trained. |
| 14 | 56.0 | streak | `[warm]` | Train every week, and your streak keeps burning. |
| 15 | 60.4 | streak | `[excited] [punchy]` | Keep the fire going. |
| 16 | 64.0 | story | `[playful]` | Share any workout as a story, in eleven layouts. |
| 17 | 71.5 | share | `[playful] [laughing]` | Or show off your streak. `[short pause]` Twelve themes, all free. |
| 18 | 78.5 | phase | `[punchy]` | Cut. `[short pause]` Bulk. `[short pause]` Recomp. `[short pause]` Peak. |
| 19 | 80.8 | phase | `[calm] [confident]` | Calories and macros follow your training. |
| 20 | 85.0 | settings | `[playful]` | English or Bahasa Indonesia. Dark or light. Kilos or pounds. |
| 21 | 90.0 | trust | `[calm] [warm]` | Works offline. No ads, no tracking. `[short pause]` Your data stays on your phone. |
| 22 | 96.2 | outro | `[confident] [proud]` | ABOT. `[short pause]` The gym progress tracker. `[short pause]` Free on Android and the web. |

Line 18 lands one word per beat (78.5, 79.0, 79.5, 80.0), with the words on screen; if the pauses
make it late, drop them and keep only the full stops.

## All lines, to paste

Generate each line as its own clip and place it at its start time; that keeps the sync. If the
tool only takes one block, use this and cut it at the `[long pause]` gaps.

```
[deadpan] Me, every leg day.
[long pause]
[confused] How much did I squat [short pause] last week?
[long pause]
[sigh] [sarcastic] My notes? [short pause] Useless.
[long pause]
[deadpan] [slowly] No progress. [short pause] No idea.
[long pause]
[whispering] There's a better way.
[long pause]
[confident] [punchy] ABOT. [short pause] Lift heavy. Log everything.
[long pause]
[warm] [confident] One tap per set. Last week's numbers are already filled in.
[long pause]
[calm] Rest timer running.
[long pause]
[punchy] Pause, finish a set or add one, right from the bar.
[long pause]
[warm] Build your own routines, or start from seventeen ready programs.
[long pause]
[confident] Eighty-eight exercises, each with photos, steps and the muscles they work.
[long pause]
[proud] Watch every kilo add up, [short pause] week after week.
[long pause]
[excited] New records get counted, and a body map shows what you trained.
[long pause]
[warm] Train every week, and your streak keeps burning.
[long pause]
[excited] [punchy] Keep the fire going.
[long pause]
[playful] Share any workout as a story, in eleven layouts.
[long pause]
[playful] [laughing] Or show off your streak. [short pause] Twelve themes, all free.
[long pause]
[punchy] Cut. [short pause] Bulk. [short pause] Recomp. [short pause] Peak.
[long pause]
[calm] [confident] Calories and macros follow your training.
[long pause]
[playful] English or Bahasa Indonesia. Dark or light. Kilos or pounds.
[long pause]
[calm] [warm] Works offline. No ads, no tracking. [short pause] Your data stays on your phone.
[long pause]
[confident] [proud] ABOT. [short pause] The gym progress tracker. [short pause] Free on Android and the web.
```

"ABOT" is said as one word, "AY-bot". If the voice spells it out, write it as "Aybot" for the TTS.

## Mixing it in

Duck the soundtrack about 6 dB under the voice. With the clips named `vo-01.wav` to `vo-22.wav`,
ffmpeg can place each at its start with `adelay`, mix with `amix`, and mux over the video; or drop
them on a timeline in any editor at the times above.

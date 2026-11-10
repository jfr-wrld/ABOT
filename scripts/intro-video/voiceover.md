# ABOT intro: voice-over script

For `video-out/abot-intro.mp4` (101 s). Times are in seconds from the start of the video, taken
from `timeline.mjs`. Each line fits its scene at a normal pace (about 2.3 words a second) and stays
clear of the big sound hits. Keep this file in step if the timeline changes.

## Voice

- One voice, male or female, mid-low, warm, a little dry.
- 0 to 10 s (the meme): deadpan, tired, like a friend telling a story against himself.
- From 10 s: confident and upbeat, never shouty.
- Leave the sound effects room: no voice over the BOOM (4.0 s) or the logo hit (10.6 s).

Style prompt for Google AI Studio (Gemini TTS):

> Read this as the voice-over for a fast, funny gym app ad. The first four lines are deadpan and a bit
> tired, like a meme. From "ABOT." on, sound confident, warm and upbeat, with short punchy pauses
> between sentences. Never shout.

## Lines

| # | Start | Scene | Line |
|---|------:|-------|------|
| 1 | 0.4 | problem | Me, every leg day. |
| 2 | 1.4 | problem | How much did I squat last week? |
| 3 | 5.7 | problem | My notes? Useless. |
| 4 | 6.9 | problem | No progress. No idea. |
| 5 | 8.7 | problem | There's a better way. |
| 6 | 11.9 | hook | ABOT. Lift heavy. Log everything. |
| 7 | 15.0 | log | One tap per set. Last week's numbers are already filled in. |
| 8 | 21.8 | bar | Rest timer running. |
| 9 | 25.0 | bar | Pause, finish a set or add one, right from the bar. |
| 10 | 28.4 | routines | Build your own routines, or start from seventeen ready programs. |
| 11 | 35.4 | exercises | Eighty-eight exercises, each with photos, steps and the muscles they work. |
| 12 | 42.0 | progress | Watch every kilo add up, week after week. |
| 13 | 48.4 | history | New records get counted, and a body map shows what you trained. |
| 14 | 56.0 | streak | Train every week, and your streak keeps burning. |
| 15 | 60.4 | streak | Keep the fire going. |
| 16 | 64.0 | story | Share any workout as a story, in eleven layouts. |
| 17 | 71.5 | share | Or show off your streak. Twelve themes, all free. |
| 18 | 78.5 | phase | Cut. Bulk. Recomp. Peak. |
| 19 | 80.8 | phase | Calories and macros follow your training. |
| 20 | 85.0 | settings | English or Bahasa Indonesia. Dark or light. Kilos or pounds. |
| 21 | 90.0 | trust | Works offline. No ads, no tracking. Your data stays on your phone. |
| 22 | 96.2 | outro | ABOT. The gym progress tracker. Free on Android and the web. |

Line 18 lands one word per beat (78.5, 79.0, 79.5, 80.0), with the words on screen.

## All lines, to paste

Generate each line as its own clip and place it at its start time; that keeps the sync. If the
tool only takes one block, use this and cut it at the blank lines.

```
Me, every leg day.

How much did I squat last week?

My notes? Useless.

No progress. No idea.

There's a better way.

ABOT. Lift heavy. Log everything.

One tap per set. Last week's numbers are already filled in.

Rest timer running.

Pause, finish a set or add one, right from the bar.

Build your own routines, or start from seventeen ready programs.

Eighty-eight exercises, each with photos, steps and the muscles they work.

Watch every kilo add up, week after week.

New records get counted, and a body map shows what you trained.

Train every week, and your streak keeps burning.

Keep the fire going.

Share any workout as a story, in eleven layouts.

Or show off your streak. Twelve themes, all free.

Cut. Bulk. Recomp. Peak.

Calories and macros follow your training.

English or Bahasa Indonesia. Dark or light. Kilos or pounds.

Works offline. No ads, no tracking. Your data stays on your phone.

ABOT. The gym progress tracker. Free on Android and the web.
```

"ABOT" is said as one word, "AY-bot". If the voice spells it out, write it as "Aybot" for the TTS.

## Mixing it in

Duck the soundtrack about 6 dB under the voice. With the clips named `vo-01.wav` to `vo-22.wav`,
ffmpeg can place each at its start with `adelay`, mix with `amix`, and mux over the video; or drop
them on a timeline in any editor at the times above.

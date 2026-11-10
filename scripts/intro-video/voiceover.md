# ABOT intro: voice-over script

For `video-out/abot-intro.mp4` (101 s). Times are in seconds from the start of the video, taken
from `timeline.mjs`. Each line fits its scene at a normal pace (about 2.3 words a second) and stays
clear of the big sound hits. Keep this file in step if the timeline changes.

## Voice

- One voice, male or female, mid-low, warm, a little dry.
- 0 to 10 s (the meme): deadpan, tired, like a friend telling a story against himself.
- From 10 s: confident and upbeat, never shouty.
- Leave the sound effects room: no voice over the BOOM (4.0 s) or the logo hit (10.6 s).

## How the expression is given

Mood words written as tags inside the text, such as `<warm>` or `<confident>`, get read aloud. So
each clip is written the way Gemini TTS takes a direction: an instruction, a colon, then the words.
The voice follows the part before the colon and reads only what comes after it:

```
Say warmly and confidently: One tap per set.
```

Pauses come from punctuation: a full stop, a comma or "..." for a longer beat. Sighs and laughs go
into the instruction ("with a tired sigh", "with a little laugh").

Generate each line as its own clip, then place it at its start time; that keeps the sync.

## Lines, one clip each

| # | Start | Scene | Paste this |
|---|------:|-------|------------|
| 1 | 0.4 | problem | Say in a flat, deadpan, bored voice: Me, every leg day. |
| 2 | 1.4 | problem | Say confused, trying hard to remember: How much did I squat... last week? |
| 3 | 5.7 | problem | Say with a tired sigh, dry and sarcastic: My notes? ...Useless. |
| 4 | 6.9 | problem | Say slowly, flat and defeated: No progress. No idea. |
| 5 | 8.7 | problem | Whisper, like sharing a secret: There's a better way. |
| 6 | 11.9 | hook | Say with confident, punchy energy: ABOT. Lift heavy. Log everything. |
| 7 | 15.0 | log | Say warmly and confidently: One tap per set. Last week's numbers are already filled in. |
| 8 | 21.8 | bar | Say calmly: Rest timer running. |
| 9 | 25.0 | bar | Say quick and punchy: Pause, finish a set or add one, right from the bar. |
| 10 | 28.4 | routines | Say in a warm, friendly voice: Build your own routines, or start from seventeen ready programs. |
| 11 | 35.4 | exercises | Say confidently: Eighty-eight exercises, each with photos, steps and the muscles they work. |
| 12 | 42.0 | progress | Say with quiet pride: Watch every kilo add up, week after week. |
| 13 | 48.4 | history | Say excited: New records get counted, and a body map shows what you trained. |
| 14 | 56.0 | streak | Say warmly: Train every week, and your streak keeps burning. |
| 15 | 60.4 | streak | Say excited and punchy: Keep the fire going. |
| 16 | 64.0 | story | Say playfully: Share any workout as a story, in eleven layouts. |
| 17 | 71.5 | share | Say playfully, with a little laugh: Or show off your streak. Twelve themes, all free. |
| 18 | 78.5 | phase | Say punchy, one word per beat, half a second apart: Cut. Bulk. Recomp. Peak. |
| 19 | 80.8 | phase | Say calm and confident: Calories and macros follow your training. |
| 20 | 85.0 | settings | Say playfully, light and quick: English or Bahasa Indonesia. Dark or light. Kilos or pounds. |
| 21 | 90.0 | trust | Say calm and warm, reassuring: Works offline. No ads, no tracking. Your data stays on your phone. |
| 22 | 96.2 | outro | Say confident and proud, like the end of an ad: ABOT. The gym progress tracker. Free on Android and the web. |

Line 18 lands one word per beat (78.5, 79.0, 79.5, 80.0), with the words on screen.

If a clip still reads part of the instruction, put the instruction in the style box of AI Studio
and paste only the words.

"ABOT" is said as one word, "AY-bot". If the voice spells it out, write it as "Aybot" for the TTS.

## Mixing it in

Duck the soundtrack about 6 dB under the voice. With the clips named `vo-01.wav` to `vo-22.wav`,
ffmpeg can place each at its start with `adelay`, mix with `amix`, and mux over the video; or drop
them on a timeline in any editor at the times above.

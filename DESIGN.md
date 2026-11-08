# ABOT: design direction

Reading this as: a mobile-first workout logger used mid-set, one hand, between reps, in a dim gym.
Direction is the owner's "Tactile Industrial Luxury" (2026-11-08): matte black hardware, one
high-voltage accent, every figure in a fixed-width face. Dials: ENERGY 2 / RHYTHM 2 / MOTION 2.

The owner chose the fonts, palette, accent colours, glow on the primary action, the floating dock
and the camera capsule. They are applied as direction, not as defaults; reasons are below.

## Palette (and why)

| Token | Value | Reason |
|---|---|---|
| `bg` | `#09090b` Matte Obsidian | Gym floors are dim and glances are short; near-black keeps the numbers the brightest thing on screen. |
| `surface` | `#121215` Carbon | One step up for cards. Separation comes from a hairline edge, not a lighter fill, so cards read as machined panels. |
| `surface-2` | `#1c1c21` | Chips and secondary buttons. |
| `well` | `#000` at 80% | Number inputs sit in a black well, so the white figure inside is the highest contrast on the card. |
| `line` / `line-hover` | white 7% / 15% | Card edges. Brightens on hover only when the card is itself a control. |
| `line-strong` | `#71717a` | Boundaries of form controls outside the set table (selects, file inputs): 3:1 against surface. |
| `text` | `#f4f4f5` | 18:1 on bg. |
| `text-muted` | `#a1a1aa` | Lowest grey used for text: 6.9:1 on surface. Zinc-500 measures 4.1:1 on bg and 3.8:1 on surface, below AA, so the owner's zinc-500 labels are set in zinc-400 instead. |
| `accent` | `#ccff00` Volt | Owner direction. Marks what is live or primary: Finish, the done check, the rest countdown, the current tab, the current week's bar. Black text on Volt is 18:1. |
| `pr` | `#00f0ff` Electric Cyan | Owner direction. Personal records only, so a record never reads as "done". 14:1 on bg. |
| `warmup` / `dropset` / `failure` | `#facc15` / `#c084fc` / `#f87171` | Set types W, D, F. Always paired with the letter, never colour alone. |

Core palette: neutrals plus Volt. Cyan and the set-type colours are status labels with one job each.

## Where the accent lands

Volt is "live or primary". Per screen: the single primary action, the done state of a set, the
running rest timer, and the current tab icon. Cyan appears only where a record was set.

## Typography

- **Inter** for words: labels, names, instructions. Neutral and legible at 12px on a phone held at
  arm's length, so the figures carry the character.
- **JetBrains Mono** for every figure: weight, reps, RPE, timers, volume, 1RM, dates, chart ticks.
  It has fixed-width digits with a slashed zero, so `102.5` and `62.5` line up in the 60px column
  and a running timer never shifts sideways as it ticks. The `num` utility applies it.
- Sizes: set inputs `text-lg` bold, header stats `text-xl` bold, the rest countdown `text-xl`
  extrabold in Volt. Column and stat labels use `label-caps`: mono 10px, 0.1em tracking, uppercase.
  The tracking keeps 10px capitals from merging on a phone screen.

Both fonts load through `next/font/google`, which downloads them at build time and serves them from
the app, so the browser makes no request to Google.

## Layout

Phone first at 360px, one column. The set table is a fixed grid
(`44px minmax(0,1fr) 60px 44px [40px] 44px`): the weight column is the narrowest that fits `102.5`
in 18px mono; Prev takes what is left. Every tap target is 44px. At 640px and up the column caps at
640px and centres.

## Home (command centre)

Owner brief 2026-11-08: Home is a dense command centre, then (same day) "less busy, less text".
So every block is a figure or a control, with at most one short mark under it:

- **Week strip**: seven day letters over seven cells. A trained day is a Volt tile with a check
  (done, the same meaning as a ticked set), today has a thin white ring, other days a dim
  zinc-800 dot.
- **Next up**: the routine name and two buttons. Start (Volt, the screen's one primary action)
  starts the scheduled routine, else the one after the last routine trained; `+ Empty` sits beside
  it with a hairline edge. With no routines: Free session, Start an empty workout, Create a routine.
- **Three instruments** in one row, 12px-radius Carbon tiles: kg lifted this week (with the change
  against last week up to the same moment, so Monday is not "-90%"), sessions (against the
  schedule when one is set, with Volt segments), and muscle groups ready on the 48-hour rule.
  The unit lives in the label so the figure fits a 320px screen.
- **Recent workouts**: name, a Cyan record pill only when a lift beat an earlier record (a first
  attempt beats nothing), date, and duration, volume and sets in mono. Cards give to 98% under
  the thumb. The trophy is the Lucide icon used for records elsewhere, not the emoji.

## Navigation and Profile

Owner brief 2026-11-08: Workout and Routines become one tab; Progress moves into Profile, laid
out like a social profile.

- **Dock**: four tabs, Home, Workout, Exercises, Profile. Profile's icon is the lifter's own plate
  (photo or initials), dimmed until it is the current tab like the other icons. `/routines` and
  `/progress` still work: the first shows the same library, the second forwards to Profile.
- **Workout tab**: the logger while a workout runs. Otherwise "Start an empty workout" (the one
  Volt action) above the routine library, where each routine has a quiet Start and its edit,
  duplicate and delete controls.
- **Profile**: a cover, the plate overlapping its lower edge with a page-coloured ring, Edit
  profile beside it, then the name, one mono line (workouts, streak) and the backup chip. The
  cover is the last twelve weeks of volume drawn as a skyline in dim Volt with the current week
  brighter: the lifter's own data instead of a stock banner, plain Carbon until there is any.
  Below, a sticky tab bar (Progress, Lifts, About; the open tab is kept in `?tab=`) with a Volt
  underline on the current one. Progress holds the lifetime figures and the charts, Lifts the
  e1RM ranking, About the bodyweight log, name and height, the account and settings.

## Workout bar, info tips and status outside the app

Owner brief 2026-11-08:
- **Workout bar above the dock.** The camera capsule (elapsed time; the rest countdown with
  -15 s, +15 s and skip) moved from under the status bar to just above the dock, where the thumb
  already is between sets. Pages add its height to their bottom padding (`--live-bar`), so it
  never covers the last row.
- **Info tips in Settings.** Each setting is a short title with an (i) beside it; the sentence
  that explains it opens under the title on tap, instead of every explanation always showing.
- **Status outside the app.** The owner asked for a Dynamic Island while ABOT is in the
  background. iOS Live Activities (Dynamic Island) and Android live updates are only open to
  native apps, so the web app posts one status notification instead when it is hidden during a
  workout: "<workout> · rest until 14:32" with the next set below, cleared on return. Times are
  absolute because background pages cannot tick. Opt-in under Settings, Status outside the app.

## Identity motif

The set row as a hardware switch: a dark panel that, when you tap the square check, lights Volt,
draws the tick, and passes one band of light across the row. The workout reads as a column of
switches being thrown.

## Radius, shadow, glow, glass

- Radius: 16px cards and the dock, 12px buttons and set rows, 10px inputs, 8px set chips, full
  round only for the camera capsule. The steps mark hierarchy.
- Glow: two elements only. The Finish button (the one action that ends the session) and the
  camera capsule's edge (it sits over content and must read as an object).
- Glass: the bottom dock only. The set list stays readable as it scrolls under it.
- Shadow: the dock only, as the elevation of the one floating layer.

## Motion

Purpose for each: the check press springs and the tick draws, so you feel the set land; the light
sweep confirms which row changed; the camera capsule morphs between running time and rest
countdown with one shared layout, so you see it is the same object changing state; the rest bar
along the capsule's bottom edge shrinks with time, which is the information. Springs settle in
about 200ms. Everything respects `prefers-reduced-motion` through one `MotionConfig`: movement and
scale drop out, fades stay.

Added at the owner's request (2026-11-08), each with its job:

- **Splash** (`components/animations/SplashScreen.tsx`, `components/brand/AnimatedAbotMark.tsx`):
  the plate assembles the way a plate goes onto a bar. Its outline is traced in Volt (0.45s), it
  fills while turning one flat (60 degrees, spring 140/16), the centre hole is punched (a mask
  circle growing to 22), the inner ring is scored, and one band of light passes across it, the
  same sweep as a ticked set. "ABOT" rises letter by letter from a slot, the plate glows once as
  if switched on, and the loading hairline fills. About 1.15s minimum while saved data is read;
  it leaves by scaling up 4% as it fades. With reduced motion the mark is simply drawn. Cost:
  every full load waits at least 1.15s; tab switches inside the app do not show it.
- **Page transitions** (`components/animations/PageTransition.tsx`): the old page settles to 98%
  and fades in 0.12s, then the new one comes forward in 0.2s. Opacity and transform only, so the
  compositor does the work. It keeps the outgoing page on screen through Next's internal router
  context; if a Next upgrade moves that module, drop the exit and keep the enter.
- **Intro** (`app/onboarding`, `components/onboarding/Illustrations.tsx`): three slides, each with
  an original illustration built from ABOT's own parts and acting out its sentence on a 3.6s loop:
  a fingertip taps a set's check, the row lights, the band of light passes and a Cyan PR pops; a
  phone with the rest capsule counting down above the dock, the thumb's reach traced as a dashed
  Volt arc; a barbell sleeve inside a phone loaded plate by plate (side view) and clamped, with the
  signal gone. The illustration travels further than the text between slides (90 vs 64 px), so
  the slide has depth, and a large faint plate behind everything turns one flat per step. Swipe or
  Next. Reduced motion shows each scene's end state. Shown once per device, never to anyone with data.
- **Sign-in** (`app/login`): content rises from the bottom with the same spring. One Volt action
  per state: Sign in with Google when this build has cloud sync, Continue without an account when
  it does not (the Google button then disabled with a plain note), Done once signed in. A back
  link returns to the page that opened it (`?from=`), since the dock is hidden here. After Google,
  the lifter lands back on that page with a short notice above the dock.
- **Press springs**: every button gives to 96% under the thumb; primary actions (Start, Finish,
  the set check) also lift to 102% on hover.

## Logo

A flat-top hexagon weight plate with a round centre hole and a thin inner ring
(`src/components/brand/AbotMark.tsx`, favicon `src/app/icon.svg`), in Volt on Obsidian, with the
wordmark in Inter Black, tight tracking.

## Icons

Lucide (owner's brief), only where a glyph carries meaning next to a label or in a known spot: the
tabs (always with text), the check, timer controls, the card menu and info. No decorative icons.

## States

Every list has an empty state that says why it is empty and the one action that fills it. Data
lives on the device, so error states are reserved for storage failures and shown inline.

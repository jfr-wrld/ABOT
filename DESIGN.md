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

## Light theme

Settings > General > Theme: System (default, follows the phone), Dark, Light. The same token names
take light values on `[data-theme="light"]` (`globals.css`), checked against white: text 16:1,
muted 7.7:1, accent text `#3f6212` 7:1, accent fill `#65a30d` 3.1:1 with black text on it at 6.8:1,
PR `#155e75` 7.3:1 (5.7:1 on its own tint, where `#0e7490` fell to 4.3:1). Volt `#ccff00` cannot carry text on white, so `text-accent` switches to the
darker lime there; fills and borders use the mid lime.

- **`ink`** is white on dark and black on light: hairlines and hovers are `border-ink/[…]` and
  `bg-ink/[…]`, never `white/[…]`.
- Charts read the same tokens (`chartTheme.ts`: accent, line, text-muted, surface), so a series
  is the mid lime on white instead of Volt, which nearly vanishes there.
- `force-dark` sets tokens but no background: give the dark block its own fill (a photo, `bg-bg`),
  or text under it turns white on the light page. The exercise page keeps only its photo dark.
- **`force-dark`** keeps the dark tokens inside it on a light page: photo and video boxes, the
  exercise hero, the live workout capsule, the splash, onboarding and Story Studio (a darkroom).
- The theme is set before the first paint by `THEME_SCRIPT` (`ThemeController.tsx`) from a
  `localStorage` mirror, so a light page never flashes dark. Android's status bar icons follow it.

## Settings

A short list of groups (Account, Preferences, Support, Follow ABOT); each row opens its section
at `/settings?section=…`: General (language, theme, units, week start), Workout, Notifications,
Data & backup, FAQ, About. Contact is a mail link with the app version in the subject. Social
rows read "Soon" until `src/lib/social.ts` has their links. Sign out sits at the bottom, behind a
confirm, and keeps every workout on the phone.

## Plate calculator

"Plates" on a barbell (or Smith machine) exercise card opens it, starting from the next set
waiting to be done. `src/lib/plate-calculator.ts` loads each sleeve greedily from the heaviest
plate, in integer grams, and reports what the plates cannot make. Bars: 20 / 15 / 10 / 0 kg
(45 / 35 / 25 / 0 lb). Plates take IWF-inspired colours (25 Crimson `#ef4444`, 20 Cyber Blue
`#3b82f6`, 15 Amber `#eab308`, 10 Green `#22c55e`, 5 Titanium `#e4e4e7`, 2.5 Carbon `#18181b`
with a Volt edge, 1.25 Chrome `#71717a`). The sleeve drawing stays dark in both themes, like a
product shot. With a gym on the workout, the bar and plates are that gym's and changes save to
it; otherwise they are remembered on the device. Figures are tabular (`num`).

## Sound and vibration

Hardware feel, synthesised with Web Audio (`src/lib/sound-effects.ts`, no audio files) and
paired with graduated vibration (`src/lib/haptics.ts`; Capacitor Haptics in the app):

| Moment | Sound | Vibration |
| --- | --- | --- |
| Stepper, filter chip, Story layout, view toggle | tick: 12 ms triangle, 1400 to 300 Hz | 8 ms |
| Set ticked off | latch: 600 Hz then 900 Hz, 90 ms | 15, 30, 25 ms |
| New record on a lift logged before | A major arpeggio 440, 554, 659, 880 Hz | 30, 40, 60, 40, 100 ms |
| Rest timer at zero (Rest alert) | three 1000 Hz pulses | 200, 100, 200 ms |
| Rest at 3, 2, 1 seconds left (Rest alert) | 50 ms 800 Hz triangle pip | none |
| Workout started | 220 to 440 Hz glide, then an 880 Hz click | 15, 40, 15 ms |
| Finish summary opens | C major rolled upward, 523 to 1047 Hz (1319 Hz on top for a record) | 30 ms (30, 60, 30, 60, 60 with a record) |

Settings > Workout > Sounds & vibration switches the tap sounds off (on by default); the rest
countdown and alarm follow Rest alert. A first-ever lift is a baseline, so it plays no record
chord. The first touch unlocks Web Audio so the timer-driven rest beep can play. In the Android
app the page beeps while ABOT is on screen and the system notification rings while it is not
(`LiveWorkoutReceiver` checks `MainActivity.inForeground`), so a rest ends with one alarm, not two.

## Supersets and giant sets

- Cards in one group share a coloured left edge, and the edge runs through the gap between
  neighbouring cards, so the group reads as one bracket. Each group keeps its own colour
  (orange, blue, pink, green) rather than Volt: Volt already means "live", and two supersets
  in one workout must stay apart.
- Badge: `Superset // A1`, `A2`; three or more exercises is `Giant set // A1` to `A3`. The
  number is the card's place in the list, so reordering renumbers it.
- Ticking a set hands off to the next exercise of the group that has a set left: no rest, the
  island shows `Up next A2 · No rest` with the name and set, and the screen scrolls to that
  card. Rest starts after the last exercise with work left.
- On white the group colours are darkened (`.ss-text`) to stay above 4.5:1.

## Recovery map

- Fatigue model (`src/lib/muscle-recovery.ts`): each working set adds 15% to primary muscles and
  7.5% to secondary ones, scaled by RPE (8 = 1x, 10 = 1.25x, 6 = 0.75x), capped at 100%. It
  falls in a straight line: big muscles (chest, back, lats, quads, hamstrings, glutes, lower
  back) clear in 72 hours, about 1.4% an hour; the rest in 48. Worked out from history on every
  render, so imported or edited workouts count at once.
- Four stages on Carbon (the map is always dark, like the island): Fresh 0-20% `#27272a` with a
  thin light edge, Recovering 21-50% Volt at 50%, High load 51-80% Amber `#f59e0b`, Exhausted
  81-100% Crimson `#ef4444`. Head, hands and joints sit darker than any muscle so the colours read.
- Home tile: both sides small, "n/17 ready". Tap opens a sheet with one side at a time
  (Anterior / Front, Posterior / Back) and a telemetry line per muscle: recovery %, last
  trained and sets in that session, hours to ready (20% or less). Muscles are keyboard focusable.

## Where the accent lands

Volt is "live or primary". Per screen: the single primary action, the done state of a set, the
running rest timer, and the current tab icon. Cyan appears only where a record was set.

## Typography

- **Plus Jakarta Sans** for words: labels, names, instructions, buttons. The owner asked for a more
  modern face (2026-11-09); its open, geometric shapes and tall x-height keep 12px labels legible
  at arm's length, and it tops out at weight 800, so `font-extrabold` is the heaviest used.
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

Owner briefs 2026-11-08: a dense command centre; then less text; then "more visual, with
animation". So Home tells the week in pictures, each with one job:

- **Week strip**: day letters over cells; trained days are Volt tiles with a check that pop in one
  after another, today has a white ring that breathes slowly, other days a dim zinc-800 dot.
- **Next up**: the routine name, its lifts as a row of exercise photos, Start (Volt, with a play
  icon) and a square + for an empty workout. A thin plate outline turns slowly behind it (60 s per
  turn). With no routine: Free session, Start an empty workout and + to create one.
- **Volume**: the week's figure counts up from zero, the change against last week at the same
  point (trend arrow), and a bar per day of the week that grows into place, today in full Volt.
- **Days ring**: sessions this week as a ring that draws itself, against the schedule when one is
  set, else out of 7 days.
- **Body map**: front and back, muscles worked in the last 48 hours lit (resting), with "4/6 ready".
- **Recent workouts**: name, Cyan PR pill (only when a lift beat an earlier record), a relative day
  (Today, Yesterday, Wed), the lifts as small photos, and duration, volume and sets as icons with
  mono figures. Cards slide in in order and give to 98% under the thumb.

Entrance animations start from an effect (pages mount inside AnimatePresence with
initial={false}); every animated element starts from an inline style. Reduced motion shows the
final state.

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

## Dock scope and the workout detail

Owner brief 2026-11-08:
- **The dock is for the four top-level screens only** (Home, Workout, Exercises, Profile, and their
  old addresses /routines and /progress). Detail screens (a past workout, the summary, an exercise,
  the routine editor, settings, sign-in, the intro) get the whole screen and their own way back.
  Its height is one CSS value (`--dock-h`) that page padding, the workout bar and notices read.
- **Workout detail** (`/history/[id]`): the workout's own exercise photos blurred into a drifting
  backdrop behind the crisp photos, the date and the name; a floating back pill and an options
  menu (delete lives there, off the thumb's path). Four icon tiles count up (duration, volume,
  sets, records), a body map lights the muscles worked, and each exercise card shows its photo,
  gear, share of the workout's volume as a bar, and its sets with a bar for load against the
  heaviest set: records in Cyan, the best set by e1RM marked; tap to fold. A bottom action bar
  holds Repeat (starts the same lifts with the same numbers) and Share story. Records count once
  per lift and only when they beat an earlier one, the same rule as the PR pill on Home.

## Workout summary (after Finish)

Owner brief 2026-11-08: a moment of completion, then the numbers, with motion.
- **Completion mark**: the plate outline is traced shut, fills faintly, a check is drawn, and
  twelve small plates burst outward, Cyan when a record fell, Volt otherwise (about 1.4 s). One
  short buzz on phones that vibrate, only if rest alerts are on and the page was reached by a tap.
- Four icon tiles count up (duration, volume, sets, exercises).
- **Volume vs last time**: the previous session of the same routine (or name) as two bars and a
  change pill (Volt when up).
- **Records** pop in as Cyan cards, one per lift, one chip per record-setting set with the kinds
  it broke (WEIGHT, E1RM, VOLUME). **New lifts** (first time logged) are listed as the baseline,
  not as records: there was nothing to beat. Same rule as Home and the workout detail.
- A body map of the muscles worked; a bottom bar with Share to IG Story, See every set, Home.

## Story Studio

- Eleven layouts drawn straight to a 1080 x 1920 canvas (`src/lib/story-exporter.ts`).
- **@username**: set once (Profile > About, or the field in the studio; both save to
  `profileHandle`). Every layout prints it in its own free space and text colour (`HANDLE_SPOTS`);
  the receipt prints it as a MEMBER line. Empty means the story goes out without it.

## Exercise detail

Owner brief 2026-11-08: revamp it with pictures, icons and motion.
- **Hero**: the exercise's two real photos (start and end position, free-exercise-db) across the
  full width, crossfading every 0.9 s like a GIF, with Start/End dots and a pause button; the
  back pill floats over it. Owner's call: real photos read more clearly than the stick figure.
  Offline it shows the photo bundled with the app; with no photo at all, the animated figure.
  Then the name, and muscle and gear with their icons. How to's Motion tab also opens on Photos,
  with Animation one tap away.
- Four tiles count up: best e1RM (Cyan) or most reps for bodyweight, heaviest, workouts, last done.
- Summary keeps the body map and records; the e1RM line draws itself and carries a trend chip
  (first to latest point, Volt when up). History cards show a relative day and a load bar per set.
- A bottom bar: Start a workout with this, or, with a workout running, Add to workout (then
  "In your workout") beside a button back to it.
- Detail pages with a bottom bar report its height (`--action-bar`), so the workout capsule sits
  above the bar instead of over its buttons.

## Identity motif

The set row as a hardware switch: a dark panel that, when you tap the square check, lights Volt,
draws the tick, and passes one band of light across the row. The workout reads as a column of
switches being thrown.

## Radius, shadow, glow, glass

- Radius: 16px cards and the dock, 12px buttons and set rows, 10px inputs, 8px set chips, full
  round only for the camera capsule. The steps mark hierarchy.
- Glow: two elements only. The Finish button (the one action that ends the session) and the
  camera capsule's edge (it sits over content and must read as an object).
- Glass: the two floating layers only, the bottom dock and the workout bar just above it (owner's
  choice, 2026-11-10). Both sit over scrolling content, so glass says "this floats"; cards, set
  rows, buttons, sheets and headers stay solid matte so figures read at a glance. The workout bar
  keeps a dark glass in both themes and its Volt edge glow.
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

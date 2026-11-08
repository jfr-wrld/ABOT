# ABOT: design direction

Reading this as: a mobile-first workout logger for lifters who use it mid-set, one hand, between
reps, in a dark, high-contrast, utilitarian style set by the owner's brief (dark slate, electric
blue accent, Hevy-like flow). Dial: ENERGY 2 / RHYTHM 2 / MOTION 1.

The owner explicitly asked for a Hevy-style logger, Lucide icons, dark default, and the W/D/F
color code. Those are direction, not defaults, and are applied as such.

## Palette (and why)

| Token | Value | Reason |
|---|---|---|
| `bg` | `#09090b` | Owner's brief. Gym floors are dim and glances are short; near-black keeps the numbers the brightest thing on screen. |
| `surface` | `#18181b` | One step up for exercise cards so they read as grouped sets without borders everywhere. |
| `surface-2` | `#27272a` | Inputs and chips sit on this so a field is visibly a field. |
| `line` | `#3f3f46` | Decorative dividers only (not control boundaries). |
| `line-strong` | `#71717a` | Control boundaries (inputs, outlined buttons): 3:1 against surface, which `line` does not reach. |
| `text` | `#fafafa` | 19:1 on bg. |
| `text-muted` | `#a1a1aa` | Lowest grey allowed for text: 6.9:1 on surface. Zinc-500 fails AA and is never used for text. |
| `accent` | `#3b82f6` | Owner's brief. Used as text/outline and as the completed-set tint. 5.4:1 on bg. |
| `accent-solid` | `#2563eb` | Filled primary buttons: white on `#3b82f6` is only 3.68:1, white on this is 5.17:1. |
| `warmup` / `dropset` / `failure` | `#facc15` / `#c084fc` / `#f87171` | Owner's brief (W yellow, D purple, F red). All above 6:1 on surface. Always paired with the letter, never color alone. |

Core palette is neutral + one accent; the three set-type colors are status labels with a function, not palette.

## Where the accent lands

One place per screen: the completed-set check (and the row tint it leaves behind) during a workout,
and the single primary action elsewhere (Start workout, Finish). Everything else is neutral.

## Typography

Geist Sans, loaded by the scaffold, kept on purpose: it ships tabular numerals (`tnum`), which the
set table needs so 100 and 62.5 line up in a 60px column, and its large x-height stays legible at
13px in the Previous column. Headline numbers (duration, volume, sets) are the only large type.

## Layout

Phone first at 360px, one column. The set table is a fixed six-track grid
(`44px minmax(0,1fr) 60px 52px 48px 44px`) so every row aligns and every tap target is 44px tall.
At 640px and up the content column caps at 640px and centres; the logger does not need more width.
Bottom tab bar for the primary destinations (one thumb away), with `env(safe-area-inset-bottom)`
and matching scroll padding so the last set row is never covered.

## Identity motif

The set-type letter in a square chip (W, D, F, or the set number) at the start of every row, and
the row filling with the accent tint when a set is done. The workout screen reads as a column of
chips turning blue as you work through it.

## Radius, shadow, motion

Radius: 6px on controls and chips, 12px on cards and sheets. No pills. No shadows: cards are
separated by surface steps, and the only elevated layer is the bottom sheet. Motion: the rest-timer
bar shrinks with time (it is the information), transitions under 200ms on state changes, and all of
it is off under `prefers-reduced-motion`.

## Logo

The ABOT mark is a flat-top hexagon weight plate with a round centre hole and a thin inner
ring (`src/components/brand/AbotMark.tsx`, favicon `src/app/icon.svg`), in the accent blue on
Obsidian. Owner direction (2026-11-08): bold industrial wordmark, tight tracking, geometric
plate icon. The wordmark is set in Geist Black with `tracking-tight`.

## Icons

Lucide (owner's brief), used only where the glyph carries meaning without a label being possible:
the bottom tabs (with text labels), the set-complete check, timer controls, and the exercise-card
menu. No decorative icons.

## States

Every list has an empty state that says why it is empty and the one action that fills it. Stores
hydrate from localStorage, so pages show "Loading saved workouts" until then. Data lives on the
device; there is no network, so the error state is reserved for storage failures and is shown inline.

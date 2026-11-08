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
about 200ms. Everything respects `prefers-reduced-motion`.

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

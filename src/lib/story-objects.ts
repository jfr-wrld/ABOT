/**
 * The things a Clean story compares the volume with ("you lifted 2 elephants"), drawn for ABOT:
 * flat side views on a 48-unit grid, facing right, in one colour with darker marks for windows,
 * eyes and wheel arches. Each layer is an SVG path, drawn in order.
 *
 * Tones: `main` is the story's accent, `shade` and `deep` darken whatever is under them (so they
 * read on Volt and on a photo alike), `light` is near white (tusks, lights).
 */

export type ObjectTone = "main" | "shade" | "deep" | "light";

export interface ObjectLayer {
  d: string;
  tone: ObjectTone;
  /** Drawn as a line of this width instead of filled. */
  stroke?: number;
}

const circle = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

/** A wheel: a dark gap around it, the tyre, and the hub. */
const wheel = (cx: number, cy: number, r: number): ObjectLayer[] => [
  { d: circle(cx, cy, r + 1.1), tone: "deep" },
  { d: circle(cx, cy, r), tone: "main" },
  { d: circle(cx, cy, r * 0.42), tone: "deep" },
];

export const LIFT_SHAPES: Record<string, ObjectLayer[]> = {
  cat: [
    // Tail curling up behind.
    { d: "M33 40c6 0 9.5-3 9.5-7.5c0-3-2-5-4.5-5", tone: "main", stroke: 3 },
    // Body, sitting.
    { d: "M16.5 24.5C12 29 11 35 12.5 40.5h22c1.5-5.5.5-11.5-4-16Z", tone: "main" },
    // Head with ears.
    { d: "M14.5 19.5V8.5l6 5h7l6-5v11c0 5.5-4.2 8.5-9.5 8.5s-9.5-3-9.5-8.5Z", tone: "main" },
    { d: "M16.6 11.8l2.6 2.2l-2.6 1.3Z M31.4 11.8l-2.6 2.2l2.6 1.3Z", tone: "shade" },
    // Eyes, nose, front legs.
    { d: "M19.2 18.8a1.6 2 0 1 0 3.2 0a1.6 2 0 1 0-3.2 0Z M25.6 18.8a1.6 2 0 1 0 3.2 0a1.6 2 0 1 0-3.2 0Z", tone: "deep" },
    { d: "M22.6 22.3h2.8l-1.4 1.5Z", tone: "deep" },
    { d: "M20 30v10.5 M28 30v10.5", tone: "shade", stroke: 1.2 },
  ],
  bicycle: [
    { d: circle(11.5, 32, 8), tone: "main", stroke: 2.6 },
    { d: circle(36.5, 32, 8), tone: "main", stroke: 2.6 },
    // Frame, seat post, fork.
    { d: "M11.5 32L19 20h13.5L36.5 32 M19 20l5.5 12h-13 M24.5 32l8-12 M18 15.5L19.5 20 M31 14.5l1.5 5.5", tone: "main", stroke: 2.4 },
    // Saddle and handlebar.
    { d: "M14.5 14.5h7 M29 14h5", tone: "main", stroke: 2.8 },
    { d: circle(24.5, 32, 2), tone: "main" },
  ],
  fridge: [
    { d: "M15 7.5Q15 4.5 18 4.5h12q3 0 3 3v33q0 2-2 2H17q-2 0-2-2Z", tone: "main" },
    // The door line and the two handles.
    { d: "M15 17h18v1.4H15Z", tone: "deep" },
    { d: "M29 8.5h1.8v5.5H29Z M29 21.5h1.8v9H29Z", tone: "shade" },
    { d: "M17 42.5h3v1.8h-3Z M28 42.5h3v1.8h-3Z", tone: "main" },
  ],
  motorbike: [
    // Rear body under the seat, the footboard and the front shield.
    { d: "M5 31c0-5 3.5-8 9-8h12.5l1.5 8Z", tone: "main" },
    { d: "M18 29h14l-1 3.5H19Z", tone: "main" },
    { d: "M29 32.5L33.6 14h3.4l-3.6 15.5c-.5 2-2 3-4 3Z", tone: "main" },
    // Seat.
    { d: "M9.5 21.5q0-2.5 2.5-2.5h12q2.5 0 2.5 2.5v1.5h-17Z", tone: "main" },
    { d: "M9.5 23h17v.9h-17Z", tone: "shade" },
    // Handlebar, mirror stalk and headlight.
    { d: "M31.5 13.5h8 M35 13.5l-1.5-4", tone: "main", stroke: 2.2 },
    { d: "M37.2 16.4l3 .8l-.6 2.2l-3-.8Z", tone: "light" },
    // Front mudguard.
    { d: "M34.5 30.5a6.5 6.5 0 0 1 9.5 3", tone: "main", stroke: 2 },
    ...wheel(11, 36, 5.5),
    ...wheel(38, 36, 5.5),
  ],
  car: [
    { d: "M4 30.5c0-3.6 2-5.2 5-5.8l6.5-1.2l5.6-6.4c1-1.1 2.3-1.6 3.8-1.6h8.3c1.5 0 2.8.6 3.8 1.7l4.8 5.5c3.2.6 5.2 2.2 5.2 5.4v3.5c0 1-.7 1.7-1.7 1.7H5.7c-1 0-1.7-.7-1.7-1.7Z", tone: "main" },
    // Windows: front and back, split by the pillar.
    { d: "M18 23.4l4.5-5.1c.5-.5 1.1-.8 1.8-.8H29v5.9Z", tone: "deep" },
    { d: "M30.8 17.5h2.3c.7 0 1.3.3 1.8.8l4.6 5.1h-8.7Z", tone: "deep" },
    // Door line, handle, head and tail lights.
    { d: "M29.9 24.5v6.5", tone: "shade", stroke: 0.8 },
    { d: "M25.5 25.6h2.6 M33 25.6h2.6", tone: "shade", stroke: 0.9 },
    { d: "M43 26.4h2.4v2.4h-2.6Z", tone: "light" },
    { d: "M4.1 26.8h1.9v2.2H4Z", tone: "shade" },
    ...wheel(13, 32.5, 4.6),
    ...wheel(36.5, 32.5, 4.6),
  ],
  elephant: [
    // Tail.
    { d: "M41.5 18.5l3 7", tone: "main", stroke: 1.6 },
    // Body, back legs and front legs.
    { d: "M16 21c0-6 4.5-9.5 11-9.5h7c5.5 0 9 3.5 9 9v5.5c0 3-1 4.5-2.5 5.5V41q0 1.5-1.5 1.5h-3q-1.5 0-1.5-1.5v-7h-8v7q0 1.5-1.5 1.5h-3q-1.5 0-1.5-1.5Z", tone: "main" },
    // Head.
    { d: "M5.5 20.5c0-5.5 4-9.5 9.5-9.5c5 0 9 3.5 9 9c0 4.5-2 7-5 8.5V41q0 1.5-1.5 1.5h-3q-1.5 0-1.5-1.5v-9.5c-3-1.5-7.5-4.5-7.5-11Z", tone: "main" },
    // Trunk, curling forward at the tip.
    { d: "M8 25c-2.5 4-3 8.5-2 12.5c.4 1.8 1.6 2.6 3.2 2.2", tone: "main", stroke: 4.2 },
    // The big ear, a darker flap over the head and shoulder.
    { d: "M15.5 12.5c5 -1.5 9.5 2 9.5 7.5c0 5-3 8.5-7.5 8.5c-2.5 0-3.5-2-3.5-4.5Z", tone: "shade" },
    // Tusk and eye.
    { d: "M9.5 27.5c1.5 2.5 4 3.5 6.5 3", tone: "light", stroke: 1.8 },
    { d: circle(10.5, 18.5, 1.1), tone: "deep" },
  ],
  bus: [
    { d: "M3 16q0-4 4-4h33.5q2 0 3 1.5l2.3 3.5q.7 1 .7 2.5V33q0 2-2 2H5q-2 0-2-2Z", tone: "main" },
    // Side windows, the door and the windscreen.
    { d: "M6 15.5h6v7.5H6Z M14 15.5h6v7.5h-6Z M22 15.5h6v7.5h-6Z M30 15.5h4.5v7.5H30Z", tone: "deep" },
    { d: "M36 15.5h4.5v16.5H36Z", tone: "deep" },
    { d: "M42 15.5h.5l2.5 3.8V25h-3Z", tone: "deep" },
    // The stripe along the side, a door split and the headlight.
    { d: "M3 26.5h33v1.6H3Z", tone: "shade" },
    { d: "M38.25 15.5v16.5", tone: "main", stroke: 0.7 },
    { d: "M44 29h2.6v2.5H44Z", tone: "light" },
    ...wheel(12, 35, 4.6),
    ...wheel(31, 35, 4.6),
  ],
  airplane: [
    // The far wing, darker, and the tail's far stabiliser.
    { d: "M22 21.5l9-9h3.5l-4 9Z", tone: "main" },
    { d: "M22 21.5l9-9h3.5l-4 9Z", tone: "shade" },
    // Fuselage.
    { d: "M3 24c0-2.3 1.7-3.6 4.5-3.6h30c4.5 0 9 1.5 9 3.6s-4 3.6-8.5 3.6H7.5C4.7 27.6 3 26.3 3 24Z", tone: "main" },
    // Tail fin and near stabiliser.
    { d: "M4.5 21L2.5 10.5h4L13 21Z", tone: "main" },
    { d: "M3.5 25.5h8l-5 3.5H3.5Z", tone: "main" },
    // Near wing and engine.
    { d: "M18 25.5h11.5L21.5 38H17Z", tone: "main" },
    { d: "M19.5 31.5h6.5q1.5 0 1.5 1.5t-1.5 1.5h-6.5Z", tone: "shade" },
    // Cockpit and the row of windows.
    { d: "M40.5 21.3c2.2.2 4 .9 5 1.9h-5.5Z", tone: "deep" },
    {
      d: [12, 15, 18, 21, 24, 27, 30, 33, 36].map((x) => circle(x, 22.9, 0.75)).join(" "),
      tone: "deep",
    },
  ],
  whale: [
    // Body, tail and flukes.
    { d: "M3 27c0-9 9-12.5 17-12c7.5.5 13 4 16.5 8.5l5.3-6.3q2.2-2 2.7.6l-2.6 7.2l3.2 6.6q.2 2.6-2.4 1.2l-6.6-4.6c-4.8 4-11.5 6.3-18.5 6C8.5 34 3 32 3 27Z", tone: "main" },
    // Flipper.
    { d: "M15.5 31c1.5 5 4.5 8 9 8.3c-1.5-2.5-2.3-5-2.6-7.5Z", tone: "main" },
    // Belly grooves, the mouth and the eye.
    { d: "M5.5 30.5c4 2 9.5 2.6 14.5 1.8 M7.5 32.6c3.5 1.2 7.5 1.4 11 .9", tone: "shade", stroke: 0.8 },
    { d: "M4 28.4c4.5 1.4 9.5 1.2 13-.4", tone: "deep", stroke: 1 },
    { d: circle(10, 24.5, 1.1), tone: "deep" },
    // The spout.
    { d: "M13.5 14c-.5-3-2.5-4.5-5-5 M14.5 14c.5-3 2.5-4.5 5-5 M14 13.5V8", tone: "main", stroke: 1.6 },
  ],
};

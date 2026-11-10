/**
 * The streak flame drawn for ABOT, in a 120 x 160 box: a body with a side tongue, a heart and a
 * core. Shared by the streak screen (SVG) and the streak share cards (canvas).
 */
export const FLAME_OUTER =
  "M60 6 C70 34 98 52 100 92 C102 128 82 154 60 154 C38 154 18 128 20 94 C22 70 34 58 40 40 C44 58 50 64 54 64 C52 44 54 24 60 6 Z";
export const FLAME_MIDDLE =
  "M60 50 C68 72 86 84 86 110 C86 134 74 148 60 148 C46 148 34 134 34 112 C34 96 44 88 48 76 C52 88 56 90 58 90 C56 76 56 64 60 50 Z";
export const FLAME_CORE = "M60 92 C66 106 74 114 74 128 C74 140 68 148 60 148 C52 148 46 140 46 130 C46 118 54 110 60 92 Z";
export const FLAME_BOX = { width: 120, height: 160 } as const;

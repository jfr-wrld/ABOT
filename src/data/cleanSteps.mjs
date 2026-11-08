// Shared by scripts/generate-seed.mjs (Node) and src/data/catalog.ts (app): one cleaning rule.
export const MAX_STEPS = 5;

/** Plain punctuation, no filler lines ("Repeat for the recommended..."), at most MAX_STEPS steps. */
export function cleanSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((s) => typeof s === "string")
    .map((s) =>
      s
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/—|–/g, ", ")
        .replace(/¾/g, "3/4")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((s) => s && !/^repeat\b.*\b(repetitions|reps|times)\b/i.test(s) && !/^repeat for the/i.test(s))
    .slice(0, MAX_STEPS);
}

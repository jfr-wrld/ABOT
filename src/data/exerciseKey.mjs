// The identity of an exercise for spotting duplicates across sources: its equipment and the
// words of its name, lower case, without the equipment word, punctuation, plurals or word order.
// "Bench Press (Barbell)" and "Barbell Bench Press" give the same key.

const SYNONYMS = {
  bicep: "biceps",
  tricep: "triceps",
  pushup: "push up",
  pullup: "pull up",
  chinup: "chin up",
  skullcrusher: "skull crusher",
  situp: "sit up",
  stepup: "step up",
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
};
const DROP = new Set(["barbell", "dumbbell", "cable", "machine", "kettlebell", "smith", "ez", "bar", "band", "banded", "bodyweight", "the", "a", "with", "and", "of"]);

export function nameWords(name) {
  return name
    .toLowerCase()
    .replace(/[()'’]/g, " ")
    .replace(/-/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (SYNONYMS[w] ?? w).split(" "))
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .filter((w) => !DROP.has(w));
}

export function exerciseKey(name, equipment) {
  return `${equipment}:${[...new Set(nameWords(name))].sort().join(" ")}`;
}

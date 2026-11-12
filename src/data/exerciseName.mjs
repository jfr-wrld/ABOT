// Exercise names in the library's style, used by both dataset builds (scripts/build-*.mjs) and
// the app: the lift first, its tool in brackets, as ABOT's own and Hevy's lists read.
//   "Barbell Bench Press"                  -> "Bench Press (Barbell)"
//   "Barbell Bench Press - Medium Grip"    -> "Bench Press, Medium Grip (Barbell)"
//   "External Rotation with Cable"         -> "External Rotation (Cable)"
//   "Belt Squat" on a machine              -> "Belt Squat (Machine)"
// The tool word moves out only when two or more words stay behind ("Cable Crossover" stays) and
// it is not a count ("Double Kettlebell Front Squat" stays). Cardio machines keep their own name.

const LABEL = { barbell: "Barbell", dumbbell: "Dumbbell", cable: "Cable", machine: "Machine", kettlebell: "Kettlebell", smith_machine: "Smith Machine" };
const WORD = /(?<![\w-])(?:with\s+(?:an?\s+)?)?(E-?Z[- ]Curl Bar|EZ-Bar|Smith Machine|Barbell|Dumbbells?|Cable|Machine|Kettlebells?)\b\s*/i;

export function tidyName(raw, equipment, category) {
  let name = raw.trim().replace(/\s+/g, " ");
  if (name.includes("(")) return name;
  // "Main - Detail" reads as "Main, Detail".
  name = name.replace(/\s+-\s+/g, ", ");
  const label = LABEL[equipment];
  const m = WORD.exec(name);
  if (m && label && !/\b(Double|Single)\s+$/i.test(name.slice(0, m.index))) {
    const rest = (name.slice(0, m.index) + " " + name.slice(m.index + m[0].length)).replace(/\s+,/g, ",").replace(/\s+/g, " ").replace(/^[,\s]+|[,\s]+$/g, "");
    if (rest.split(" ").length >= 2) return `${rest} (${/e-?z/i.test(m[1]) ? "EZ Bar" : label})`;
    return name;
  }
  if (label && category !== "cardio" && (equipment === "machine" || equipment === "cable" || equipment === "smith_machine")) return `${name} (${label})`;
  return name;
}

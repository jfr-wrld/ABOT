import { memo } from "react";
import { HeartPulse } from "lucide-react";
import type { MuscleGroup } from "@/types/workout";
import { regionLevels, type Region } from "@/components/anatomy/regions";
import { BODY_BACK, BODY_FRONT } from "@/components/anatomy/bodyPaths.generated";

/** Muscles seen from behind; every other group is drawn on the front figure. */
const BACK_SIDE = new Set<MuscleGroup>(["back", "lats", "traps", "triceps", "glutes", "hamstrings", "calves", "lower_back", "abductors"]);
const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);
const LOWER = new Set<MuscleGroup>(["glutes", "quads", "hamstrings", "adductors", "abductors", "calves"]);
/** Figure x origin in the shared drawing (measured with getBBox): front at 49, back at 769. */
const X = { front: 34, back: 754 };
/** Zoom on the part of the figure that holds the muscle, so it reads at 30 px. */
function viewBoxFor(side: "front" | "back", muscle?: MuscleGroup): { box: string; aspect: number } {
  if (!muscle || muscle === "full_body") return { box: `${X[side]} 150 660 1220`, aspect: 660 / 1220 };
  const y = LOWER.has(muscle) ? 700 : 150;
  return { box: `${X[side]} ${y} 660 680`, aspect: 660 / 680 };
}

/**
 * One figure, front or back depending on where the muscle sits, cropped to the upper body or
 * the legs, with that muscle in Volt.
 * Without a muscle it is the plain figure ("all muscles"). Cardio has no muscle to light, so it
 * shows a pulse. Decorative: the option's text names the muscle.
 */
export const MuscleIcon = memo(function MuscleIcon({ muscle, size = 30 }: { muscle?: MuscleGroup; size?: number }) {
  if (muscle === "cardio") return <HeartPulse aria-hidden="true" size={size * 0.8} className="shrink-0 text-accent" />;
  const back = muscle ? BACK_SIDE.has(muscle) : false;
  const levels = muscle ? regionLevels([muscle], []) : {};
  const { box, aspect } = viewBoxFor(back ? "back" : "front", muscle);
  return (
    <svg aria-hidden="true" viewBox={box} height={size} width={size * aspect} className="shrink-0">
      {(back ? BODY_BACK : BODY_FRONT).map((p, i) => {
        const lit = !NON_MUSCLE.has(p.slug) && levels[p.slug as Region];
        const fill = lit ? "#ccff00" : NON_MUSCLE.has(p.slug) ? "#3a3a42" : "#52525b";
        return (
          <g key={`${p.slug}-${i}`} fill={fill}>
            {p.d.map((d, j) => (
              <path key={j} d={d} />
            ))}
          </g>
        );
      })}
    </svg>
  );
});

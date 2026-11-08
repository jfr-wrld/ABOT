import { BODY_BACK, BODY_FRONT, OUTLINE_BACK, OUTLINE_FRONT } from "./bodyPaths.generated";

export const MUSCLE_SPRITE_ID = "abot-muscle-body";

/** Parts that are body, not muscle: drawn flat and never lit. */
const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);

/**
 * The front and back body drawn once per page as an SVG symbol. Every muscle thumbnail reuses
 * it with <use>, and colours its muscles through CSS variables (--m-chest, --m-quadriceps, ...),
 * so a list of hundreds of exercises costs one drawing, not hundreds.
 */
export function MuscleSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" focusable="false" style={{ position: "absolute", overflow: "hidden" }}>
      <symbol id={MUSCLE_SPRITE_ID} viewBox="0 30 1448 1360">
        {[...BODY_FRONT, ...BODY_BACK].map((p, i) => (
          <g key={`${p.slug}-${i}`} fill={NON_MUSCLE.has(p.slug) ? "#1c1c21" : `var(--m-${p.slug}, #34343a)`}>
            {p.d.map((d, j) => (
              <path key={j} d={d} />
            ))}
          </g>
        ))}
        <g fill="none" stroke="#71717a" strokeWidth={7}>
          <path d={OUTLINE_FRONT} />
          <path d={OUTLINE_BACK} />
        </g>
      </symbol>
    </svg>
  );
}

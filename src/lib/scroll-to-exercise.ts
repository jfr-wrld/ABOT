/** Brings an exercise card in the active workout to the top of the screen. */
export function scrollToExercise(sessionExerciseId: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(`card-${sessionExerciseId}`);
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

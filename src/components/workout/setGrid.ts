/**
 * Column template shared by the set header and every set row so they always align.
 * Fixed tracks are the narrowest that still fit "102.5" / "10" / "8.5" in 18px JetBrains Mono
 * (10.8px per digit) and a 44px tap target; whatever is left goes to Prev (about 58px on a
 * 360px phone with RPE on).
 */
export function setGridColumns(showRpe: boolean): string {
  return `44px minmax(0,1fr) 60px 44px ${showRpe ? "40px " : ""}44px`;
}

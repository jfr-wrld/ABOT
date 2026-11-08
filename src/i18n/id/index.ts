import { common } from "./common";

/**
 * Indonesian, keyed by the English text. Split by area so several people (or passes) can work
 * on it at once; a key in two parts must have the same translation.
 */
export const ID: Record<string, string> = {
  ...common,
};

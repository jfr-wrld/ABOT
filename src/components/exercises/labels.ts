/*
 * Library texts kept in constants, in a module with no React or store imports so
 * src/i18n/dynamic-keys.ts can list them for the translation coverage test.
 */

export type LibrarySort = "muscle" | "az" | "used" | "recent";

export const SORT_LABEL: Record<LibrarySort, string> = {
  muscle: "By muscle",
  az: "A–Z",
  used: "Most used",
  recent: "Last done",
};

"use client";

import { usePathname } from "next/navigation";

/**
 * The current path without a trailing slash. The Android build exports with `trailingSlash`, so
 * there the router reports "/workout/" where the web build reports "/workout".
 */
export function usePagePath() {
  return normalizePath(usePathname());
}

export function normalizePath<T extends string | null>(path: T): T {
  return (path && path.length > 1 ? path.replace(/\/+$/, "") : path) as T;
}

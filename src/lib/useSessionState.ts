"use client";

import { useState } from "react";

/**
 * useState that outlives the page for this app session (sessionStorage): a list's search and
 * filters are the same when Back returns to it, so its remembered scroll offset still points at
 * the same rows. A new app start begins clean. Without storage it is plain state.
 */
export function useSessionState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  return [
    value,
    (v) => {
      setValue(v);
      try {
        sessionStorage.setItem(key, JSON.stringify(v));
      } catch {
        // Kept in memory only.
      }
    },
  ];
}

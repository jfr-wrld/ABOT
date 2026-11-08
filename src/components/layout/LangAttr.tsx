"use client";

import { useEffect } from "react";
import { useLang } from "@/i18n";

/** Keeps <html lang> on the chosen language, for screen readers and hyphenation. */
export function LangAttr() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

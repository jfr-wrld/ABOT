"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotionConfig } from "framer-motion";
import { Moon, Sun } from "@/components/icons";
import { useSettingsStore } from "@/store/useSettingsStore";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/** The page's theme as drawn now (Settings may say System). */
function drawnTheme(): "dark" | "light" {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Home's dark/light switch (owner, 2026-11-15, in place of the settings gear): one tap flips the
 * page between dark and light, the sun turning into the moon. It saves Light or Dark; System
 * stays a choice in Settings > General.
 */
export function ThemeToggle() {
  const t = useT();
  const reduce = useReducedMotionConfig();
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  const [mode, setMode] = useState<"dark" | "light" | null>(null);
  // Read after paint, once ThemeController has resolved System.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMode(drawnTheme()));
    return () => cancelAnimationFrame(id);
  }, [theme]);
  const next = mode === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      onClick={() => {
        feedback.tick();
        update({ theme: next });
        setMode(next);
      }}
      aria-label={next === "dark" ? t("Switch to dark mode") : t("Switch to light mode")}
      className="glass-icon flex size-11 items-center justify-center overflow-hidden rounded-full text-text"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode ?? "unknown"}
          aria-hidden="true"
          className="flex"
          initial={reduce ? { opacity: 0 } : { rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 22 }}
        >
          {mode === "light" ? <Moon size={20} variant="bold" /> : <Sun size={20} variant="bold" className="text-accent" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

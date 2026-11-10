/**
 * How a row enters and leaves a list: its height opens or closes while it fades, in 180 ms, so the
 * rows around it move instead of jumping. Use with <AnimatePresence initial={false}> so rows that
 * are already there on first show do not animate.
 */
export const LIST_ITEM = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto" },
  exit: { opacity: 0, height: 0 },
  transition: { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] },
} as const;

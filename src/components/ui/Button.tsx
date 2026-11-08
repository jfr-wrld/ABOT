"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,border-color,color,filter] duration-150 disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent font-bold text-on-accent hover:brightness-110 active:brightness-95",
  secondary:
    "border border-ink/[0.12] bg-surface-2 text-text hover:border-ink/25 hover:bg-press active:bg-press-strong",
  ghost: "text-text-muted hover:bg-ink/[0.05] hover:text-text active:bg-ink/[0.08]",
  danger: "border border-failure/50 text-failure hover:bg-failure/10 active:bg-failure/20",
};

/** Springy enough to feel under the thumb, damped enough to settle before the next tap. */
export const PRESS_SPRING = { type: "spring", stiffness: 500, damping: 26, mass: 0.6 } as const;
/** Shared by every primary control so they all press the same way. */
export const press = { whileTap: { scale: 0.96 }, whileHover: { scale: 1.02 }, transition: PRESS_SPRING } as const;

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  disabled,
  ...rest
}: HTMLMotionProps<"button"> & { variant?: Variant }) {
  // Only the main actions lift on hover; every enabled button gives on press.
  const motionProps = disabled
    ? {}
    : variant === "primary"
      ? press
      : { whileTap: { scale: 0.96 }, transition: PRESS_SPRING };
  return (
    <motion.button
      type={type}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
      {...motionProps}
      {...rest}
    />
  );
}

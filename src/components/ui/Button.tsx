import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-[background-color,border-color,color,filter] duration-150 disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent font-bold text-on-accent hover:brightness-110 active:brightness-95",
  secondary:
    "border border-white/[0.12] bg-surface-2 text-text hover:border-white/25 hover:bg-[#24242a] active:bg-[#2c2c33]",
  ghost: "text-text-muted hover:bg-white/[0.05] hover:text-text active:bg-white/[0.08]",
  danger: "border border-failure/50 text-failure hover:bg-failure/10 active:bg-failure/20",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

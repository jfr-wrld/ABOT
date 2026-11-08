import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl px-4 text-sm font-semibold transition-colors disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-accent-solid text-white hover:bg-[#1d4ed8] active:bg-[#1e40af]",
  secondary:
    "border border-line-strong bg-surface-2 text-text hover:bg-[#303035] active:bg-[#3a3a40]",
  ghost: "text-text-muted hover:bg-surface hover:text-text active:bg-surface-2",
  danger: "border border-failure/60 text-failure hover:bg-failure/10 active:bg-failure/20",
};

export function Button({
  variant = "secondary",
  className = "",
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...rest} />;
}

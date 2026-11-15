"use client";

import type { ReactNode } from "react";

/**
 * Shared pieces of Mission Control, in the app's own material (raised cards, sunk fields, 3D
 * buttons, sentence-case labels), always dark. Device-scoped settings keep their cyan, which marks
 * "this phone only" and has no app token.
 */

const CYAN = "#00f0ff";

export const cls = {
  label: "text-xs font-semibold text-text-muted",
  input: "num min-h-11 w-full rounded-ctl bg-surface-2 px-3 text-sm text-text placeholder:text-text-muted/60 disabled:opacity-50",
  volt: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent hover:brightness-105 disabled:opacity-40",
  ghost: "raised inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-text disabled:opacity-40",
  danger: "raised-danger inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-40",
};

export type Scope = "global" | "device";

/** GLOBAL (every install, Volt) or DEVICE (this phone, Cyan). */
export function ScopeTag({ scope }: { scope: Scope }) {
  return scope === "global" ? (
    <span className="rounded-full border border-accent/60 px-2 py-px text-[11px] font-semibold text-accent">Global</span>
  ) : (
    <span className="rounded-full border px-2 py-px text-[11px] font-semibold" style={{ borderColor: `${CYAN}99`, color: CYAN }}>
      Device
    </span>
  );
}

export function Panel({ id, title, scope, children, wide, actions }: { id: string; title: string; scope: Scope; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`raised-card flex min-w-0 flex-col gap-4 rounded-card bg-surface p-4 ${wide ? "xl:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 text-base font-bold text-text">
          {title} <ScopeTag scope={scope} />
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "volt" | "cyan" | "amber" }) {
  const color = tone === "volt" ? "var(--color-accent)" : tone === "cyan" ? CYAN : tone === "amber" ? "var(--color-caution)" : "var(--color-text)";
  return (
    <div className="tile min-w-0 rounded-ctl p-3">
      <dt className={cls.label}>{label}</dt>
      <dd className="num mt-1 truncate text-2xl font-bold" style={{ color }}>
        {value}
      </dd>
    </div>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "error" | "ok" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-xs ${tone === "error" ? "text-failure" : tone === "ok" ? "text-accent" : "text-text-muted"}`}>
      {children}
    </p>
  );
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

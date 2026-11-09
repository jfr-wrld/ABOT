"use client";

import type { ReactNode } from "react";

/** Shared pieces of the Mission Control look: Carbon panels on Matte Obsidian, mono numbers. */

export const cls = {
  label: "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400",
  input:
    "min-h-11 w-full rounded-ctl border border-[#27272a] bg-[#09090b] px-3 font-mono text-sm tabular-nums text-white placeholder:text-zinc-600 focus:border-[#ccff00] focus:outline-none disabled:opacity-50",
  volt: "inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl bg-[#ccff00] px-4 font-mono text-xs font-black uppercase tracking-[0.1em] text-black hover:brightness-95 disabled:opacity-40",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-ctl border border-[#27272a] px-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-zinc-300 hover:border-zinc-500 hover:text-white disabled:opacity-40",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-ctl border border-[#ef4444] px-4 font-mono text-xs font-black uppercase tracking-[0.1em] text-[#ef4444] hover:bg-[#ef4444]/10 disabled:opacity-40",
};

export type Scope = "global" | "device";

/** GLOBAL (every install, Volt) or DEVICE (this phone, Cyan). */
export function ScopeTag({ scope }: { scope: Scope }) {
  return scope === "global" ? (
    <span className="rounded-[4px] border border-[#ccff00]/60 px-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#ccff00]">Global</span>
  ) : (
    <span className="rounded-[4px] border border-[#00f0ff]/60 px-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-[#00f0ff]">Device</span>
  );
}

export function Panel({ id, title, scope, children, wide, actions }: { id: string; title: string; scope: Scope; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col gap-4 rounded-card border border-[#27272a] bg-[#121215] p-4 ${wide ? "xl:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={id} className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">
          {title} <ScopeTag scope={scope} />
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, tone }: { label: string; value: ReactNode; tone?: "volt" | "cyan" | "amber" }) {
  const color = tone === "volt" ? "text-[#ccff00]" : tone === "cyan" ? "text-[#00f0ff]" : tone === "amber" ? "text-[#f59e0b]" : "text-white";
  return (
    <div className="min-w-0 rounded-ctl border border-[#27272a] bg-[#09090b] p-3">
      <dt className={cls.label}>{label}</dt>
      <dd className={`mt-1 truncate font-mono text-2xl font-black tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "error" | "ok" }) {
  return (
    <p role={tone === "error" ? "alert" : "status"} className={`text-xs ${tone === "error" ? "text-[#ef4444]" : tone === "ok" ? "text-[#ccff00]" : "text-zinc-400"}`}>
      {children}
    </p>
  );
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

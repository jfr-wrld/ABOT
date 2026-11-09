"use client";

import { useId, useState } from "react";
import { useT } from "@/i18n";
import { useEntitlements } from "@/store/useEntitlements";
import { ProBadge, ProLock } from "@/components/paywall/ProBadge";
import { BODY_BACK, BODY_FRONT, OUTLINE_BACK, OUTLINE_FRONT, type BodyPart } from "./bodyPaths.generated";
import { REGIONS, type Region } from "./regions";
import { STAGE_STYLE, type FatigueStage, type RegionTelemetry } from "@/lib/muscle-recovery";

const NON_MUSCLE = new Set(["hair", "head", "hands", "feet", "ankles", "knees"]);
const isRegion = (slug: string): slug is Region => (REGIONS as readonly string[]).includes(slug);

/** Anatomical names for the tooltip. */
export const REGION_NAMES: Record<Region, string> = {
  chest: "Pectoralis major",
  deltoids: "Deltoids",
  biceps: "Biceps brachii",
  triceps: "Triceps brachii",
  forearm: "Forearms",
  abs: "Rectus abdominis",
  obliques: "Obliques",
  trapezius: "Trapezius",
  "upper-back": "Lats and upper back",
  "lower-back": "Erector spinae",
  gluteal: "Gluteus maximus",
  quadriceps: "Quadriceps",
  hamstring: "Hamstrings",
  adductors: "Adductors",
  calves: "Calves",
  tibialis: "Tibialis anterior",
  neck: "Neck",
};

/** The drawing holds the front figure on the left and the back figure on the right. */
const VIEWBOX = { front: "29 147 670 1225", back: "749 146 670 1225", both: "29 146 1390 1226" } as const;

export const STAGE_LABELS: Record<FatigueStage, { name: string; range: string }> = {
  fresh: { name: "Fresh", range: "0-20%" },
  recovering: { name: "Recovering", range: "21-50%" },
  high: { name: "High load", range: "51-80%" },
  exhausted: { name: "Exhausted", range: "81-100%" },
};

function Body({
  parts,
  data,
  selected,
  onSelect,
  label,
}: {
  parts: BodyPart[];
  data: Record<Region, RegionTelemetry>;
  selected?: Region | null;
  onSelect?: (r: Region) => void;
  label: (r: Region) => string;
}) {
  return (
    <>
      {parts.map((p) => {
        if (NON_MUSCLE.has(p.slug) || !isRegion(p.slug)) {
          return (
            <g key={p.slug} data-region={p.slug}>
              {p.d.map((d, i) => (
                <path key={i} d={d} fill="#18181b" />
              ))}
            </g>
          );
        }
        const region = p.slug;
        const tel = data[region];
        const style = STAGE_STYLE[tel.stage];
        const isSel = selected === region;
        const interactive = !!onSelect;
        return (
          <g
            key={p.slug}
            data-region={region}
            data-stage={tel.stage}
            {...(interactive
              ? {
                  role: "button",
                  tabIndex: 0,
                  "aria-label": label(region),
                  "aria-pressed": isSel,
                  onClick: () => onSelect(region),
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(region);
                    }
                  },
                  className: "cursor-pointer outline-none focus-visible:[&_path]:stroke-white focus-visible:[&_path]:[stroke-width:5]",
                }
              : {})}
          >
            {p.d.map((d, i) => (
              <path
                key={i}
                d={d}
                fill={style.fill}
                fillOpacity={style.opacity}
                stroke={isSel ? "#ffffff" : style.stroke ?? "none"}
                strokeWidth={isSel ? 5 : 1.5}
              />
            ))}
          </g>
        );
      })}
    </>
  );
}

/** "3h ago", "2d ago", "just now". */
function ago(ms: number, t: ReturnType<typeof useT>): string {
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return t("just now");
  if (h < 48) return t("{n}h ago", { n: h });
  return t("{n}d ago", { n: Math.floor(h / 24) });
}

/**
 * Recovery telemetry on the body: each muscle coloured by fatigue (fresh, recovering, high load,
 * exhausted), front or back at a time. Tapping a muscle shows its recovery, when it was last
 * trained and with how many sets, and the hours until it is ready. `compact` draws both sides
 * small with no interaction, for the home tile.
 */
export function RecoveryMap({
  data,
  now,
  compact,
}: {
  data: Record<Region, RegionTelemetry>;
  now: number;
  compact?: boolean;
}) {
  const t = useT();
  const uid = useId().replace(/:/g, "");
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<Region | null>(null);
  const { canAccessPro } = useEntitlements();
  const inspect = canAccessPro("thermal_recovery_inspector");
  const name = (r: Region) => t(REGION_NAMES[r]);
  const recovery = (r: Region) => Math.round(100 - data[r].fatigue);
  const label = (r: Region) => t("{muscle}, {pct}% recovered", { muscle: name(r), pct: recovery(r) });

  if (compact) {
    const tired = REGIONS.filter((r) => data[r].stage !== "fresh").map(name);
    return (
      <svg role="img" aria-labelledby={`${uid}-t`} viewBox={VIEWBOX.both} className="block h-auto w-full">
        <title id={`${uid}-t`}>
          {tired.length ? t("Still recovering: {list}.", { list: tired.join(", ") }) : t("Every muscle is fresh.")}
        </title>
        <Body parts={BODY_FRONT} data={data} label={label} />
        <Body parts={BODY_BACK} data={data} label={label} />
        <g fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={2.5}>
          <path d={OUTLINE_FRONT} />
          <path d={OUTLINE_BACK} />
        </g>
      </svg>
    );
  }

  const sel = selected && data[selected];
  const onSide = view === "front" ? BODY_FRONT : BODY_BACK;
  const choose = (v: "front" | "back") => {
    setView(v);
    // A muscle not drawn on this side cannot stay picked.
    if (selected && !(v === "front" ? BODY_FRONT : BODY_BACK).some((p) => p.slug === selected)) setSelected(null);
  };

  return (
    <div className="force-dark flex flex-col gap-3 rounded-card bg-bg p-3 text-text">
      <div role="group" aria-label={t("Body side")} className="grid grid-cols-2 gap-1 rounded-ctl border border-line-strong p-1">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => choose(v)}
            className={`min-h-11 rounded-[calc(var(--radius-ctl)-4px)] text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
              view === v ? "bg-accent text-black" : "text-text-muted hover:bg-ink/[0.06] hover:text-text"
            }`}
          >
            {v === "front" ? t("Anterior / Front") : t("Posterior / Back")}
          </button>
        ))}
      </div>

      <svg viewBox={VIEWBOX[view]} className="mx-auto block h-auto w-full max-w-[min(200px,48vw)]" aria-label={view === "front" ? t("Front of the body") : t("Back of the body")} role="group">
        <Body parts={onSide} data={data} selected={selected} onSelect={setSelected} label={label} />
        <path d={view === "front" ? OUTLINE_FRONT : OUTLINE_BACK} fill="none" stroke="rgb(255 255 255 / 0.18)" strokeWidth={2.5} />
      </svg>

      <div className="flex justify-end">
        <ProBadge suffix="TELEMETRY" />
      </div>
      {sel && selected && !inspect ? (
        <ProLock
          feature="thermal_recovery_inspector"
          text={t("{muscle}: recovery %, last session and hours to ready come with ABOT // BLACK.", { muscle: name(selected) })}
        />
      ) : (
      <div role="status" aria-live="polite" className="min-h-[60px] rounded-ctl border border-line-strong bg-surface px-3 py-2">
        {sel && selected ? (
          <>
            <p className="label-caps !text-text">
              {name(selected)} <span className="text-text-muted">{"//"}</span>{" "}
              <span className="tabular-nums">{t("Recovery {pct}%", { pct: recovery(selected) })}</span>
            </p>
            <p className="mt-1 text-xs text-text-muted tabular-nums">
              {sel.lastTrainedAt === null
                ? t("Not trained in the last 6 days")
                : t.n(sel.lastSets, "Last trained {ago} ({n} set)", "Last trained {ago} ({n} sets)", { ago: ago(now - sel.lastTrainedAt, t) })}
              {" · "}
              {sel.readyInHours === 0 ? t("Ready now") : t("Ready in {n}h", { n: sel.readyInHours })}
            </p>
          </>
        ) : (
          <p className="text-xs text-text-muted">{t("Tap a muscle to see its recovery.")}</p>
        )}
      </div>
      )}

      <p className="label-caps -mb-1.5 !text-[10px]" id={`${uid}-key`}>
        {t("Fatigue")}
      </p>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs" aria-labelledby={`${uid}-key`}>
        {(Object.keys(STAGE_LABELS) as FatigueStage[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-[3px]"
              style={{ background: STAGE_STYLE[s].fill, opacity: STAGE_STYLE[s].opacity, boxShadow: STAGE_STYLE[s].stroke ? `inset 0 0 0 1px ${STAGE_STYLE[s].stroke}` : undefined }}
            />
            <span>{t(STAGE_LABELS[s].name)}</span>
            <span className="ml-auto text-text-muted tabular-nums">{STAGE_LABELS[s].range}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

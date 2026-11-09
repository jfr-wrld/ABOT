"use client";

import { useState } from "react";
import { useRemoteConfig } from "@/lib/remote-config";
import { saveConfig, type AdminMode } from "@/lib/admin-api";
import { DEFAULT_TUNABLES, TUNABLE_SPECS, normalizeTunables, setTunablesSource, type TunableSpec, type Tunables } from "@/lib/tunables";
import { kcalFrom, metFor } from "@/lib/calorie-estimator";
import { feedback } from "@/lib/feedback";
import { Note, Panel, cls, errText } from "./ui";

/** Live readouts of what a draft would do: the draft is put in force for the calculation only. */
function preview(t: Tunables) {
  setTunablesSource(() => t);
  try {
    const met = metFor(170, 8);
    const fourSets = Math.min(100, 4 * t.recovery.primaryPct);
    return {
      met: met.toFixed(2),
      kcal: Math.round(kcalFrom(met, t.calories.fallbackKg, 60)),
      fourSets,
      chestReady: Math.max(0, Math.ceil((fourSets - t.recovery.readyAtPct) / (100 / t.recovery.bigHours))),
    };
  } finally {
    setTunablesSource(() => useRemoteConfig.getState().config.tunables);
  }
}

/**
 * Calibrate the algorithms for every install: recovery, MET, Coach Pill, radar, free story
 * layouts, gym radius. Each field is bounded (lib/tunables); the panel shows the defaults.
 */
export function AlgorithmsModule({ mode }: { mode: AdminMode }) {
  const live = useRemoteConfig((s) => s.config);
  const [draft, setDraft] = useState<Tunables>(live.tunables);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const p = preview(normalizeTunables(draft));

  const set = (g: keyof Tunables, k: string, v: string) =>
    setDraft((d) => ({ ...d, [g]: { ...(d[g] as Record<string, number>), [k]: v === "" ? NaN : Number(v) } }) as Tunables);

  async function save(next: Tunables) {
    setBusy(true);
    setNote(null);
    try {
      const clean = normalizeTunables(next);
      await saveConfig(mode, { ...live, tunables: clean });
      setDraft(clean);
      feedback.setComplete();
      setNote({ text: mode.kind === "local" ? "Applied on this device (local mode)." : "Pushed. Phones pick it up at their next start, or within 6 hours." });
    } catch (e) {
      setNote({ text: errText(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {(Object.keys(TUNABLE_SPECS) as (keyof Tunables)[]).map((g) => {
        const fields = TUNABLE_SPECS[g].fields as Record<string, TunableSpec>;
        const values = draft[g] as Record<string, number>;
        const defaults = DEFAULT_TUNABLES[g] as Record<string, number>;
        return (
          <Panel key={g} id={`t-${g}`} title={TUNABLE_SPECS[g].title} scope="global">
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(fields).map(([k, s]) => {
                const changed = values[k] !== defaults[k];
                return (
                  <label key={k} className="flex flex-col gap-1 text-xs text-zinc-400">
                    <span className="flex justify-between gap-2">
                      <span>{s.label}</span>
                      <span className={`font-mono tabular-nums ${changed ? "text-[#ccff00]" : "text-zinc-600"}`}>
                        {changed ? "edited" : `default ${defaults[k]}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={Number.isFinite(values[k]) ? String(values[k]) : ""}
                        onChange={(e) => set(g, k, e.target.value)}
                        aria-label={s.label}
                        className={cls.input}
                      />
                      <span aria-hidden={!s.unit} className="w-12 shrink-0 font-mono text-[11px] text-zinc-500">{s.unit ?? ""}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </Panel>
        );
      })}
      <Panel id="t-preview" title="Preview and push" scope="global" wide>
        <dl className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums sm:grid-cols-4">
          <div>
            <dt className={cls.label}>MET at 170 kg/min, RPE 8</dt>
            <dd className="text-lg text-white">{p.met}</dd>
          </div>
          <div>
            <dt className={cls.label}>kcal, 60 min, fallback kg</dt>
            <dd className="text-lg text-white">{p.kcal}</dd>
          </div>
          <div>
            <dt className={cls.label}>Chest after 4 sets</dt>
            <dd className="text-lg text-white">{p.fourSets}%</dd>
          </div>
          <div>
            <dt className={cls.label}>Chest ready in</dt>
            <dd className="text-lg text-white">{p.chestReady} h</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void save(draft)} disabled={busy} className={cls.volt}>
            {busy ? "Pushing..." : "Push calibration"}
          </button>
          <button type="button" onClick={() => void save(DEFAULT_TUNABLES)} disabled={busy} className={cls.ghost}>
            Reset all to defaults
          </button>
        </div>
        {note && <Note tone={note.error ? "error" : "ok"}>{note.text}</Note>}
      </Panel>
    </>
  );
}

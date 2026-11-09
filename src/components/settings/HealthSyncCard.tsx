"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "./controls";
import { HealthSyncService, type HealthStatus } from "@/lib/health-sync";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useBodyStore } from "@/store/useBodyStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useAllExercises } from "@/store/useExerciseStore";
import { fromDisplay, toDisplay } from "@/lib/units";
import { PROFILE_LIMITS } from "@/types/workout";
import { useT } from "@/i18n";

const STATUS_LINE: Record<HealthStatus, { text: string; on: boolean }> = {
  connected: { text: "Health Connect // Active", on: true },
  partial: { text: "Health Connect // Partial access", on: true },
  disconnected: { text: "Disconnected", on: false },
  unavailable: { text: "Health Connect not installed", on: false },
  needs_update: { text: "Health Connect needs an update", on: false },
  web: { text: "Android app only", on: false },
};

/** "7h 10m" */
const hm = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;

/**
 * Settings, Health apps: connect ABOT to Health Connect (and through it Samsung Health, Huawei
 * Health and Google Fit), sync finished workouts on their own, set the body weight the calorie
 * estimate uses, and try a sync now.
 */
export function HealthSyncCard() {
  const t = useT();
  const unit = useSettingsStore((s) => s.weightUnit);
  const bodyweightKg = useSettingsStore((s) => s.bodyweightKg);
  const autoSync = useSettingsStore((s) => s.healthAutoSync);
  const lastSleep = useSettingsStore((s) => s.lastSleep);
  const update = useSettingsStore((s) => s.update);
  const logWeight = useBodyStore((s) => s.logWeight);
  const sessions = useWorkoutStore((s) => s.sessions);
  const { byId } = useAllExercises();
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [lines, setLines] = useState<{ text: string; error?: boolean }[]>([]);
  // What is being typed; null shows the saved body weight.
  const [draft, setDraft] = useState<string | null>(null);
  const weightText = draft ?? (bodyweightKg ? String(toDisplay(bodyweightKg, unit)) : "");

  const refresh = useCallback(() => {
    HealthSyncService.status()
      .then(setStatus)
      .catch(() => setStatus("unavailable"));
  }, []);
  useEffect(refresh, [refresh]);
  // Coming back from Health Connect's permission screen or its settings.
  useAppResumed(refresh);

  const say = (text: string, error = false) => setLines((l) => [...l, { text, error }]);

  async function connect() {
    setLines([]);
    setBusy(true);
    try {
      if (status === "unavailable" || status === "needs_update" || status === "connected") {
        await HealthSyncService.openHealthConnect();
      } else {
        const next = await HealthSyncService.requestHealthPermissions();
        setStatus(next);
        if (next === "disconnected") say(t("No access was given. Tap Connect again, or allow ABOT in Health Connect."), true);
      }
    } catch (e) {
      say(t("Health Connect did not answer: {error}", { error: e instanceof Error ? e.message : String(e) }), true);
    } finally {
      setBusy(false);
    }
  }

  async function testSync() {
    setLines([]);
    setBusy(true);
    try {
      const latest = [...sessions].filter((s) => s.status === "completed").sort((a, b) => b.startedAt - a.startedAt)[0];
      if (latest) {
        const r = await HealthSyncService.syncWorkoutToHealthApps(latest, { byId });
        if (r.ok) say(t("Sent \"{name}\" ({kcal} kcal) to Health Connect.", { name: latest.name, kcal: r.kcal }));
        else say(t("Could not send the workout: {error}", { error: t(r.reason) }), true);
      } else {
        say(t("No finished workout to send yet."));
      }
      const pulled = await HealthSyncService.pullBodyWeightAndSleep();
      say(
        pulled.weight
          ? t("Latest weight: {w} {unit}.", { w: toDisplay(pulled.weight.kg, unit), unit })
          : t("No weigh-in in Health Connect in the last 30 days."),
      );
      say(pulled.sleep ? t("Last night's sleep: {time}.", { time: hm(pulled.sleep.minutes) }) : t("No sleep recorded last night."));
    } catch (e) {
      say(t("Health Connect did not answer: {error}", { error: e instanceof Error ? e.message : String(e) }), true);
    } finally {
      setBusy(false);
    }
  }

  function saveWeight() {
    if (draft === null) return;
    setDraft(null);
    const v = Number(draft.replace(",", "."));
    if (!draft.trim()) return;
    const kg = fromDisplay(v, unit);
    const [min, max] = PROFILE_LIMITS.bodyweightKg;
    if (!Number.isFinite(kg) || kg < min || kg > max) {
      setLines([{ text: t("Enter a body weight between {min} and {max} {unit}.", { min: Math.round(toDisplay(min, unit)), max: Math.round(toDisplay(max, unit)), unit }), error: true }]);
      return;
    }
    if (bodyweightKg === null || Math.abs(kg - bodyweightKg) > 0.01) logWeight(Math.round(kg * 10) / 10);
  }

  const line = status ? STATUS_LINE[status] : null;
  const native = status !== null && status !== "web";
  const connected = status === "connected" || status === "partial";
  const connectLabel =
    status === "unavailable"
      ? t("Install Health Connect")
      : status === "needs_update"
        ? t("Update Health Connect")
        : connected
          ? t("Manage access in Health Connect")
          : t("Connect Google / Huawei / Samsung Health");

  return (
    <section aria-labelledby="health-heading" className="flex flex-col gap-4">
      <div className="force-dark flex flex-col gap-3 rounded-card border border-line-strong bg-bg p-4 text-text">
        <h2 id="health-heading" className="text-sm font-semibold">
          Health Connect
        </h2>
        <p role="status" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.14em]">
          {line ? (
            <>
              <span aria-hidden="true" className={`size-2 rounded-full ${line.on ? "bg-accent shadow-[0_0_8px_rgb(204_255_0/0.7)]" : "border border-text-muted"}`} />
              <span className={line.on ? "text-accent" : "text-text-muted"}>{t(line.text)}</span>
            </>
          ) : (
            <span className="text-text-muted">{t("Checking...")}</span>
          )}
        </p>
        <p className="text-xs text-text-muted">
          {native
            ? t("Finished workouts go to Health Connect as weightlifting with their calories, where Google Fit, Samsung Health and Huawei Health can read them. Weight and sleep come back. All on this phone.")
            : t("Health sync needs the ABOT Android app. Here you can still share any workout as a .tcx file from its summary.")}
        </p>
        {native && (
          <Button variant={connected ? "secondary" : "primary"} onClick={connect} disabled={busy}>
            {connectLabel}
          </Button>
        )}
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="min-h-11 self-start rounded-ctl px-1 text-left text-sm font-semibold text-accent underline-offset-4 hover:underline"
        >
          {t("How to link Huawei or Samsung Health")}
        </button>
      </div>

      <Toggle
        id="health-auto-sync"
        label={t("Auto-sync completed workouts")}
        info={t("Each workout is sent to Health Connect when you tap Finish. Sending it again later updates it, it never adds a copy.")}
        checked={autoSync}
        onChange={(v) => update({ healthAutoSync: v })}
      />

      <div>
        <label htmlFor="health-weight" className="mb-1 block text-sm font-semibold">
          {t("Body weight ({unit})", { unit })}
        </label>
        <input
          id="health-weight"
          inputMode="decimal"
          value={weightText}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveWeight}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          placeholder={unit === "kg" ? "75" : "165"}
          aria-describedby="health-weight-hint"
          className="min-h-11 w-full rounded-ctl border border-line-strong bg-surface-2 px-3 font-mono text-base tabular-nums text-text"
        />
        <p id="health-weight-hint" className="mt-1 text-xs text-text-muted">
          {t("Used for the calorie estimate. A newer weigh-in from Health Connect replaces it.")}
        </p>
      </div>

      {lastSleep && (
        <p className="text-xs text-text-muted tabular-nums">
          {t("Last sleep from Health Connect: {time}. The recovery map uses it.", { time: hm(lastSleep.minutes) })}
        </p>
      )}

      {native && (
        <Button onClick={testSync} disabled={busy || !connected}>
          {t("Test sync now")}
        </Button>
      )}

      {lines.length > 0 && (
        <ul aria-live="polite" className="flex flex-col gap-1 text-sm">
          {lines.map((l, i) => (
            <li key={i} className={l.error ? "text-failure" : "text-text-muted"}>
              {l.text}
            </li>
          ))}
        </ul>
      )}

      <Sheet open={guideOpen} onClose={() => setGuideOpen(false)} title={t("Link other health apps")}>
        <ol className="flex flex-col gap-3 text-sm">
          <li>
            <span className="font-semibold">Huawei Health:</span>{" "}
            {t("Me > Privacy management > Health Connect, then turn on sharing so it can read ABOT's workouts.")}
          </li>
          <li>
            <span className="font-semibold">Samsung Health:</span>{" "}
            {t("Settings > Health Connect, then allow it to read exercise and calories.")}
          </li>
          <li className="text-text-muted">
            {t("Apple Health needs an iPhone app, which ABOT does not have yet. Strava and Garmin take the .tcx file from a workout's summary.")}
          </li>
        </ol>
      </Sheet>
    </section>
  );
}

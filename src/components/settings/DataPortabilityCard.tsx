"use client";

import { IMPORT_MAX_BYTES } from "@/data/backup";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { Choice } from "./controls";
import { parseWorkoutCsv, planCsvImport, type CsvSource, type ParsedWorkout } from "@/lib/data-portability";
import { getActivePersistence, getActiveRepository, hydrateStores } from "@/store/persistence";
import { useAllExercises } from "@/store/useExerciseStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import type { WeightUnit } from "@/types/workout";
import { useT } from "@/i18n";

type Picked = {
  fileName: string;
  source: CsvSource;
  unitInFile: WeightUnit | null;
  workouts: ParsedWorkout[];
  skippedRows: number;
};

const SOURCE_NAME: Record<CsvSource, string> = { hevy: "Hevy", strong: "Strong", generic: "CSV" };
/** How many new exercise names to list before "and N more". */
const SHOWN_NAMES = 5;

/**
 * Brings workout history over from Hevy or Strong: pick their CSV export, check what will
 * happen (matched and new exercises, duplicates), then add it. Merges only; nothing on the
 * phone is removed, and importing the same file again adds nothing.
 */
export function DataPortabilityCard() {
  const t = useT();
  const appUnit = useSettingsStore((s) => s.weightUnit);
  const { list: library } = useAllExercises();
  const sessions = useWorkoutStore((s) => s.sessions);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [unit, setUnit] = useState<WeightUnit>(appUnit);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fileUnit = picked?.unitInFile ?? unit;
  const plan = useMemo(
    () => (picked ? planCsvImport(picked, { unit: fileUnit, library, existing: sessions }) : null),
    [picked, fileUnit, library, sessions],
  );

  async function onFile(file: File | undefined) {
    setError(null);
    setStatus(null);
    setPicked(null);
    if (!file) return;
    // A real ABOT file is a few MB; reading a huge one would freeze the phone.
    if (file.size > IMPORT_MAX_BYTES) return setError(t("This file is too large to be an ABOT export."));
    let text: string;
    try {
      text = await file.text();
    } catch {
      return setError(t("This file could not be read. Pick it again."));
    }
    const parsed = parseWorkoutCsv(text);
    if (!parsed.ok) return setError(t(parsed.error));
    setUnit(appUnit);
    setPicked({ fileName: file.name, ...parsed });
  }

  async function doImport() {
    const repo = getActiveRepository();
    const persistence = getActivePersistence();
    if (!repo || !persistence || !plan) {
      setError(t("Saved data is not loaded, so nothing can be imported. Reload ABOT and try again."));
      return;
    }
    setBusy(true);
    setError(null);
    const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
    try {
      // One transaction: either every workout and exercise is saved or none is.
      await persistence.runExclusive(() =>
        repo.mergeAll({
          sessions: plan.sessions,
          exercises: plan.newExercises,
          routines: [],
          locations: [],
          exerciseMedia: {},
          bodyweightLog: [],
        }),
      );
    } catch (e) {
      setError(t("Import failed: {error}. Your data was not changed.", { error: msg(e) }));
      setBusy(false);
      return;
    }
    try {
      await persistence.runExclusive(() => hydrateStores(repo));
      setStatus(t.n(plan.sessions.length, "Imported {n} workout. Your records now count it.", "Imported {n} workouts. Your records now count them."));
      setPicked(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      setError(t("The backup was imported, but ABOT could not reload it ({error}). Reload the page to see it.", { error: msg(e) }));
    } finally {
      setBusy(false);
    }
  }

  const day = (ms: number) => new Date(ms).toLocaleDateString(t.locale, { day: "numeric", month: "short", year: "numeric" });
  const newNames = plan?.newExercises.map((e) => e.name) ?? [];

  return (
    <section aria-labelledby="csv-heading" className="flex flex-col gap-3">
      <InfoTip
        title={
          <h2 id="csv-heading" className="text-sm font-semibold">
            {t("Import from Hevy or Strong")}
          </h2>
        }
        name={t("importing from Hevy or Strong")}
      >
        {t(
          "In Hevy or Strong, export your workout data as a CSV file, then pick it here. The file is read on this phone and never uploaded. Your current data stays; workouts already here are skipped.",
        )}
      </InfoTip>

      <div>
        <label htmlFor="csv-file" className="mb-1 block text-sm font-semibold">
          {t("CSV file")}
        </label>
        <input
          ref={fileInput}
          id="csv-file"
          type="file"
          accept=".csv,text/csv,text/comma-separated-values,application/vnd.ms-excel"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm text-text-muted file:mr-3 file:min-h-11 file:rounded-ctl file:border file:border-line-strong file:bg-surface-2 file:px-4 file:text-sm file:font-semibold file:text-text hover:file:bg-[var(--color-press-strong)]"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
          {error}
        </p>
      )}

      {picked && plan && (
        <div className="flex flex-col gap-3 rounded-ctl border border-line-strong p-3" aria-live="polite">
          <p className="text-sm">
            <span className="font-semibold">{t("{app} export", { app: SOURCE_NAME[picked.source] })}</span>
            {": "}
            <span className="tabular-nums">
              {t.n(picked.workouts.length, "{n} workout", "{n} workouts")}, {t.n(plan.sets, "{n} set", "{n} sets")}
            </span>
            {", "}
            <span className="tabular-nums">
              {t("{from} to {to}", { from: day(picked.workouts[0]!.startedAt), to: day(picked.workouts[picked.workouts.length - 1]!.startedAt) })}
            </span>
          </p>

          {picked.unitInFile === null && (
            <Choice
              name="csv-unit"
              label={t("Weights in this file are in")}
              info={t("The file does not say. Pick the unit the other app was set to.")}
              value={unit}
              options={[
                { value: "kg", label: "kg" },
                { value: "lbs", label: "lbs" },
              ]}
              onChange={setUnit}
            />
          )}

          <ul className="flex flex-col gap-1 text-sm text-text-muted">
            {plan.matched.length > 0 && (
              <li>
                {t.n(plan.matched.length, "{n} exercise name matched to the library.", "{n} exercise names matched to the library.")}
              </li>
            )}
            {newNames.length > 0 && (
              <li>
                {t.n(newNames.length, "{n} new custom exercise:", "{n} new custom exercises:")}{" "}
                <span className="text-text">{newNames.slice(0, SHOWN_NAMES).join(", ")}</span>
                {newNames.length > SHOWN_NAMES && <> {t("and {n} more", { n: newNames.length - SHOWN_NAMES })}</>}
              </li>
            )}
            {plan.duplicates > 0 && (
              <li>{t.n(plan.duplicates, "{n} workout is already on this phone and will be skipped.", "{n} workouts are already on this phone and will be skipped.")}</li>
            )}
            {picked.skippedRows > 0 && (
              <li>{t.n(picked.skippedRows, "{n} row is not a set (a rest timer or a blank) and will be skipped.", "{n} rows are not sets (rest timers or blanks) and will be skipped.")}</li>
            )}
          </ul>

          <Button variant="primary" onClick={doImport} disabled={busy || plan.sessions.length === 0}>
            {plan.sessions.length === 0
              ? t("Nothing new to import")
              : t.n(plan.sessions.length, "Import {n} workout", "Import {n} workouts")}
          </Button>
        </div>
      )}

      {status && (
        <p role="status" className="text-sm text-text-muted">
          {status}
        </p>
      )}
    </section>
  );
}

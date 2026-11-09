"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getActivePersistence, getActiveRepository, hydrateStores, snapshotFromStores } from "@/store/persistence";
import { useAllExercises } from "@/store/useExerciseStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useRemoteConfig } from "@/lib/remote-config";
import { inspectSnapshot, type Finding } from "@/lib/db-inspect";
import { backupFileName, backupFromSnapshot } from "@/data/backup";
import { saveFile } from "@/lib/native/files";
import { HealthSyncService, type HealthStatus } from "@/lib/health-sync";
import { requestPersistentStorage, type PersistStatus } from "@/lib/storagePersistence";
import { DEFAULT_SETTINGS } from "@/types/workout";
import type { RepoSnapshot } from "@/data/repo/types";
import type { AdminMode, AdminStats } from "@/lib/admin-api";
import { Metric, Note, Panel, cls, errText } from "./ui";

const TABLES = ["sessions", "routines", "exercises", "locations", "settings", "activeWorkout", "exerciseMedia", "bodyweightLog"] as const;
type TableKey = (typeof TABLES)[number];

const size = (v: unknown) => (Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : v ? 1 : 0);

/* ---------------------------------------------------------------- overview */

export function OverviewModule({ mode, numbers }: { mode: AdminMode; numbers: AdminStats | null }) {
  const snap = snapshotFromStores();
  const remote = useRemoteConfig();
  const completed = snap.sessions.filter((s) => s.status === "completed");
  const last = completed.reduce((m, s) => Math.max(m, s.startedAt), 0);
  const metric = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toLocaleString("en-US"));
  return (
    <>
      <Panel id="o-global" title="Accounts and licenses" scope="global" wide>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Registered users" value={metric(numbers?.totalUsers)} />
          <Metric label="Founders claimed" value={metric(numbers?.founders)} tone="volt" />
          <Metric label="Active Pro licenses" value={metric(numbers?.activePro)} tone="volt" />
          <Metric label="Active codes" value={metric(numbers?.activeCodes)} />
        </dl>
        {mode.kind === "local" && <Note>Account numbers need Supabase in the build; codes count this device only.</Note>}
      </Panel>
      <Panel id="o-config" title="Live config" scope="global">
        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Mode" value={remote.config.monetizationMode === "FOUNDERS_BETA" ? "BETA" : "LIVE"} tone={remote.config.monetizationMode === "FOUNDERS_BETA" ? "volt" : "amber"} />
          <Metric label="Source" value={remote.source.toUpperCase()} tone="cyan" />
        </dl>
        <p className="text-xs text-zinc-400">Banner: {remote.config.announcement ?? "none"}</p>
      </Panel>
      <Panel id="o-device" title="This device" scope="device">
        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Workouts" value={completed.length} tone="cyan" />
          <Metric label="Routines" value={snap.routines.length} />
          <Metric label="Custom exercises" value={snap.exercises.length} />
          <Metric label="Weigh-ins" value={snap.bodyweightLog.length} />
        </dl>
        <p className="font-mono text-[11px] tabular-nums text-zinc-400">Last workout: {last ? new Date(last).toLocaleString("en-GB") : "-"}</p>
      </Panel>
    </>
  );
}

/* ---------------------------------------------------------------- database */

export function DatabaseModule() {
  const [snap, setSnap] = useState<RepoSnapshot | null>(null);
  const [table, setTable] = useState<TableKey>("sessions");
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { byId } = useAllExercises();

  const read = async () => {
    const repo = getActiveRepository();
    if (!repo) return setNote({ text: "Saved data is not loaded yet.", error: true });
    try {
      setSnap(await repo.snapshot());
    } catch (e) {
      setNote({ text: errText(e), error: true });
    }
  };
  useEffect(() => {
    // First read on open; the refresh button calls read() again.
    void getActiveRepository()
      ?.snapshot()
      .then(setSnap)
      .catch(() => {});
  }, []);

  const findings: Finding[] = useMemo(() => (snap ? inspectSnapshot(snap, byId) : []), [snap, byId]);
  const json = useMemo(() => (snap ? JSON.stringify(snap[table], null, 2) : ""), [snap, table]);

  async function exportBackup() {
    try {
      const b = backupFromSnapshot(snapshotFromStores());
      await saveFile(new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }), backupFileName());
      setNote({ text: `Backup saved (${b.data.sessions.length} workouts).` });
    } catch (e) {
      setNote({ text: errText(e), error: true });
    }
  }

  async function reset() {
    const repo = getActiveRepository();
    const persistence = getActivePersistence();
    if (!repo || !persistence) return;
    setBusy(true);
    try {
      await persistence.runExclusive(() =>
        repo.replaceAll({
          sessions: [],
          routines: [],
          exercises: [],
          locations: [],
          settings: { ...DEFAULT_SETTINGS, showRpe: true, entitlement: snapshotFromStores().settings?.entitlement ?? DEFAULT_SETTINGS.entitlement },
          activeWorkout: null,
          exerciseMedia: {},
          bodyweightLog: [],
        }),
      );
      await persistence.runExclusive(() => hydrateStores(repo));
      setConfirm("");
      setNote({ text: "This device is back to a fresh install (the founder pass is kept). Seeds and templates are built in and stay." });
      await read();
    } catch (e) {
      setNote({ text: errText(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel
        id="d-inspect"
        title="Snapshot inspector (IndexedDB, schema v3)"
        scope="device"
        wide
        actions={
          <button type="button" aria-label="Read again" onClick={() => void read()} className={cls.ghost}>
            <RefreshCw aria-hidden="true" size={14} />
          </button>
        }
      >
        <div role="tablist" aria-label="Table" className="flex flex-wrap gap-1">
          {TABLES.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={table === k}
              onClick={() => setTable(k)}
              className={`min-h-9 rounded-ctl border px-2 font-mono text-[10px] font-bold uppercase tabular-nums ${table === k ? "border-[#00f0ff] text-[#00f0ff]" : "border-[#27272a] text-zinc-400"}`}
            >
              {k} {snap ? size(snap[k]) : ""}
            </button>
          ))}
        </div>
        <pre aria-label={`${table} as JSON`} className="max-h-[360px] overflow-auto rounded-ctl border border-[#27272a] bg-[#09090b] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
          {json.length > 200_000 ? `${json.slice(0, 200_000)}\n... (${json.length.toLocaleString("en-US")} characters, cut)` : json || "-"}
        </pre>
        <button type="button" onClick={() => void navigator.clipboard?.writeText(json)} className={`${cls.ghost} w-fit`}>
          Copy JSON
        </button>
      </Panel>

      <Panel id="d-health" title="Integrity check" scope="device">
        <ul className="flex flex-col gap-1.5">
          {findings.map((f) => (
            <li key={f.code} className={`text-xs ${f.level === "ok" ? "text-[#ccff00]" : "text-[#f59e0b]"}`}>
              {f.level === "ok" ? "OK" : "WARN"} · {f.text}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-zinc-400">Read only. A deleted custom exercise in old workouts is expected and harmless.</p>
      </Panel>

      <Panel id="d-tools" title="Backup and reset" scope="device">
        <button type="button" onClick={() => void exportBackup()} className={cls.volt}>
          Export backup JSON
        </button>
        <div className="flex flex-col gap-2 border-t border-[#27272a] pt-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Type RESET to wipe this device&apos;s workouts, routines, custom exercises, gyms and settings
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={cls.input} />
          </label>
          <button type="button" disabled={confirm !== "RESET" || busy} onClick={() => void reset()} className={cls.danger}>
            Reset device data
          </button>
        </div>
        {note && <Note tone={note.error ? "error" : "ok"}>{note.text}</Note>}
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ device */

export function DeviceModule() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [storage, setStorage] = useState<PersistStatus | null>(null);
  const sync = useSyncStore();
  const reminders = useReminderStore();
  const remote = useRemoteConfig();
  const active = useWorkoutStore((s) => s.active);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    HealthSyncService.status()
      .then(setHealth)
      .catch(() => setHealth("unavailable"));
  }, []);

  const days = Object.values(reminders.schedule.days).filter((d) => d.on).length;

  return (
    <>
      <Panel id="v-native" title="Native and sync" scope="device">
        <dl className="grid grid-cols-2 gap-2">
          <Metric label="Health Connect" value={(health ?? "...").toUpperCase()} tone={health === "connected" ? "volt" : "cyan"} />
          <Metric label="Notifications" value={reminders.permission.toUpperCase()} tone={reminders.permission === "granted" ? "volt" : "amber"} />
          <Metric label="Cloud sync" value={sync.phase.toUpperCase()} tone="cyan" />
          <Metric label="Reminder days" value={days} />
        </dl>
        <p className="text-xs text-zinc-400">
          {sync.email ? `Signed in as ${sync.email}` : "Not signed in"} · {active ? `workout running: ${active.name}` : "no workout running"}
        </p>
        <button
          type="button"
          onClick={() =>
            void requestPersistentStorage().then((s) => {
              setStorage(s);
            })
          }
          className={`${cls.ghost} w-fit`}
        >
          Storage protection: {storage ?? "check"}
        </button>
      </Panel>
      <Panel id="v-remote" title="Remote config on this device" scope="device">
        <p className="font-mono text-xs tabular-nums text-zinc-300">
          Source {remote.source.toUpperCase()} · server row {remote.config.updatedAt ? new Date(remote.config.updatedAt).toLocaleString("en-GB") : "never fetched"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void remote.refresh(true).then(() => setNote(`Now from ${useRemoteConfig.getState().source}.`))
            }
            className={cls.ghost}
          >
            Fetch now
          </button>
          {remote.source === "local" && (
            <button
              type="button"
              onClick={() => {
                remote.setLocalOverride(null);
                setNote("Local override removed.");
              }}
              className={cls.ghost}
            >
              Drop local override
            </button>
          )}
        </div>
        {note && <Note tone="ok">{note}</Note>}
      </Panel>
    </>
  );
}

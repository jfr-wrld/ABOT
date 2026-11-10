"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Database, Dumbbell, Gauge, KeyRound, ListChecks, Lock, SlidersHorizontal, Smartphone, type LucideIcon } from "lucide-react";
import { adminMode, listCodes, stats, type AdminCode, type AdminMode, type AdminStats } from "@/lib/admin-api";
import { HydrationGate } from "@/components/ui/Loading";
import { OverviewModule, DatabaseModule, DeviceModule } from "@/components/admin/SystemModules";
import { LicensesModule, MonetizationModule } from "@/components/admin/BusinessModules";
import { AlgorithmsModule } from "@/components/admin/AlgorithmsModule";
import { ExercisesModule, RoutinesModule } from "@/components/admin/ContentModules";
import { cls, errText } from "@/components/admin/ui";
import { DEV_TOOLS } from "@/lib/dev-tools";

/**
 * ABOT // MISSION CONTROL (docs/plans/ADMIN_ARCHITECTURE_SPEC.md). Global modules write to
 * Supabase, where every write is checked against app_admins; Device modules edit this phone's
 * stores and IndexedDB. The PIN only hides the page: it ships inside the app like every page.
 */

/**
 * An optional extra lock, set with NEXT_PUBLIC_ABOT_ADMIN_PIN. It ships inside the app, so it is
 * never the protection: release builds open the console only for an account the server confirms
 * as an admin (is_abot_admin). The old public default PIN is gone (security audit 2026-11-11).
 */
const PIN = process.env.NEXT_PUBLIC_ABOT_ADMIN_PIN || (DEV_TOOLS ? "2026" : "");
const UNLOCK_KEY = "abot.admin-unlocked";

type ModuleId = "overview" | "money" | "licenses" | "algorithms" | "exercises" | "routines" | "database" | "device";
const ALL_MODULES: { id: ModuleId; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "money", label: "Monetization", icon: SlidersHorizontal },
  { id: "licenses", label: "Licenses", icon: KeyRound },
  { id: "algorithms", label: "Algorithms", icon: Cpu },
  { id: "exercises", label: "Exercises", icon: Dumbbell },
  { id: "routines", label: "Routines & gyms", icon: ListChecks },
  { id: "database", label: "Database", icon: Database },
  { id: "device", label: "Device", icon: Smartphone },
];
// Device edits this phone's licence and stores directly: development builds only.
const MODULES = DEV_TOOLS ? ALL_MODULES : ALL_MODULES.filter((m) => m.id !== "device");

const noop = () => () => {};
function readUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export default function AdminPage() {
  // Unlocked earlier in this tab, or just now (the prerendered page is always locked).
  const stored = useSyncExternalStore(noop, readUnlocked, () => false);
  const [justUnlocked, setUnlocked] = useState(false);
  const unlocked = !PIN || stored || justUnlocked;
  return (
    // Its own full-screen layer: the app shell is a 640 px phone column with a dock, and the
    // console needs the whole window on a laptop.
    <main className="force-dark fixed inset-0 z-[60] overflow-y-auto overscroll-contain bg-[#09090b] text-text">
      {unlocked ? (
        <HydrationGate>
          <Console />
        </HydrationGate>
      ) : (
        <div className="px-4 pt-[calc(24px+env(safe-area-inset-top))]">
          <PinGate onUnlock={() => setUnlocked(true)} />
        </div>
      )}
    </main>
  );
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 rounded-card border border-[#27272a] bg-[#121215] p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (pin !== PIN) return setWrong(true);
        try {
          sessionStorage.setItem(UNLOCK_KEY, "1");
        } catch {
          // Unlocked for this page view only.
        }
        onUnlock();
      }}
    >
      <p className={cls.label}>ABOT // MISSION CONTROL</p>
      <h1 className="flex items-center gap-2 text-lg font-extrabold">
        <Lock aria-hidden="true" size={18} className="text-[#ccff00]" /> Founder passkey
      </h1>
      <label htmlFor="admin-pin" className="text-sm text-zinc-300">
        PIN
      </label>
      <input
        id="admin-pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => {
          setPin(e.target.value);
          setWrong(false);
        }}
        aria-invalid={wrong || undefined}
        className={`${cls.input} text-center text-lg tracking-[0.4em]`}
      />
      {wrong && (
        <p role="alert" className="text-sm text-[#ef4444]">
          Wrong PIN.
        </p>
      )}
      <button type="submit" className={cls.volt}>
        Unlock
      </button>
      <Link href="/settings" className={cls.ghost}>
        Back to Settings
      </Link>
    </form>
  );
}

function Console() {
  const [mode, setMode] = useState<AdminMode | null>(null);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [numbers, setNumbers] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The console renders only in the browser (after the PIN), so the address is there to read.
  const [current, setCurrent] = useState<ModuleId>(() => {
    const fromHash = window.location.hash.slice(1) as ModuleId;
    return MODULES.some((x) => x.id === fromHash) ? fromHash : "overview";
  });

  const reload = useCallback(async (m: AdminMode) => {
    setError(null);
    try {
      const list = await listCodes(m);
      setCodes(list);
      setNumbers(await stats(m, list));
    } catch (e) {
      setError(errText(e));
    }
  }, []);

  useEffect(() => {
    void adminMode().then((m) => {
      setMode(m);
      if (m.kind === "local" || m.admin) void reload(m);
    });
  }, [reload]);

  const go = (id: ModuleId) => {
    setCurrent(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  // Development: a signed-in non-admin can still use the Device modules; Global ones say why they
  // are closed. Release builds: nothing opens without a server-confirmed admin account.
  const globalOpen = mode !== null && ((DEV_TOOLS && mode.kind === "local") || (mode.kind === "server" && mode.admin));
  const isGlobal = !DEV_TOOLS || current === "money" || current === "licenses" || current === "algorithms";

  return (
    <div className="mx-auto grid min-h-dvh max-w-[1440px] grid-cols-[minmax(0,1fr)] lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-10 min-w-0 border-b border-[#27272a] bg-[#09090b]/95 pt-[env(safe-area-inset-top)] backdrop-blur lg:h-dvh lg:self-start lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2 px-4 py-3 lg:flex-col lg:items-start lg:py-5">
          <div>
            <p className={cls.label}>ABOT // MISSION CONTROL</p>
            <p className="mt-1 font-mono text-[11px] tabular-nums">
              {!mode ? (
                <span className="text-zinc-400">checking access...</span>
              ) : mode.kind === "local" ? (
                <span className="text-[#f59e0b]">● LOCAL MODE</span>
              ) : mode.admin ? (
                <span className="text-[#ccff00]">● LIVE · {mode.email}</span>
              ) : (
                <span className="text-[#f59e0b]">● NOT AN ADMIN</span>
              )}
            </p>
          </div>
          <Link href="/settings" aria-label="Back to Settings" className={`${cls.ghost} lg:hidden`}>
            <ArrowLeft aria-hidden="true" size={14} />
          </Link>
        </div>
        <nav aria-label="Modules" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3">
          {MODULES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => go(id)}
              aria-current={current === id ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-ctl px-3 text-left text-sm font-semibold transition-colors ${
                current === id ? "bg-[#ccff00] text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </button>
          ))}
          <Link href="/settings" className="mt-4 hidden min-h-11 items-center gap-2 rounded-ctl px-3 text-sm text-zinc-400 hover:text-white lg:flex">
            <ArrowLeft aria-hidden="true" size={16} /> Back to Settings
          </Link>
        </nav>
      </aside>

      <section aria-label={MODULES.find((m) => m.id === current)!.label} className="min-w-0 px-4 pb-16 pt-4 lg:px-8 lg:pt-8">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{MODULES.find((m) => m.id === current)!.label}</h1>
        {error && (
          <p role="alert" className="mb-4 rounded-ctl border border-[#ef4444]/60 px-3 py-2 text-sm text-[#ef4444]">
            {error}
          </p>
        )}
        {mode && isGlobal && !globalOpen ? (
          <div className="flex max-w-xl flex-col gap-3 rounded-card border border-[#27272a] bg-[#121215] p-4">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#f59e0b]">Admin account needed</p>
            <p className="text-sm text-zinc-300">
              {mode.kind === "server" && mode.email
                ? `${mode.email} is not in app_admins. Add it once in the Supabase SQL editor: insert into public.app_admins (email) values ('${mode.email.toLowerCase()}');`
                : "Sign in with the founder's Google account (Settings, Data & backup), then come back."}
            </p>
          </div>
        ) : mode ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {current === "overview" && <OverviewModule mode={mode} numbers={numbers} />}
            {current === "money" && <MonetizationModule mode={mode} />}
            {current === "licenses" && <LicensesModule mode={mode} codes={codes} onChange={() => void reload(mode)} />}
            {current === "algorithms" && <AlgorithmsModule mode={mode} />}
            {current === "exercises" && <ExercisesModule />}
            {current === "routines" && <RoutinesModule />}
            {current === "database" && <DatabaseModule />}
            {current === "device" && <DeviceModule />}
          </div>
        ) : null}
      </section>
    </div>
  );
}

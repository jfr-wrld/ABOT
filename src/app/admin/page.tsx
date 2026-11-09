"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Lock, RefreshCw } from "lucide-react";
import { useRemoteConfig, type RemoteConfig } from "@/lib/remote-config";
import { adminMode, createCode, grantByEmail, listCodes, saveConfig, setCodeActive, stats, type AdminCode, type AdminMode, type AdminStats } from "@/lib/admin-api";
import { generateCode, type Grant } from "@/lib/redeem-service";
import { annualSaving, plansFor, rupiah } from "@/lib/entitlements";
import { feedback } from "@/lib/feedback";
import { useT } from "@/i18n";

/**
 * ABOT // MISSION CONTROL: the founder's console. Global monetization switch and prices, the Home
 * announcement, VIP and influencer codes, manual upgrades and a few numbers.
 *
 * The PIN only keeps the page out of casual reach: it ships inside the app like every static
 * page. What protects the data is Supabase: each write is refused unless the signed-in Google
 * account is listed in app_admins. Without Supabase the console runs in local mode, a preview
 * that changes this device only.
 */

const PIN = process.env.NEXT_PUBLIC_ABOT_ADMIN_PIN || "2026";
const UNLOCK_KEY = "abot.admin-unlocked";

const PRESETS: { id: string; label: string; kind: string; grant: Grant }[] = [
  { id: "life", label: "Lifetime Black Pro", kind: "LIFE", grant: { tier: "lifetime", days: null, founder: false } },
  { id: "year", label: "1-year Pro", kind: "PRO", grant: { tier: "pro", days: 365, founder: false } },
  { id: "trial", label: "30-day influencer trial", kind: "VIP", grant: { tier: "pro", days: 30, founder: false } },
  { id: "founder", label: "Founder unit pass", kind: "FOUNDER", grant: { tier: "pro", days: 365, founder: true } },
];

const panel = "rounded-card border border-[#27272a] bg-[#121215] p-4";
const label = "font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500";
const input =
  "min-h-11 w-full rounded-ctl border border-[#27272a] bg-[#09090b] px-3 font-mono text-sm tabular-nums text-white focus:border-[#ccff00] focus:outline-none";
const volt = "min-h-11 rounded-ctl bg-[#ccff00] px-4 font-mono text-xs font-black uppercase tracking-[0.1em] text-black disabled:opacity-40";
const ghost = "min-h-11 rounded-ctl border border-[#27272a] px-3 font-mono text-xs font-bold uppercase tracking-[0.08em] text-zinc-300 hover:border-zinc-500";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    try {
      setUnlocked(sessionStorage.getItem(UNLOCK_KEY) === "1");
    } catch {
      // Private mode: ask every time.
    }
  }, []);
  return (
    <main className="force-dark min-h-dvh bg-[#09090b] px-4 pb-16 pt-[calc(16px+env(safe-area-inset-top))] text-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className={label}>ABOT // MISSION CONTROL</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Founder console</h1>
          </div>
          <Link href="/settings" className={`${ghost} inline-flex items-center gap-1.5`}>
            <ArrowLeft aria-hidden="true" size={14} /> Settings
          </Link>
        </header>
        {unlocked ? <Console /> : <PinGate onUnlock={() => setUnlocked(true)} />}
      </div>
    </main>
  );
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  return (
    <form
      className={`${panel} mx-auto flex w-full max-w-sm flex-col gap-3`}
      onSubmit={(e) => {
        e.preventDefault();
        if (pin === PIN) {
          try {
            sessionStorage.setItem(UNLOCK_KEY, "1");
          } catch {
            // Fine: unlocked for this page view.
          }
          onUnlock();
        } else setWrong(true);
      }}
    >
      <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#ccff00]">
        <Lock aria-hidden="true" size={14} /> Founder passkey
      </p>
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
        className={`${input} text-center text-lg tracking-[0.4em]`}
      />
      {wrong && (
        <p role="alert" className="text-sm text-failure">
          Wrong PIN.
        </p>
      )}
      <button type="submit" className={volt}>
        Unlock
      </button>
    </form>
  );
}

function Console() {
  const [mode, setMode] = useState<AdminMode | null>(null);
  const [codes, setCodes] = useState<AdminCode[]>([]);
  const [numbers, setNumbers] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (m: AdminMode) => {
    setError(null);
    try {
      const list = await listCodes(m);
      setCodes(list);
      setNumbers(await stats(m, list));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void adminMode().then((m) => {
      setMode(m);
      if (m.kind === "local" || m.admin) void reload(m);
    });
  }, [reload]);

  if (!mode) return <p className="font-mono text-xs text-zinc-400">Checking access...</p>;

  if (mode.kind === "server" && !mode.admin) {
    return (
      <section className={`${panel} flex flex-col gap-3`}>
        <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#f59e0b]">Admin account needed</p>
        <p className="text-sm text-zinc-300">
          {mode.email
            ? `${mode.email} is not in app_admins. Add it once in the Supabase SQL editor: insert into public.app_admins (email) values ('${mode.email.toLowerCase()}');`
            : "Sign in with the founder's Google account first (Settings, Data & backup), then come back."}
        </p>
        <Link href="/settings?section=data" className={`${ghost} inline-flex w-fit items-center`}>
          Open Data & backup
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p role="status" className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-400">
        {mode.kind === "local" ? (
          <span className="text-[#f59e0b]">Local mode: no Supabase in this build. Changes apply to this device only.</span>
        ) : (
          <>
            <span className="text-[#ccff00]">● Live</span> · {mode.email}
          </>
        )}
      </p>
      {error && (
        <p role="alert" className="rounded-ctl border border-failure/60 px-3 py-2 text-sm text-failure">
          {error}
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <ConfigPanel mode={mode} />
        <VoucherPanel mode={mode} codes={codes} onChange={() => void reload(mode)} />
      </div>
      <StatsPanel mode={mode} numbers={numbers} codes={codes} onRefresh={() => void reload(mode)} onToggle={async (c) => {
        await setCodeActive(mode, c.code, !c.active);
        void reload(mode);
      }} />
    </div>
  );
}

/* ---------------------------------------------------------------- section 1 */

function ConfigPanel({ mode }: { mode: AdminMode }) {
  const live = useRemoteConfig((s) => s.config);
  const [draft, setDraft] = useState<RemoteConfig>(live);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const price = (k: keyof RemoteConfig["prices"], v: string) => setDraft((d) => ({ ...d, prices: { ...d.prices, [k]: Number(v) || 0 } }));
  const plans = plansFor(draft.prices);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await saveConfig(mode, draft);
      feedback.setComplete();
      setNote(mode.kind === "local" ? "Saved on this device." : "Saved. Phones pick it up on their next check (within 6 hours, or at the next start).");
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="cfg-h" className={`${panel} flex flex-col gap-4`}>
      <h2 id="cfg-h" className={label}>
        01 // Global telemetry and monetization
      </h2>
      <div role="radiogroup" aria-label="Monetization mode" className="grid grid-cols-2 gap-2">
        {(["FOUNDERS_BETA", "COMMERCIAL_LIVE"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={draft.monetizationMode === m}
            onClick={() => {
              feedback.tick();
              setDraft((d) => ({ ...d, monetizationMode: m }));
            }}
            className={`min-h-14 rounded-ctl border px-2 font-mono text-[11px] font-bold uppercase leading-tight tracking-[0.06em] ${
              draft.monetizationMode === m ? (m === "FOUNDERS_BETA" ? "border-[#ccff00] bg-[#ccff00] text-black" : "border-[#f59e0b] bg-[#f59e0b] text-black") : "border-[#27272a] text-zinc-400"
            }`}
          >
            {m}
            <span className="block text-[10px] font-semibold opacity-80">{m === "FOUNDERS_BETA" ? "All free" : "Paywall active"}</span>
          </button>
        ))}
      </div>

      <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <legend className={`${label} mb-2`}>Prices</legend>
        {(
          [
            ["monthlyIdr", "Monthly IDR"],
            ["annualIdr", "Annual IDR"],
            ["lifetimeIdr", "Lifetime IDR"],
            ["monthlyUsd", "Monthly USD"],
            ["annualUsd", "Annual USD"],
            ["lifetimeUsd", "Lifetime USD"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex flex-col gap-1 text-xs text-zinc-400">
            {l}
            <input inputMode="decimal" value={String(draft.prices[k])} onChange={(e) => price(k, e.target.value)} className={input} />
          </label>
        ))}
      </fieldset>
      <p className="font-mono text-[11px] tabular-nums text-zinc-400">
        {rupiah(plans[0]!.idr)} / {rupiah(plans[1]!.idr)} (save {annualSaving(plans)}%) / {rupiah(plans[2]!.idr)}, founders {rupiah(plans[2]!.idr / 2)}
      </p>

      <label className="flex flex-col gap-1 text-xs text-zinc-400">
        Broadcast banner on Home (empty: none)
        <textarea
          value={draft.announcement ?? ""}
          maxLength={280}
          rows={2}
          onChange={(e) => setDraft((d) => ({ ...d, announcement: e.target.value.trim() ? e.target.value : null }))}
          className={`${input} py-2`}
          placeholder="v1.2 is out: Smart Swap and the balance radar."
        />
      </label>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300">
        Built-in offline codes (ABOT-FOUNDER-2026, ...) work
        <input
          type="checkbox"
          checked={draft.offlineCodesEnabled}
          onChange={(e) => setDraft((d) => ({ ...d, offlineCodesEnabled: e.target.checked }))}
          className="size-6 accent-[#ccff00]"
        />
      </label>

      <button type="button" onClick={() => void save()} disabled={busy} className={volt}>
        {busy ? "Saving..." : "Push config"}
      </button>
      {note && (
        <p role="status" className="text-xs text-zinc-300">
          {note}
        </p>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------- section 2 */

function VoucherPanel({ mode, codes, onChange }: { mode: AdminMode; codes: AdminCode[]; onChange: () => void }) {
  const t = useT();
  const [preset, setPreset] = useState(PRESETS[2]!.id);
  const [uses, setUses] = useState(1);
  const [founder, setFounder] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const p = PRESETS.find((x) => x.id === preset)!;

  async function generate() {
    setNote(null);
    const code = generateCode(p.kind);
    const grant = { ...p.grant, founder: p.grant.founder || founder };
    try {
      await createCode(mode, code, grant, Math.max(1, uses), p.label);
      const message = t("⚡ Your ABOT // BLACK PRO VIP access code: {code}. Open ABOT > Settings > Redeem code to unlock every Telemetry Pro feature!", { code });
      let copied = false;
      try {
        await navigator.clipboard.writeText(message);
        copied = true;
      } catch {
        // No clipboard (permission or insecure page): the message is shown to copy by hand.
      }
      setMade(message);
      setNote(copied ? "Code created and the message is copied." : "Code created. Copy the message below.");
      feedback.pr();
      onChange();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section aria-labelledby="vip-h" className={`${panel} flex flex-col gap-4`}>
      <h2 id="vip-h" className={label}>
        02 // VIP and influencer voucher generator
      </h2>
      <div role="radiogroup" aria-label="Code type" className="grid grid-cols-2 gap-2">
        {PRESETS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={preset === x.id}
            onClick={() => setPreset(x.id)}
            className={`min-h-11 rounded-ctl border px-2 text-xs font-semibold ${preset === x.id ? "border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]" : "border-[#27272a] text-zinc-400"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Uses (1 for a QRIS buyer, 100 for a giveaway)
          <input inputMode="numeric" value={String(uses)} onChange={(e) => setUses(Math.max(1, Math.min(10_000, Number(e.target.value) || 1)))} className={input} />
        </label>
        <div className="flex gap-1">
          {[1, 100].map((n) => (
            <button key={n} type="button" onClick={() => setUses(n)} className={`${ghost} tabular-nums`}>
              {n}x
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300">
        Founder badge
        <input type="checkbox" checked={founder || p.grant.founder} disabled={p.grant.founder} onChange={(e) => setFounder(e.target.checked)} className="size-6 accent-[#ccff00]" />
      </label>
      <button type="button" onClick={() => void generate()} className={`${volt} inline-flex items-center justify-center gap-2`}>
        <Copy aria-hidden="true" size={14} /> Generate & copy WhatsApp / IG message
      </button>
      {note && (
        <p role="status" className="text-xs text-zinc-300">
          {note}
        </p>
      )}
      {made && <textarea readOnly value={made} rows={3} aria-label="Invite message" className={`${input} py-2 font-sans`} onFocus={(e) => e.currentTarget.select()} />}
      <p className="text-[11px] text-zinc-500">{codes.length} codes in total.</p>
    </section>
  );
}

/* ---------------------------------------------------------------- section 3 */

function StatsPanel({
  mode,
  numbers,
  codes,
  onRefresh,
  onToggle,
}: {
  mode: AdminMode;
  numbers: AdminStats | null;
  codes: AdminCode[];
  onRefresh: () => void;
  onToggle: (c: AdminCode) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"pro" | "lifetime">("lifetime");
  const [days, setDays] = useState(365);
  const [note, setNote] = useState<string | null>(null);
  const metric = (n: number | null | undefined) => (n === null || n === undefined ? "-" : n.toLocaleString("en-US"));

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    try {
      const ok = await grantByEmail(email.trim(), tier, tier === "pro" ? days : null);
      setNote(ok ? `Done: ${email.trim()} is ${tier === "lifetime" ? "lifetime" : `pro for ${days} days`}. Their phone picks it up at the next start.` : "No ABOT account with that email. Ask them to sign in once first.");
      if (ok) onRefresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section aria-labelledby="stats-h" className={`${panel} flex flex-col gap-4`}>
      <div className="flex items-center justify-between">
        <h2 id="stats-h" className={label}>
          03 // Users and telemetry
        </h2>
        <button type="button" onClick={onRefresh} aria-label="Refresh" className={`${ghost} inline-flex items-center`}>
          <RefreshCw aria-hidden="true" size={14} />
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ["Registered users", numbers?.totalUsers],
            ["Founders claimed", numbers?.founders],
            ["Active Pro licenses", numbers?.activePro],
            ["Active codes", numbers?.activeCodes],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="rounded-ctl border border-[#27272a] bg-[#09090b] p-3">
            <dt className={label}>{k}</dt>
            <dd className="mt-1 font-mono text-2xl font-black tabular-nums text-white">{metric(v)}</dd>
          </div>
        ))}
      </dl>
      {mode.kind === "local" && <p className="text-xs text-zinc-500">Account numbers need Supabase; local mode only counts this device's codes.</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <caption className="sr-only">Redeem codes</caption>
          <thead className={label}>
            <tr>
              <th className="py-2 pr-2">Code</th>
              <th className="py-2 pr-2">Grants</th>
              <th className="py-2 pr-2 text-right">Used</th>
              <th className="py-2 text-right">State</th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-zinc-500">
                  No codes yet.
                </td>
              </tr>
            )}
            {codes.map((c) => (
              <tr key={c.code} className="border-t border-[#27272a]">
                <td className="py-2 pr-2 font-mono tabular-nums text-white">{c.code}</td>
                <td className="py-2 pr-2 text-zinc-300">
                  {c.grant.tier === "lifetime" ? "Lifetime" : `${c.grant.days} days`}
                  {c.grant.founder ? " + founder" : ""}
                </td>
                <td className="py-2 pr-2 text-right font-mono tabular-nums">
                  {c.uses}/{c.maxUses}
                </td>
                <td className="py-2 text-right">
                  <button type="button" onClick={() => void onToggle(c)} className={`${ghost} min-h-9 px-2 ${c.active ? "text-[#ccff00]" : "text-zinc-500"}`}>
                    {c.active ? "Active" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={grant} className="flex flex-col gap-3 border-t border-[#27272a] pt-4">
        <p className={label}>Manual upgrade (paid by transfer or QRIS)</p>
        {mode.kind === "local" ? (
          <p className="text-xs text-zinc-500">Needs Supabase: upgrades are made on the buyer&apos;s account.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Buyer&apos;s Google email
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
            </label>
            <div className="grid grid-cols-[1fr_1fr] gap-2">
              <select value={tier} onChange={(e) => setTier(e.target.value as "pro" | "lifetime")} aria-label="Tier" className={input}>
                <option value="lifetime">Lifetime</option>
                <option value="pro">Pro</option>
              </select>
              <input
                inputMode="numeric"
                aria-label="Days"
                disabled={tier === "lifetime"}
                value={tier === "lifetime" ? "-" : String(days)}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className={input}
              />
            </div>
            <button type="submit" className={volt}>
              Activate
            </button>
          </>
        )}
        {note && (
          <p role="status" className="text-xs text-zinc-300">
            {note}
          </p>
        )}
      </form>
    </section>
  );
}

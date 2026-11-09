"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { useRemoteConfig, type RemoteConfig } from "@/lib/remote-config";
import { createCode, grantByEmail, saveConfig, setCodeActive, type AdminCode, type AdminMode } from "@/lib/admin-api";
import { generateCode, type Grant } from "@/lib/redeem-service";
import { DEFAULT_ENTITLEMENT, SIMULATOR, annualSaving, plansFor, resolveEntitlement, rupiah, type Tier } from "@/lib/entitlements";
import { updateEntitlement } from "@/store/useEntitlements";
import { useSettingsStore } from "@/store/useSettingsStore";
import { feedback } from "@/lib/feedback";
import { useNow } from "@/lib/useNow";
import { useT } from "@/i18n";
import { Note, Panel, cls, errText } from "./ui";

/** Where a Global write went, said plainly after each save. */
const saved = (mode: AdminMode) =>
  mode.kind === "local" ? "Saved on this device (local mode)." : "Saved. Phones pick it up at their next start, or within 6 hours.";

/* ---------------------------------------------------------- monetization */

export function MonetizationModule({ mode }: { mode: AdminMode }) {
  const live = useRemoteConfig((s) => s.config);
  const [draft, setDraft] = useState<RemoteConfig>(live);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const price = (k: keyof RemoteConfig["prices"], v: string) => setDraft((d) => ({ ...d, prices: { ...d.prices, [k]: Number(v) || 0 } }));
  const plans = plansFor(draft.prices);

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      await saveConfig(mode, { ...live, ...draft, tunables: live.tunables });
      feedback.setComplete();
      setNote({ text: saved(mode) });
    } catch (e) {
      setNote({ text: errText(e), error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Panel id="m-mode" title="Monetization switch" scope="global">
        <div role="radiogroup" aria-label="Monetization mode" className="grid gap-2 sm:grid-cols-2">
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
                draft.monetizationMode === m
                  ? m === "FOUNDERS_BETA"
                    ? "border-[#ccff00] bg-[#ccff00] text-black"
                    : "border-[#f59e0b] bg-[#f59e0b] text-black"
                  : "border-[#27272a] text-zinc-400"
              }`}
            >
              {m}
              <span className="block text-[10px] font-semibold opacity-80">{m === "FOUNDERS_BETA" ? "All PRO free" : "Paywall active"}</span>
            </button>
          ))}
        </div>
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300">
          Built-in offline codes work (ABOT-FOUNDER-2026, ...)
          <input type="checkbox" checked={draft.offlineCodesEnabled} onChange={(e) => setDraft((d) => ({ ...d, offlineCodesEnabled: e.target.checked }))} className="size-6 accent-[#ccff00]" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Broadcast banner on Home (empty: none)
          <textarea
            value={draft.announcement ?? ""}
            maxLength={280}
            rows={2}
            onChange={(e) => setDraft((d) => ({ ...d, announcement: e.target.value.trim() ? e.target.value : null }))}
            className={`${cls.input} py-2 font-sans`}
            placeholder="v1.2 is out: Smart Swap and the balance radar."
          />
        </label>
      </Panel>

      <Panel id="m-prices" title="Plan prices" scope="global">
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <legend className="sr-only">Prices</legend>
          {(
            [
              ["monthlyIdr", "Monthly IDR"],
              ["annualIdr", "Annual IDR"],
              ["lifetimeIdr", "Lifetime IDR (full)"],
              ["monthlyUsd", "Monthly USD"],
              ["annualUsd", "Annual USD"],
              ["lifetimeUsd", "Lifetime USD (full)"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-zinc-400">
              {l}
              <input inputMode="decimal" value={String(draft.prices[k])} onChange={(e) => price(k, e.target.value)} className={cls.input} />
            </label>
          ))}
        </fieldset>
        <p className="font-mono text-[11px] tabular-nums text-zinc-400">
          Paywall: {rupiah(plans[0]!.idr)} / {rupiah(plans[1]!.idr)} (save {annualSaving(plans)}%) / {rupiah(plans[2]!.idr)}, founders {rupiah(plans[2]!.idr / 2)}
        </p>
        <button type="button" onClick={() => void save()} disabled={busy} className={cls.volt}>
          {busy ? "Saving..." : "Push monetization config"}
        </button>
        {note && <Note tone={note.error ? "error" : "ok"}>{note.text}</Note>}
      </Panel>
    </>
  );
}

/* --------------------------------------------------------------- licenses */

const PRESETS: { id: string; label: string; kind: string; grant: Grant }[] = [
  { id: "life", label: "Lifetime Black Pro", kind: "LIFE", grant: { tier: "lifetime", days: null, founder: false } },
  { id: "year", label: "1-year Pro", kind: "PRO", grant: { tier: "pro", days: 365, founder: false } },
  { id: "trial", label: "30-day influencer trial", kind: "VIP", grant: { tier: "pro", days: 30, founder: false } },
  { id: "founder", label: "Founder unit pass", kind: "FOUNDER", grant: { tier: "pro", days: 365, founder: true } },
];

export function LicensesModule({ mode, codes, onChange }: { mode: AdminMode; codes: AdminCode[]; onChange: () => void }) {
  return (
    <>
      <VoucherPanel mode={mode} onChange={onChange} />
      <CodesPanel mode={mode} codes={codes} onChange={onChange} />
      <GrantPanel mode={mode} />
      <DeviceEntitlementPanel />
    </>
  );
}

function VoucherPanel({ mode, onChange }: { mode: AdminMode; onChange: () => void }) {
  const t = useT();
  const [preset, setPreset] = useState(PRESETS[2]!.id);
  const [uses, setUses] = useState(1);
  const [founder, setFounder] = useState(false);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);
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
        // No clipboard here: the message is shown below to copy by hand.
      }
      setMade(message);
      setNote({ text: copied ? `${code} created; the message is copied.` : `${code} created. Copy the message below.` });
      feedback.pr();
      onChange();
    } catch (e) {
      setNote({ text: errText(e), error: true });
    }
  }

  return (
    <Panel id="l-gen" title="VIP and influencer codes" scope={mode.kind === "local" ? "device" : "global"}>
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
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Uses (1 for one buyer, 100 for a giveaway)
          <input inputMode="numeric" value={String(uses)} onChange={(e) => setUses(Math.max(1, Math.min(10_000, Number(e.target.value) || 1)))} className={cls.input} />
        </label>
        <div className="flex gap-1">
          {[1, 100].map((n) => (
            <button key={n} type="button" onClick={() => setUses(n)} className={`${cls.ghost} tabular-nums`}>
              {n}x
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300">
        Founder badge
        <input type="checkbox" checked={founder || p.grant.founder} disabled={p.grant.founder} onChange={(e) => setFounder(e.target.checked)} className="size-6 accent-[#ccff00]" />
      </label>
      <button type="button" onClick={() => void generate()} className={cls.volt}>
        <Copy aria-hidden="true" size={14} /> Generate & copy WhatsApp / IG message
      </button>
      {note && <Note tone={note.error ? "error" : "ok"}>{note.text}</Note>}
      {made && <textarea readOnly value={made} rows={3} aria-label="Invite message" className={`${cls.input} py-2 font-sans`} onFocus={(e) => e.currentTarget.select()} />}
    </Panel>
  );
}

function CodesPanel({ mode, codes, onChange }: { mode: AdminMode; codes: AdminCode[]; onChange: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel id="l-codes" title={`Codes (${codes.length})`} scope={mode.kind === "local" ? "device" : "global"} wide>
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[560px] text-left text-xs">
          <caption className="sr-only">Redeem codes</caption>
          <thead className={cls.label}>
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
                <td colSpan={4} className="py-3 text-zinc-400">
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
                  <button
                    type="button"
                    aria-label={`${c.active ? "Switch off" : "Switch on"} ${c.code}`}
                    onClick={() =>
                      void setCodeActive(mode, c.code, !c.active)
                        .then(onChange)
                        .catch((e) => setError(errText(e)))
                    }
                    className={`${cls.ghost} min-h-9 px-2 ${c.active ? "text-[#ccff00]" : "text-zinc-400"}`}
                  >
                    {c.active ? "Active" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <Note tone="error">{error}</Note>}
    </Panel>
  );
}

function GrantPanel({ mode }: { mode: AdminMode }) {
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<"pro" | "lifetime">("lifetime");
  const [days, setDays] = useState(365);
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setNote(null);
    try {
      const ok = await grantByEmail(email.trim(), tier, tier === "pro" ? days : null);
      setNote(
        ok
          ? { text: `${email.trim()} is now ${tier === "lifetime" ? "lifetime" : `pro for ${days} days`}. Their phone picks it up at the next start.` }
          : { text: "No ABOT account with that email. Ask them to sign in once first.", error: true },
      );
    } catch (err) {
      setNote({ text: errText(err), error: true });
    }
  }

  return (
    <Panel id="l-grant" title="Manual upgrade (QRIS / transfer)" scope="global">
      {mode.kind === "local" ? (
        <Note>Needs Supabase in the build: upgrades land on the buyer&apos;s account.</Note>
      ) : (
        <form onSubmit={grant} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            Buyer&apos;s Google email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={cls.input} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <select value={tier} onChange={(e) => setTier(e.target.value as "pro" | "lifetime")} aria-label="Tier" className={cls.input}>
              <option value="lifetime">Lifetime</option>
              <option value="pro">Pro</option>
            </select>
            <input
              inputMode="numeric"
              aria-label="Days"
              disabled={tier === "lifetime"}
              value={tier === "lifetime" ? "-" : String(days)}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
              className={cls.input}
            />
          </div>
          <button type="submit" className={cls.volt}>
            Activate on the account
          </button>
        </form>
      )}
      {note && <Note tone={note.error ? "error" : "ok"}>{note.text}</Note>}
    </Panel>
  );
}

/** Sets this device's tier by hand (Pro for 30 days from now). */
function setTier(tier: Tier) {
  updateEntitlement({ tier, proExpiresAt: tier === "pro" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null });
}

function DeviceEntitlementPanel() {
  const e = useSettingsStore((s) => s.entitlement) ?? DEFAULT_ENTITLEMENT;
  const appMode = useRemoteConfig((s) => s.config.monetizationMode);
  const now = useNow(60_000);
  const r = resolveEntitlement(e, appMode, now);
  return (
    <Panel id="l-device" title="Entitlement on this device" scope="device">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <dt className={cls.label}>Mode</dt>
          <dd className="font-mono text-xs text-white">{r.mode}</dd>
        </div>
        <div>
          <dt className={cls.label}>Tier</dt>
          <dd className="font-mono text-xs text-white">{r.tier}</dd>
        </div>
        <div>
          <dt className={cls.label}>PRO open</dt>
          <dd className={`font-mono text-xs ${r.proActive ? "text-[#ccff00]" : "text-[#f59e0b]"}`}>{r.proActive ? "yes" : "no"}</dd>
        </div>
        <div>
          <dt className={cls.label}>Founder</dt>
          <dd className="font-mono text-xs tabular-nums text-white">{e.founderUnitCode ?? "-"}</dd>
        </div>
      </dl>
      <div role="radiogroup" aria-label="Simulator" className="grid grid-cols-3 gap-1">
        {SIMULATOR.map((s) => (
          <button
            key={s.mode}
            type="button"
            role="radio"
            aria-checked={e.devOverrideMode === s.mode}
            onClick={() => updateEntitlement({ devOverrideMode: s.mode })}
            className={`min-h-11 rounded-ctl border font-mono text-[10px] font-bold uppercase ${e.devOverrideMode === s.mode ? "border-[#00f0ff] bg-[#00f0ff] text-black" : "border-[#27272a] text-zinc-400"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {(["free", "pro", "lifetime"] as const).map((tier) => (
          <button key={tier} type="button" onClick={() => setTier(tier)} className={cls.ghost}>
            Set {tier}
          </button>
        ))}
      </div>
    </Panel>
  );
}

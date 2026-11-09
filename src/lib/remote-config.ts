import { create } from "zustand";
import { SUPABASE_ENV, isCloudSyncConfigured } from "@/data/sync/supabase";
import type { MonetizationMode } from "./entitlements";
import { DEFAULT_TUNABLES, normalizeTunables, setTunablesSource, type Tunables } from "./tunables";

/**
 * Settings the founder changes from Mission Control (/admin) without a new APK: monetization
 * mode, plan prices, the Home announcement, and whether built-in offline codes still work.
 *
 * Source order: a local override (Mission Control without Supabase, on this device only), the
 * last copy fetched from Supabase (kept in localStorage), then the built-in defaults. The fetch
 * is one small read of the `app_remote_config` row through Supabase's REST API with the public
 * anon key, at most every 6 hours, and only in builds with Supabase set up; any failure keeps the
 * cached copy. supabase-js is not loaded for it.
 */

export interface RemoteConfig {
  monetizationMode: MonetizationMode;
  prices: { monthlyIdr: number; annualIdr: number; lifetimeIdr: number; monthlyUsd: number; annualUsd: number; lifetimeUsd: number };
  announcement: string | null;
  offlineCodesEnabled: boolean;
  /** Midtrans checkout is open (payments set up and switched on in Mission Control). */
  checkoutEnabled: boolean;
  /** The Android app also offers the Midtrans checkout (off: web only). */
  checkoutOnAndroid: boolean;
  /** Algorithm constants (lib/tunables). */
  tunables: Tunables;
  /** ISO time of the server row, or null for the defaults. */
  updatedAt: string | null;
}

export const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  monetizationMode: process.env.NEXT_PUBLIC_ABOT_MONETIZATION === "COMMERCIAL_LIVE" ? "COMMERCIAL_LIVE" : "FOUNDERS_BETA",
  prices: { monthlyIdr: 29_000, annualIdr: 199_000, lifetimeIdr: 798_000, monthlyUsd: 2.99, annualUsd: 19.99, lifetimeUsd: 79.98 },
  announcement: null,
  offlineCodesEnabled: true,
  checkoutEnabled: false,
  checkoutOnAndroid: true,
  tunables: DEFAULT_TUNABLES,
  updatedAt: null,
};

const CACHE_KEY = "abot.remote-config";
const LOCAL_KEY = "abot.remote-config.local";
const FETCHED_KEY = "abot.remote-config.fetched-at";
const REFRESH_MS = 6 * 3_600_000;

const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : typeof v === "string" && Number(v) > 0 ? Number(v) : fallback);

/** Any row or stored copy, made safe: unknown fields are ignored, bad ones fall back. */
export function normalizeRemoteConfig(raw: unknown): RemoteConfig {
  const d = DEFAULT_REMOTE_CONFIG;
  if (typeof raw !== "object" || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const p = (typeof r.prices === "object" && r.prices !== null ? r.prices : {}) as Record<string, unknown>;
  const mode = r.monetization_mode ?? r.monetizationMode;
  const banner = r.announcement_banner ?? r.announcement;
  return {
    monetizationMode: mode === "COMMERCIAL_LIVE" || mode === "FOUNDERS_BETA" ? mode : d.monetizationMode,
    prices: {
      monthlyIdr: num(r.monthly_price_idr ?? p.monthlyIdr, d.prices.monthlyIdr),
      annualIdr: num(r.annual_price_idr ?? p.annualIdr, d.prices.annualIdr),
      lifetimeIdr: num(r.lifetime_price_idr ?? p.lifetimeIdr, d.prices.lifetimeIdr),
      monthlyUsd: num(r.monthly_price_usd ?? p.monthlyUsd, d.prices.monthlyUsd),
      annualUsd: num(r.annual_price_usd ?? p.annualUsd, d.prices.annualUsd),
      lifetimeUsd: num(r.lifetime_price_usd ?? p.lifetimeUsd, d.prices.lifetimeUsd),
    },
    announcement: typeof banner === "string" && banner.trim() ? banner.trim().slice(0, 280) : null,
    offlineCodesEnabled: (r.offline_codes_enabled ?? r.offlineCodesEnabled) !== false,
    checkoutEnabled: (r.checkout_enabled ?? r.checkoutEnabled) === true,
    checkoutOnAndroid: (r.checkout_on_android ?? r.checkoutOnAndroid) !== false,
    tunables: normalizeTunables(r.tunables),
    updatedAt: typeof (r.updated_at ?? r.updatedAt) === "string" ? ((r.updated_at ?? r.updatedAt) as string) : null,
  };
}

function read(key: string): unknown {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the config still works for this visit.
  }
}

interface RemoteConfigState {
  config: RemoteConfig;
  /** Where `config` came from. */
  source: "default" | "cache" | "server" | "local";
  load: () => void;
  refresh: (force?: boolean) => Promise<void>;
  /** Mission Control without Supabase: applies to this device only. null clears it. */
  setLocalOverride: (c: RemoteConfig | null) => void;
  /** After an admin saved to Supabase: use the new row at once. */
  setServer: (c: RemoteConfig) => void;
}

export const useRemoteConfig = create<RemoteConfigState>()((set, get) => ({
  config: DEFAULT_REMOTE_CONFIG,
  source: "default",
  load: () => {
    const local = read(LOCAL_KEY);
    if (local) return set({ config: normalizeRemoteConfig(local), source: "local" });
    const cached = read(CACHE_KEY);
    if (cached) set({ config: normalizeRemoteConfig(cached), source: "cache" });
  },
  refresh: async (force = false) => {
    if (!isCloudSyncConfigured() || get().source === "local") return;
    const last = Number(read(FETCHED_KEY) ?? 0);
    if (!force && Date.now() - last < REFRESH_MS) return;
    try {
      const res = await fetch(`${SUPABASE_ENV.url}/rest/v1/app_remote_config?id=eq.global&select=*`, {
        headers: { apikey: SUPABASE_ENV.anonKey!, Authorization: `Bearer ${SUPABASE_ENV.anonKey}` },
      });
      if (!res.ok) return;
      const rows = (await res.json()) as unknown[];
      if (!Array.isArray(rows) || rows.length === 0) return;
      const config = normalizeRemoteConfig(rows[0]);
      write(CACHE_KEY, config);
      write(FETCHED_KEY, Date.now());
      if (get().source !== "local") set({ config, source: "server" });
    } catch {
      // Offline or Supabase not set up for this table: the cached copy stays.
    }
  },
  setLocalOverride: (c) => {
    write(LOCAL_KEY, c);
    if (c) set({ config: c, source: "local" });
    else {
      set({ config: DEFAULT_REMOTE_CONFIG, source: "default" });
      get().load();
    }
  },
  setServer: (c) => {
    write(CACHE_KEY, c);
    write(FETCHED_KEY, Date.now());
    set({ config: c, source: "server" });
  },
}));

// Algorithm modules read their constants through lib/tunables; this hands them the live config.
setTunablesSource(() => useRemoteConfig.getState().config.tunables);

/** The monetization mode in force: remote config, else the build setting. */
export function currentMonetizationMode(): MonetizationMode {
  return useRemoteConfig.getState().config.monetizationMode;
}

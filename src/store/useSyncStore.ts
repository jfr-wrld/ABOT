import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import { syncOnce, SIGNED_OUT } from "@/data/sync/engine";
import { createSupabaseRemote, isCloudSyncConfigured, type SupabaseLike } from "@/data/sync/supabase";
import { cleanAuthParams, getSupabase, maySignedIn } from "@/data/sync/client";
import { getActivePersistence, getActiveRepository, hydrateStores } from "./persistence";
import { useHydration } from "./hydration";
import { useSettingsStore } from "./useSettingsStore";
import type { ErrorStage } from "@/lib/syncStatus";
import { isNativeApp } from "@/lib/native/files";

/**
 * In the Android app Google refuses to sign in inside the WebView, so sign-in opens in the
 * system browser (a Custom Tab) and Google returns to the app through this deep link
 * (AndroidManifest.xml). It must be listed under Redirect URLs in Supabase.
 */
export const NATIVE_REDIRECT = "app.abot.gym://auth/callback";

export type SyncPhase = "unconfigured" | "signed_out" | "signing_in" | "idle" | "syncing" | "offline" | "error";

/** Shown once after Google sends the lifter back, on the page they started from. */
export type SignInNotice = { kind: "signed_in" } | { kind: "failed" };

/** Where to go after Google: the sign-in itself always lands on /settings (the allowed redirect URL). */
const RETURN_KEY = "abot.signInReturn";

export function takeSignInReturn(): string | null {
  try {
    const to = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return to && to.startsWith("/") && !to.startsWith("//") ? to : null;
  } catch {
    return null;
  }
}

interface SyncStoreState {
  phase: SyncPhase;
  userId: string | null;
  email: string | null;
  name: string | null;
  lastSyncedAt: number | null;
  pendingCount: number;
  conflictCount: number;
  /** The raw message; screens show friendlyError(errorStage, lastError). */
  lastError: string | null;
  errorStage: ErrorStage | null;
  notice: SignInNotice | null;
  /** returnTo: the in-app path to come back to after Google, e.g. "/profile". */
  signIn: (returnTo?: string) => Promise<void>;
  clearNotice: () => void;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshCounts: () => Promise<void>;
}

let running: Promise<void> | null = null;
let again = false;

export const useSyncStore = create<SyncStoreState>()((set, get) => ({
  phase: isCloudSyncConfigured() ? "signed_out" : "unconfigured",
  userId: null,
  email: null,
  name: null,
  lastSyncedAt: null,
  pendingCount: 0,
  conflictCount: 0,
  lastError: null,
  errorStage: null,
  notice: null,

  async signIn(returnTo) {
    set({ phase: "signing_in", lastError: null, errorStage: null, notice: null });
    try {
      try {
        sessionStorage.setItem(RETURN_KEY, returnTo ?? "/settings");
      } catch {
        // Without storage the return lands on Settings, which still shows the result.
      }
      const supabase = await getSupabase();
      if (isNativeApp()) {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true },
        });
        if (error) throw error;
        const { Browser } = await import("@capacitor/browser");
        // Closing the tab without finishing leaves the lifter signed out, not stuck on "signing in".
        const closed = await Browser.addListener("browserFinished", () => {
          void closed.remove();
          if (get().phase === "signing_in") set({ phase: "signed_out" });
        });
        await Browser.open({ url: data.url });
        return;
      }
      // Leaves the app for Google; the return lands on Settings, where initSync finishes it.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/settings` },
      });
      if (error) throw error;
    } catch (e) {
      set({ phase: "error", lastError: message(e), errorStage: "sign_in" });
    }
  },

  async signOut() {
    try {
      // Local scope: works offline and does not sign the user out of their other devices.
      await (await getSupabase()).auth.signOut({ scope: "local" });
    } catch {
      // The local session is what matters here; it is cleared below either way.
    }
    const repo = getActiveRepository();
    const state = (await repo?.kv.get("syncState")) ?? SIGNED_OUT;
    // userId and the cursor stay, so signing back in as the same person continues where it was.
    await repo?.kv.set("syncState", { ...state, phase: "signed_out" });
    set({ phase: "signed_out", email: null, name: null, lastError: null, errorStage: null });
  },

  async syncNow() {
    const { phase } = get();
    if (phase === "unconfigured" || phase === "signed_out" || phase === "signing_in") return;
    if (useHydration.getState().tab !== "owner") return;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        await runSync(set);
      } while (again);
    })().finally(() => {
      running = null;
    });
    return running;
  },

  clearNotice() {
    set({ notice: null });
  },

  async refreshCounts() {
    const repo = getActiveRepository();
    if (!repo) return;
    const [pending, conflicts] = await Promise.all([repo.sync.pending(), repo.kv.get("conflicts")]);
    set({ pendingCount: pending.length, conflictCount: conflicts?.length ?? 0 });
  },
}));

async function runSync(set: (s: Partial<SyncStoreState>) => void): Promise<void> {
  const repo = getActiveRepository();
  const persistence = getActivePersistence();
  if (!repo || !persistence) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    set({ phase: "offline" });
    return;
  }
  set({ phase: "syncing", lastError: null, errorStage: null });
  try {
    // Everything logged so far reaches storage first, so it is part of this sync.
    await persistence.flush();
    const supabase = await getSupabase();
    const result = await syncOnce(repo, createSupabaseRemote(supabase as unknown as SupabaseLike));
    if (result.changedLocal) {
      // Reload what other devices changed. Pending writes go first, so nothing in memory is lost.
      await persistence.runExclusive(() => hydrateStores(repo));
    }
    const state = await repo.kv.get("syncState");
    set({ phase: "idle", lastSyncedAt: state?.lastSyncedAt ?? Date.now() });
  } catch (e) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    set(offline ? { phase: "offline" } : { phase: "error", lastError: message(e), errorStage: "sync" });
  }
  await useSyncStore.getState().refreshCounts();
}

/** Runs once each time this tab becomes the writer. Guests never load the Supabase client. */
export async function initSync(): Promise<void> {
  if (!isCloudSyncConfigured()) {
    useSyncStore.setState({ phase: "unconfigured" });
    return;
  }
  await useSyncStore.getState().refreshCounts();
  if (!maySignedIn()) {
    useSyncStore.setState({ phase: "signed_out" });
    return;
  }
  const returning = returningFromGoogle();
  try {
    const supabase = await getSupabase();
    // With detectSessionInUrl this also finishes a return from Google (?code=...).
    const { data, error } = await supabase.auth.getSession();
    const oauthError = cleanAuthParams();
    if (oauthError) throw new Error(oauthError);
    if (error) throw error;
    if (!data.session) {
      useSyncStore.setState({ phase: "signed_out", ...(returning ? { notice: { kind: "failed" } } : {}) });
      return;
    }
    // The notice goes up before the first sync, so the lifter is not left waiting on it.
    await onSignedIn(data.session.user, returning);
  } catch (e) {
    useSyncStore.setState({
      phase: "error",
      lastError: message(e),
      errorStage: "sign_in",
      ...(returning ? { notice: { kind: "failed" } } : {}),
    });
  }
}

function returningFromGoogle(): boolean {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.has("code") || p.has("error_description");
  } catch {
    return false;
  }
}

async function onSignedIn(user: User, returning = false): Promise<void> {
  const repo = getActiveRepository();
  if (!repo) return;
  const state = (await repo.kv.get("syncState")) ?? SIGNED_OUT;
  const switched = state.userId !== null && state.userId !== user.id;
  // A different account on this device: everything here uploads to the new account.
  if (switched) await repo.sync.markAllPending();
  await repo.kv.set("syncState", {
    ...state,
    userId: user.id,
    lastPulledCursor: switched ? null : state.lastPulledCursor,
    phase: "idle",
  });
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  const name = meta?.full_name ?? meta?.name ?? null;
  useSyncStore.setState({
    phase: "idle",
    userId: user.id,
    email: user.email ?? null,
    name,
    lastSyncedAt: state.lastSyncedAt,
    ...(returning ? { notice: { kind: "signed_in" } } : {}),
  });
  // The profile picks up the Google name only if the lifter has not typed one.
  const settings = useSettingsStore.getState();
  if (name && !settings.profileName.trim()) settings.update({ profileName: name });
  await useSyncStore.getState().syncNow();
}

/**
 * The app's half of Google sign-in: Google sends the lifter to NATIVE_REDIRECT with a one-time
 * code, which becomes the session here. Returns where to go next (the page sign-in started from).
 */
export async function finishNativeSignIn(url: string): Promise<string | null> {
  if (!url.startsWith(NATIVE_REDIRECT)) return null;
  const { Browser } = await import("@capacitor/browser");
  void Browser.close().catch(() => {});
  const params = new URL(url).searchParams;
  const code = params.get("code");
  try {
    const failure = params.get("error_description");
    if (failure || !code) throw new Error(failure ?? "Google did not send a sign-in code");
    const { data, error } = await (await getSupabase()).auth.exchangeCodeForSession(code);
    if (error) throw error;
    await onSignedIn(data.user, true);
  } catch (e) {
    useSyncStore.setState({ phase: "error", lastError: message(e), errorStage: "sign_in", notice: { kind: "failed" } });
  }
  return takeSignInReturn();
}

function message(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

let wired = false;

/**
 * Automatic syncs (master plan 3.1): when this tab becomes the writer, when the connection comes
 * back, and shortly after a workout is finished. None of them blocks the UI.
 */
export function wireSyncTriggers(onTabStarted: (fn: () => void) => void, onWorkoutFinished: (fn: () => void) => void): void {
  if (wired) return;
  wired = true;
  onTabStarted(() => void initSync());
  window.addEventListener("online", () => void useSyncStore.getState().syncNow());
  let timer: ReturnType<typeof setTimeout> | undefined;
  onWorkoutFinished(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void useSyncStore.getState().syncNow(), 1500);
  });
}

import { useCallback, useMemo } from "react";
import { create } from "zustand";
import { useSettingsStore } from "./useSettingsStore";
import { useRemoteConfig, currentMonetizationMode } from "@/lib/remote-config";
import {
  DEFAULT_ENTITLEMENT,
  claimFounder,
  resolveEntitlement,
  type DevOverride,
  type EntitlementState,
  type ProFeatureKey,
} from "@/lib/entitlements";
import { newId } from "@/lib/id";

/** The paywall is one sheet for the whole app; this says whether it is open and for what. */
interface PaywallState {
  open: boolean;
  feature: ProFeatureKey | null;
  show: (feature?: ProFeatureKey | null) => void;
  close: () => void;
}

export const usePaywallStore = create<PaywallState>()((set) => ({
  open: false,
  feature: null,
  show: (feature = null) => set({ open: true, feature }),
  close: () => set({ open: false }),
}));

const current = (): EntitlementState => useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT;

/** Saves a change to the entitlement in settings (on the device and in backups). */
export function updateEntitlement(patch: Partial<EntitlementState>): void {
  useSettingsStore.getState().update({ entitlement: { ...current(), ...patch } });
}

/** Stamps this install a Founder once, while the build is in the founders beta. */
export function autoClaimFounder(): void {
  if (currentMonetizationMode() !== "FOUNDERS_BETA") return;
  const e = current();
  if (e.isFounder) return;
  useSettingsStore.getState().update({ entitlement: claimFounder(e, `${newId()}-${Date.now()}`) });
}

/**
 * Entitlements for any component: whether PRO is open, the founder pass, and the paywall.
 * `canAccessPro(key)` is true for every key while PRO is open (beta, or a paid tier).
 */
export function useEntitlements() {
  const e = useSettingsStore((s) => s.entitlement) ?? DEFAULT_ENTITLEMENT;
  const show = usePaywallStore((s) => s.show);
  // Mission Control's switch (remote config) decides beta or paywall for every install.
  const appMode = useRemoteConfig((s) => s.config.monetizationMode);
  const r = useMemo(() => resolveEntitlement(e, appMode), [e, appMode]);
  // Every PRO feature is gated the same way today; the key names what is being asked for.
  const canAccessPro = useCallback(
    (feature?: ProFeatureKey) => {
      void feature;
      return r.proActive;
    },
    [r.proActive],
  );
  const openPaywall = useCallback((feature?: ProFeatureKey) => show(feature ?? null), [show]);
  const setDevOverride = useCallback((m: DevOverride) => updateEntitlement({ devOverrideMode: m }), []);
  return {
    ...r,
    canAccessPro,
    openPaywall,
    setDevOverride,
    devOverrideMode: e.devOverrideMode,
    isFounder: e.isFounder,
    founderUnitCode: e.founderUnitCode,
    founderJoinedAt: e.founderJoinedAt,
  };
}

"use client";

import { useEffect } from "react";
import { useHydration } from "@/store/hydration";
import { autoClaimFounder, updateEntitlement, usePaywallStore } from "@/store/useEntitlements";
import { useSettingsStore } from "@/store/useSettingsStore";
import { DEFAULT_ENTITLEMENT } from "@/lib/entitlements";
import { syncEntitlementWithAccount } from "@/lib/entitlement-sync";
import dynamic from "next/dynamic";

// Loaded on the first openPaywall(): most visits never show it (performance audit 2026-11-11).
const AbotProModal = dynamic(() => import("./AbotProModal").then((m) => m.AbotProModal), { ssr: false });
import { RedeemCodeModal } from "./RedeemCodeModal";
import { PaymentReturn } from "./PaymentReturn";
import { ProCelebration } from "./ProCelebration";

/**
 * Once saved settings have loaded: stamps the Founder pass on installs made during the beta,
 * and keeps the one ABOT // BLACK PRO sheet that any feature can open with openPaywall().
 */
export function EntitlementsProvider() {
  const hydrated = useHydration((s) => s.hydrated);
  useEffect(() => {
    if (!hydrated) return;
    autoClaimFounder();
    // Signed in: a licence bought or granted on the account comes down to this device.
    void syncEntitlementWithAccount(useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT).then((next) => next && updateEntitlement(next));
  }, [hydrated]);
  // Mounted only while open. Left in the page closed, the full-screen <dialog> made links on
  // other screens (the workout summary's) never settle for a click in the e2e browser.
  const open = usePaywallStore((s) => s.open);
  return (
    <>
      {open && <AbotProModal />}
      <RedeemCodeModal />
      {hydrated && <PaymentReturn />}
      <ProCelebration />
    </>
  );
}

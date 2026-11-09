"use client";

import { useEffect } from "react";
import { useHydration } from "@/store/hydration";
import { autoClaimFounder, usePaywallStore } from "@/store/useEntitlements";
import { AbotProModal } from "./AbotProModal";

/**
 * Once saved settings have loaded: stamps the Founder pass on installs made during the beta,
 * and keeps the one ABOT // BLACK PRO sheet that any feature can open with openPaywall().
 */
export function EntitlementsProvider() {
  const hydrated = useHydration((s) => s.hydrated);
  useEffect(() => {
    if (hydrated) autoClaimFounder();
  }, [hydrated]);
  // Mounted only while open. Left in the page closed, the full-screen <dialog> made links on
  // other screens (the workout summary's) never settle for a click in the e2e browser.
  const open = usePaywallStore((s) => s.open);
  return open ? <AbotProModal /> : null;
}

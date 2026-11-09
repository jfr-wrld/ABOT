"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DEFAULT_ENTITLEMENT } from "@/lib/entitlements";
import { syncEntitlementWithAccount } from "@/lib/entitlement-sync";
import { CHECKOUT_OPENED, PAYMENT_STATUS_MESSAGE as MESSAGE, pendingOrder, rememberPendingOrder, waitForOrder, type PaymentShown as Shown } from "@/lib/checkout";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { updateEntitlement } from "@/store/useEntitlements";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useT } from "@/i18n";
import { useCelebrationStore } from "./ProCelebration";

/**
 * After Midtrans: the web return URL carries ?order_id=..., and on Android the buyer comes back
 * from the browser. Either way the order is read back until it settles, the account's licence is
 * pulled down, and one line says what happened.
 */
export function PaymentReturn() {
  const t = useT();
  const [shown, setShown] = useState<Shown | null>(null);
  const busy = useRef(false);

  /** `waiting`: the payment page just opened in another tab, so keep reading for a few minutes. */
  const check = useCallback(async (waiting = false) => {
    const fromUrl = new URLSearchParams(window.location.search).get("order_id");
    const orderId = fromUrl && /^ABOT-[A-Z0-9-]+$/.test(fromUrl) ? fromUrl : pendingOrder();
    if (!orderId || busy.current) return;
    busy.current = true;
    setShown(waiting ? "pending" : "checking");
    const status = await waitForOrder(orderId, waiting ? { tries: 100, everyMs: 3000 } : undefined);
    if (status && status !== "pending") rememberPendingOrder(null);
    if (status === "paid" || status === "refunded") {
      const next = await syncEntitlementWithAccount(useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT);
      if (next) updateEntitlement(next);
    }
    if (status === "paid") {
      // The full-screen moment replaces the one-line banner.
      const e = useSettingsStore.getState().entitlement ?? DEFAULT_ENTITLEMENT;
      useCelebrationStore.getState().show(e.tier === "lifetime" ? { tier: "lifetime" } : { tier: "pro", until: e.proExpiresAt });
      setShown(null);
    } else setShown(status ?? "unknown");
    if (fromUrl) {
      // Drop Midtrans' query so a reload does not check the same order again.
      const url = new URL(window.location.href);
      for (const k of ["order_id", "status_code", "transaction_status"]) url.searchParams.delete(k);
      window.history.replaceState(null, "", url.toString());
    }
    busy.current = false;
  }, []);

  useEffect(() => {
    // A timer, not a direct call: the check sets state, and effects must not do that synchronously.
    const id = window.setTimeout(() => void check(), 0);
    return () => window.clearTimeout(id);
  }, [check]);
  useAppResumed(() => void check());

  useEffect(() => {
    const opened = () => void check(true);
    // payment-done.html (same site, other tab) says the buyer finished: look now.
    const done = (e: StorageEvent) => e.key === "abot.payment-done" && void check();
    window.addEventListener(CHECKOUT_OPENED, opened);
    window.addEventListener("storage", done);
    return () => {
      window.removeEventListener(CHECKOUT_OPENED, opened);
      window.removeEventListener("storage", done);
    };
  }, [check]);

  if (!shown) return null;
  const good = shown === "paid";
  return (
    <div className="fixed inset-x-0 top-[calc(8px+env(safe-area-inset-top))] z-50 mx-auto w-[min(560px,calc(100%-32px))]">
      <div
        role={shown === "failed" || shown === "unknown" ? "alert" : "status"}
        className={`flex items-start gap-2 rounded-ctl border bg-surface px-3 py-2.5 text-sm shadow-lg ${good ? "border-accent" : "border-line-strong"}`}
      >
        <p className="flex-1">{t(MESSAGE[shown])}</p>
        {shown !== "checking" && (
          <button
            type="button"
            onClick={() => setShown(null)}
            aria-label={t("Dismiss")}
            className="-m-1.5 flex size-9 shrink-0 items-center justify-center rounded-ctl text-text-muted hover:text-text"
          >
            <X aria-hidden="true" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

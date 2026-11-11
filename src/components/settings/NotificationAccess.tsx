"use client";

import { useState } from "react";
import { BellOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { syncPermission, useReminderStore } from "@/store/useReminderStore";
import { isNativeApp } from "@/lib/native/files";
import { openNotificationSettings } from "@/lib/native/permissions";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { useT } from "@/i18n";

/** Faster than anyone could answer a permission dialog: Android showed none. */
const INSTANT_REFUSAL_MS = 500;

/**
 * Settings > Notifications, on top: the one place that asks for notification access. The rest
 * alarm, the live status and the reminders below all depend on it, so none of them asks on its
 * own. Hidden once access is given.
 */
export function NotificationAccess() {
  const t = useT();
  const permission = useReminderStore((s) => s.permission);
  const request = useReminderStore((s) => s.requestPermission);
  const [error, setError] = useState<string | null>(null);
  const app = isNativeApp();
  // Access turned on in Android settings shows here as soon as the lifter comes back.
  useAppResumed(() => void syncPermission().catch(() => {}));

  if (permission === "granted") return null;

  async function openSettings() {
    setError(null);
    try {
      await openNotificationSettings();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function allow() {
    setError(null);
    const asked = Date.now();
    await request();
    if (app && useReminderStore.getState().permission !== "granted" && Date.now() - asked < INSTANT_REFUSAL_MS) await openSettings();
  }

  const text =
    permission === "unsupported"
      ? t("This browser cannot show notifications. Reminders can still go to your calendar.")
      : permission === "denied"
        ? app
          ? t("Notifications are off for ABOT, so the rest alarm, the workout status and reminders cannot show.")
          : t("Notifications are blocked for ABOT. Allow them in this site's browser settings.")
        : t("Allow notifications for the rest-over alarm, the workout status and reminders.");

  return (
    <section aria-labelledby="notify-access-heading" className="rounded-card border border-line-strong bg-surface-2 p-3">
      <h2 id="notify-access-heading" className="flex items-center gap-2 text-sm font-semibold">
        <BellOff aria-hidden="true" size={16} className="text-text-muted" />
        {t("Notifications are off")}
      </h2>
      <p className="mt-1 text-sm text-text-muted">{text}</p>
      {permission === "default" && (
        <Button variant="primary" onClick={() => void allow()} className="mt-3 w-full">
          {t("Allow notifications")}
        </Button>
      )}
      {permission === "denied" && app && (
        <Button onClick={() => void openSettings()} className="mt-3 w-full">
          {t("Turn on in Android settings")}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-failure">
          {error}
        </p>
      )}
    </section>
  );
}

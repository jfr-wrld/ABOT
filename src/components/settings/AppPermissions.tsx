"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Camera, Check, MapPin, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { syncPermission, useReminderStore } from "@/store/useReminderStore";
import { useT, type T } from "@/i18n";
import { checkAccess, openAppSettings, openNotificationSettings, requestAccess, type Access, type AccessKind } from "@/lib/native/permissions";
import { useAppResumed } from "@/lib/native/useAppResumed";
import { isNativeApp } from "@/lib/native/files";

type Kind = "notifications" | AccessKind;

const ROWS: { kind: Kind; icon: LucideIcon }[] = [
  { kind: "notifications", icon: Bell },
  { kind: "camera", icon: Camera },
  { kind: "location", icon: MapPin },
];

function rowText(kind: Kind, t: T): { title: string; why: string } {
  if (kind === "notifications") return { title: t("Notifications"), why: t("Rest-over alarm, the workout on your lock screen, reminders.") };
  if (kind === "camera") return { title: t("Camera"), why: t("Take a profile photo or a story background.") };
  return { title: t("Location"), why: t("Picks the gym you are at when a workout starts.") };
}

/** Faster than anyone could answer a permission dialog. */
const INSTANT_REFUSAL_MS = 500;

const fromNotify = (p: string): Access => (p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt");

/**
 * What each access is for, its state, and one tap to allow it, or to open the right Android
 * settings page once Android will no longer ask. States are read again whenever the user comes
 * back to ABOT, so a change made in Android settings shows at once.
 */
export function useAppPermissions() {
  const notify = useReminderStore((s) => s.permission);
  const requestNotify = useReminderStore((s) => s.requestPermission);
  const [state, setState] = useState<Record<AccessKind, Access>>({ camera: "prompt", location: "prompt" });
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});

  const read = useCallback(() => {
    void Promise.all([checkAccess("camera"), checkAccess("location")])
      .then(([camera, location]) => setState({ camera, location }))
      .catch(() => {});
    void syncPermission().catch(() => {});
  }, []);
  useEffect(read, [read]);
  useAppResumed(read);

  const access = (kind: Kind): Access => (kind === "notifications" ? fromNotify(notify) : state[kind]);
  const fail = (kind: Kind, err: unknown) =>
    setErrors((e) => ({ ...e, [kind]: err instanceof Error && err.message ? err.message : String(err) }));

  /** Android settings for an access it will no longer ask about. */
  const openSettings = useCallback(async (kind: Kind) => {
    setErrors((e) => ({ ...e, [kind]: undefined }));
    try {
      await (kind === "notifications" ? openNotificationSettings() : openAppSettings());
    } catch (err) {
      fail(kind, err);
    }
  }, []);

  const allow = useCallback(
    async (kind: Kind) => {
      setErrors((e) => ({ ...e, [kind]: undefined }));
      const asked = Date.now();
      try {
        let granted: boolean;
        if (kind === "notifications") {
          await requestNotify();
          granted = useReminderStore.getState().permission === "granted";
        } else {
          const next = await requestAccess(kind);
          setState((s) => ({ ...s, [kind]: next }));
          granted = next === "granted";
        }
        // An answer this fast means Android showed no dialog: it was turned off for good, and
        // only Android settings can turn it back on. Take the lifter there instead of doing nothing.
        if (!granted && isNativeApp() && Date.now() - asked < INSTANT_REFUSAL_MS) await openSettings(kind);
      } catch (err) {
        fail(kind, err);
      }
    },
    [requestNotify, openSettings],
  );

  /** Asks for each access not yet decided, one system prompt after another. */
  const allowAll = async () => {
    for (const { kind } of ROWS) if (access(kind) === "prompt") await allow(kind);
  };

  return { access, allow, allowAll, openSettings, errors };
}

export function AppPermissionsList({ perms }: { perms: ReturnType<typeof useAppPermissions> }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-2">
      {ROWS.map(({ kind, icon: Icon }) => {
        const { title, why } = rowText(kind, t);
        const a = perms.access(kind);
        const error = perms.errors[kind];
        return (
          <li key={kind} className="rounded-ctl border border-line bg-surface p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${a === "granted" ? "bg-accent/15 text-accent" : "bg-surface-2 text-text-muted"}`}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-text-muted">{why}</p>
              </div>
              {a === "granted" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                  <Check aria-hidden="true" size={14} /> {t("On")}
                </span>
              ) : a === "denied" ? (
                <Button onClick={() => void perms.openSettings(kind)} aria-label={t("{name} is off. Open Android settings", { name: title })} className="shrink-0">
                  {t("Settings")}
                </Button>
              ) : (
                <Button onClick={() => void perms.allow(kind)} aria-label={t("Allow {name}", { name: title.toLowerCase() })} className="shrink-0">
                  {t("Allow")}
                </Button>
              )}
            </div>
            {a === "denied" && !error && (
              <p className="mt-2 text-xs text-text-muted">{t("Android will not ask again. Turn it on in Android settings.")}</p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs text-failure">
                {t(error)}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Settings section; the Android app only. */
export function AppPermissionsSection() {
  const perms = useAppPermissions();
  const t = useT();
  return (
    <section aria-labelledby="permissions-heading" className="flex flex-col gap-2">
      <h2 id="permissions-heading" className="text-sm font-semibold">
        {t("App permissions")}
      </h2>
      <AppPermissionsList perms={perms} />
    </section>
  );
}

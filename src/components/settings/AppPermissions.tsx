"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Camera, Check, MapPin, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useReminderStore } from "@/store/useReminderStore";
import { useT, type T } from "@/i18n";
import { checkAccess, openAppSettings, requestAccess, type Access, type AccessKind } from "@/lib/native/permissions";

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

const fromNotify = (p: string): Access => (p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt");

/** What each access is for, its state, and one tap to allow it (or open Android settings). */
export function useAppPermissions() {
  const notify = useReminderStore((s) => s.permission);
  const requestNotify = useReminderStore((s) => s.requestPermission);
  const [state, setState] = useState<Record<AccessKind, Access>>({ camera: "prompt", location: "prompt" });

  useEffect(() => {
    const read = () =>
      void Promise.all([checkAccess("camera"), checkAccess("location")])
        .then(([camera, location]) => setState({ camera, location }))
        .catch(() => {});
    read();
    // Coming back from Android settings re-reads every access.
    const onVisible = () => document.visibilityState === "visible" && read();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  const access = (kind: Kind): Access => (kind === "notifications" ? fromNotify(notify) : state[kind]);

  const allow = useCallback(
    async (kind: Kind) => {
      if (kind === "notifications") return requestNotify();
      const next = await requestAccess(kind).catch(() => "prompt" as const);
      setState((s) => ({ ...s, [kind]: next }));
    },
    [requestNotify],
  );

  /** Asks for each access not yet decided, one system prompt after another. */
  const allowAll = async () => {
    for (const { kind } of ROWS) if (access(kind) === "prompt") await allow(kind);
  };

  return { access, allow, allowAll };
}

export function AppPermissionsList({ perms }: { perms: ReturnType<typeof useAppPermissions> }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-2">
      {ROWS.map(({ kind, icon: Icon }) => {
        const { title, why } = rowText(kind, t);
        const a = perms.access(kind);
        return (
          <li key={kind} className="flex items-center gap-3 rounded-ctl border border-line bg-surface p-3">
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
              <Button variant="ghost" onClick={() => void openAppSettings()} aria-label={t("{name} is off. Open Android settings", { name: title })} className="shrink-0">
                {t("Settings")}
              </Button>
            ) : (
              <Button onClick={() => void perms.allow(kind)} aria-label={t("Allow {name}", { name: title.toLowerCase() })} className="shrink-0">
                {t("Allow")}
              </Button>
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

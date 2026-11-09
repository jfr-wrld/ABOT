"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, CircleHelp, Cloud, Dumbbell, HeartPulse, Info, LogOut, Mail, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SocialIcon } from "@/components/brand/SocialIcons";
import { CONTACT_EMAIL, SOCIAL_LINKS, contactHref } from "@/lib/social";
import { useAppVersion } from "./AppVersion";
import { LANGUAGE_LABEL, SECTION_TITLE, THEME_LABEL, type SettingsSection } from "./labels";
import { useT } from "@/i18n";
import { FounderPassCard } from "./FounderPassCard";
import { BuildTag } from "./BuildTag";

export { SECTION_TITLE, type SettingsSection };

const href = (s: SettingsSection) => `/settings?section=${s}`;

function useSignedIn() {
  const s = useSyncStore();
  return { signedIn: s.userId !== null && (s.phase === "idle" || s.phase === "syncing" || s.phase === "offline" || s.phase === "error"), email: s.email };
}

/** Settings as a short list of groups; each row opens its section. */
export function SettingsHome() {
  const s = useSettingsStore();
  const notify = useReminderStore((r) => r.permission);
  const { signedIn, email } = useSignedIn();
  const version = useAppVersion();
  const t = useT();
  const language = s.language === "auto" ? t(LANGUAGE_LABEL.auto) : LANGUAGE_LABEL[s.language];

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
      <FounderPassCard />

      <Group title={t("Account")}>
        <Row
          to={href("data")}
          icon={Cloud}
          title={signedIn ? t("Backup & sync") : t("Sign in to back up")}
          value={signedIn ? (email ?? t("Google account")) : t("Optional")}
        />
      </Group>

      <Group title={t("Preferences")}>
        <Row to={href("general")} icon={SlidersHorizontal} title={t(SECTION_TITLE.general)} value={`${language} · ${t(THEME_LABEL[s.theme])} · ${s.weightUnit}`} />
        <Row to={href("workout")} icon={Dumbbell} title={t(SECTION_TITLE.workout)} value={t("Rest, RPE, gyms")} />
        <Row
          to={href("notifications")}
          icon={Bell}
          title={t(SECTION_TITLE.notifications)}
          value={notify === "granted" ? t("On") : notify === "denied" ? t("Off") : t("Not set")}
        />
        <Row to={href("health")} icon={HeartPulse} title={t(SECTION_TITLE.health)} value={s.healthAutoSync ? t("Auto-sync on") : "Health Connect"} />
      </Group>

      <Group title={t("Support")}>
        <Row to={href("faq")} icon={CircleHelp} title={t(SECTION_TITLE.faq)} />
        <Row to={contactHref(version)} icon={Mail} title={t("Contact us")} value={CONTACT_EMAIL} external />
        <Row to={href("about")} icon={Info} title={t(SECTION_TITLE.about)} />
      </Group>

      <Group title={t("Follow ABOT")}>
        {SOCIAL_LINKS.map((l) =>
          l.url ? (
            <Row key={l.id} to={l.url} icon={() => <SocialIcon id={l.id} />} title={l.name} external />
          ) : (
            <li key={l.id} className="flex min-h-14 items-center gap-3 px-3 text-text-muted">
              <IconTile>
                <SocialIcon id={l.id} />
              </IconTile>
              <span className="min-w-0 flex-1 text-sm font-semibold">{l.name}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs">{t("Soon")}</span>
            </li>
          ),
        )}
      </Group>

      {signedIn && <SignOutButton />}
      <BuildTag />
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="label-caps mb-2 px-1">{title}</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">{children}</ul>
    </section>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-ctl bg-surface-2 text-text">
      {children}
    </span>
  );
}

function Row({ to, icon: Icon, title, value, external }: { to: string; icon: LucideIcon | (() => ReactNode); title: string; value?: string; external?: boolean }) {
  const body = (
    <>
      <IconTile>
        <Icon size={18} />
      </IconTile>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {value && <span className="block truncate text-xs text-text-muted">{value}</span>}
      </span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
    </>
  );
  const cls = "flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-surface-2";
  return (
    <li>
      {external ? (
        <a href={to} target={to.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls}>
          {body}
        </a>
      ) : (
        <Link href={to} className={cls}>
          {body}
        </Link>
      )}
    </li>
  );
}

/** Unbinds the Google account from this phone; the workouts stay here and in the backup. */
function SignOutButton() {
  const [confirm, setConfirm] = useState(false);
  const signOut = useSyncStore((s) => s.signOut);
  const t = useT();
  return (
    <>
      <Button variant="danger" onClick={() => setConfirm(true)} className="w-full">
        <LogOut aria-hidden="true" size={18} />
        {t("Sign out")}
      </Button>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("Sign out of ABOT?")}
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirm(false)}>{t("Stay signed in")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                void signOut();
              }}
            >
              {t("Sign out")}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          {t("Your workouts stay on this phone and in your backup. New workouts are not backed up until you sign in again.")}
        </p>
      </Sheet>
    </>
  );
}

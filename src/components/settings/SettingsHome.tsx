"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, CircleHelp, Cloud, Dumbbell, Info, LogOut, Mail, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useReminderStore } from "@/store/useReminderStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SocialIcon } from "@/components/brand/SocialIcons";
import { CONTACT_EMAIL, SOCIAL_LINKS, contactHref } from "@/lib/social";
import { AppVersion, useAppVersion } from "./AppVersion";
import { LANGUAGE_LABEL, THEME_LABEL } from "./sections";

export type SettingsSection = "general" | "workout" | "notifications" | "data" | "faq" | "about";

export const SECTION_TITLE: Record<SettingsSection, string> = {
  general: "General",
  workout: "Workout",
  notifications: "Notifications",
  data: "Data & backup",
  faq: "FAQ",
  about: "About ABOT",
};

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

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
      <Group title="Account">
        <Row
          to={href("data")}
          icon={Cloud}
          title={signedIn ? "Backup & sync" : "Sign in to back up"}
          value={signedIn ? (email ?? "Google account") : "Optional"}
        />
      </Group>

      <Group title="Preferences">
        <Row to={href("general")} icon={SlidersHorizontal} title="General" value={`${LANGUAGE_LABEL[s.language]} · ${THEME_LABEL[s.theme]} · ${s.weightUnit}`} />
        <Row to={href("workout")} icon={Dumbbell} title="Workout" value="Rest, RPE, gyms" />
        <Row to={href("notifications")} icon={Bell} title="Notifications" value={notify === "granted" ? "On" : notify === "denied" ? "Off" : "Not set"} />
      </Group>

      <Group title="Support">
        <Row to={href("faq")} icon={CircleHelp} title="FAQ" />
        <Row to={contactHref(version)} icon={Mail} title="Contact us" value={CONTACT_EMAIL} external />
        <Row to={href("about")} icon={Info} title="About ABOT" />
      </Group>

      <Group title="Follow ABOT">
        {SOCIAL_LINKS.map((l) =>
          l.url ? (
            <Row key={l.id} to={l.url} icon={() => <SocialIcon id={l.id} />} title={l.name} external />
          ) : (
            <li key={l.id} className="flex min-h-14 items-center gap-3 px-3 text-text-muted">
              <IconTile>
                <SocialIcon id={l.id} />
              </IconTile>
              <span className="min-w-0 flex-1 text-sm font-semibold">{l.name}</span>
              <span className="rounded-full border border-line px-2 py-0.5 text-xs">Soon</span>
            </li>
          ),
        )}
      </Group>

      {signedIn && <SignOutButton />}
      <AppVersion />
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
  return (
    <>
      <Button variant="danger" onClick={() => setConfirm(true)} className="w-full">
        <LogOut aria-hidden="true" size={18} />
        Sign out
      </Button>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Sign out of ABOT?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setConfirm(false)}>Stay signed in</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                void signOut();
              }}
            >
              Sign out
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">
          Your workouts stay on this phone and in your backup. New workouts are not backed up until you sign in again.
        </p>
      </Sheet>
    </>
  );
}

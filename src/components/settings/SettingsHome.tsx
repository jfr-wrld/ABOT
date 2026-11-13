"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Bell, ChevronRight, FlaskConical, Smartphone, MapPin, Search, CircleHelp, Cloud, Dumbbell, HeartPulse, Info, LogOut, Mail, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useSyncStore } from "@/store/useSyncStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useLocationStore } from "@/store/useLocationStore";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { SocialIcon } from "@/components/brand/SocialIcons";
import { CONTACT_EMAIL, SOCIAL_LINKS, betaFeedbackHref, contactHref } from "@/lib/social";
import { useAppVersion } from "./AppVersion";
import { LANGUAGE_LABEL, SECTION_TITLE, THEME_LABEL, type SettingsSection } from "./labels";
import { useT } from "@/i18n";
import { FounderPassCard } from "./FounderPassCard";
import { BillingSection } from "./BillingSection";
import { BuildTag } from "./BuildTag";
import { useEntitlements } from "@/store/useEntitlements";
import { isNativeApp } from "@/lib/native/files";
import { DEV_TOOLS } from "@/lib/dev-tools";
import { SETTINGS_INDEX, searchSettings } from "./search-index";
import { useGetApp } from "@/store/useGetApp";
import { usePlatform } from "@/components/get-app/usePlatform";

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
  const { isFounder } = useEntitlements();
  const native = isNativeApp();
  const social = SOCIAL_LINKS.filter((l) => l.url);
  const gym = useLocationStore((st) => st.locations.find((l) => l.isDefault));

  const [query, setQuery] = useState("");
  const entries = SETTINGS_INDEX.filter((e) => (native ? !e.webOnly : !e.nativeOnly));
  const results = searchSettings(query, entries, (e) => `${t(e.title)} ${t(SECTION_TITLE[e.section])}`);

  const search = (
    <div className="relative">
      <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("Search settings")}
        aria-label={t("Search settings")}
        enterKeyHint="search"
        className="h-11 w-full rounded-ctl border border-line-strong bg-surface-2 pl-10 pr-3 text-base text-text placeholder:text-text-muted"
      />
    </div>
  );

  if (query.trim()) {
    return (
      <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
        {search}
        {results.length > 0 ? (
          <Group title={t("Results")}>
            {results.map((e) => (
              <Row
                key={`${e.section}-${e.title}`}
                to={e.href ?? `${href(e.section)}${e.anchor ? `#${e.anchor}` : ""}`}
                icon={Search}
                title={t(e.title)}
                value={e.href ? t("Profile") : t(SECTION_TITLE[e.section])}
              />
            ))}
          </Group>
        ) : (
          <p role="status" className="px-1 text-sm text-text-muted">
            {t("Nothing in Settings matches “{query}”.", { query: query.trim() })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-8 pt-4">
      {search}
      {/* The founder plate is for founders (and the simulator in development builds): everyone
          else starts at their account and settings, not at a card that says they have none. */}
      {(isFounder || DEV_TOOLS) && <FounderPassCard />}
      <GetAppRow />

      <Group title={t("Account")}>
        <Row
          to={href("data")}
          icon={Cloud}
          title={signedIn ? t("Backup & sync") : t("Sign in to back up")}
          value={signedIn ? (email ?? t("Google account")) : t("Optional")}
        />
      </Group>
      <BillingSection />

      <Group title={t("Preferences")}>
        <Row to={href("general")} icon={SlidersHorizontal} title={t(SECTION_TITLE.general)} value={`${language} · ${t(THEME_LABEL[s.theme])} · ${s.weightUnit}`} />
        <Row to={href("workout")} icon={Dumbbell} title={t(SECTION_TITLE.workout)} value={t("Rest, RPE, sounds")} />
        <Row to={href("gyms")} icon={MapPin} title={t(SECTION_TITLE.gyms)} value={gym ? gym.name : t("None yet")} />
        <Row
          to={href("notifications")}
          icon={Bell}
          title={t(SECTION_TITLE.notifications)}
          value={notify === "granted" ? t("On") : notify === "denied" ? t("Off") : t("Not set")}
        />
        <Row to={href("health")} icon={HeartPulse} title={t(SECTION_TITLE.health)} value={native ? (s.healthAutoSync ? t("Auto-sync on") : "Health Connect") : t("Export and body weight")} />
      </Group>

      <Group title={t("Support")}>
        <Row to={href("faq")} icon={CircleHelp} title={t(SECTION_TITLE.faq)} />
        {/* The Android app is in beta: testers get their own, clearly labelled channel. */}
        {native && <Row to={betaFeedbackHref(version)} icon={FlaskConical} title={t("Send beta feedback")} value={t("What broke, confused you or is missing")} external />}
        <Row to={contactHref(version)} icon={Mail} title={t("Contact us")} value={CONTACT_EMAIL} external />
        <Row to={href("about")} icon={Info} title={t(SECTION_TITLE.about)} />
      </Group>

      {/* Only accounts that exist: rows marked "Soon" looked like links and led nowhere. */}
      {social.length > 0 && (
        <Group title={t("Follow ABOT")}>
          {social.map((l) => (
            <Row key={l.id} to={l.url!} icon={() => <SocialIcon id={l.id} />} title={l.name} external />
          ))}
        </Group>
      )}

      {signedIn && <SignOutButton />}
      <BuildTag />
    </div>
  );
}

/** Web only: the Android app (or, on iPhone, Add to Home Screen), opening the Get the app sheet. */
function GetAppRow() {
  const t = useT();
  const platform = usePlatform();
  const show = useGetApp((s) => s.show);
  if (!platform || platform === "native") return null;
  const ios = platform === "ios";
  return (
    <Group title={t("ABOT app")}>
      <li>
        <button type="button" onClick={show} className="tap flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2 active:bg-press">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-ctl bg-accent text-on-accent">
            <Smartphone size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">{ios ? t("Add ABOT to your Home Screen") : t("Get the Android app")}</span>
            <span className="block truncate text-xs text-text-muted">{ios ? t("Full screen and offline, one tap away") : t("Beta · lock-screen workout, rest alarm, reminders")}</span>
          </span>
          <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-text-muted" />
        </button>
      </li>
    </Group>
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
  const cls = "tap flex min-h-14 items-center gap-3 px-3 py-2 hover:bg-surface-2 active:bg-press";
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

"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { SECTION_TITLE, SettingsHome, type SettingsSection } from "@/components/settings/SettingsHome";
import { DataSection, GeneralSection, GymsSection, NotificationsSection, WorkoutSection } from "@/components/settings/sections";
import { AboutSection, FaqSection } from "@/components/settings/SupportSections";
import { HealthSyncCard } from "@/components/settings/HealthSyncCard";
import { useT } from "@/i18n";

const SECTIONS: Record<SettingsSection, () => React.ReactNode> = {
  general: GeneralSection,
  workout: WorkoutSection,
  gyms: GymsSection,
  notifications: NotificationsSection,
  health: HealthSyncCard,
  data: DataSection,
  faq: FaqSection,
  about: AboutSection,
};

/** Old deep links (/settings#sync, /settings#schedule) open the section that now holds them. */
const HASH_SECTION: Record<string, SettingsSection> = { "#sync": "data", "#schedule": "notifications" };

export default function SettingsPage() {
  return (
    <HydrationGate>
      <SettingsScreen />
    </HydrationGate>
  );
}

function SettingsScreen() {
  const router = useRouter();
  const raw = useSearchParams().get("section");
  const section = raw && raw in SECTIONS ? (raw as SettingsSection) : null;
  const t = useT();

  useEffect(() => {
    const to = HASH_SECTION[window.location.hash];
    if (!section && to) router.replace(`/settings?section=${to}${window.location.hash}`);
  }, [section, router]);

  // A search result (or an old deep link) names a setting: bring it into view once it renders.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!section || !id) return;
    let tries = 0;
    let frame = 0;
    const look = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ block: "center" });
      else if (tries++ < 60) frame = requestAnimationFrame(look);
    };
    frame = requestAnimationFrame(look);
    return () => cancelAnimationFrame(frame);
  }, [section]);

  if (!section) {
    return (
      <main className="flex flex-1 flex-col">
        <PageHeader title={t("Settings")} back={{ href: "/", label: t("Home") }} />
        <SettingsHome />
      </main>
    );
  }
  const Body = SECTIONS[section];
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t(SECTION_TITLE[section])} back={{ href: "/settings", label: t("Settings") }} />
      <div className="px-4 pb-8 pt-4">
        <Body />
      </div>
    </main>
  );
}

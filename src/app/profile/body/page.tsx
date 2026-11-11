"use client";

import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { BodyweightSection } from "@/components/profile/BodyweightSection";
import { useNow } from "@/lib/useNow";
import { useT } from "@/i18n";

/**
 * Profile > Body: the one place for weigh-ins, body fat and waist, and their history. Edit
 * profile, Health apps and the workout card link here; the body phase keeps its own daily check-in.
 */
export default function BodyPage() {
  return (
    <HydrationGate>
      <Body />
    </HydrationGate>
  );
}

function Body() {
  const now = useNow(60_000);
  const t = useT();
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("Body")} back={{ href: "/profile", label: t("Profile") }} />
      <div className="flex flex-col gap-4 px-4 pb-8 pt-4">
        <BodyweightSection now={now} />
      </div>
    </main>
  );
}

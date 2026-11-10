"use client";

import { useMemo, useState } from "react";
import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { RangeTabs } from "@/components/progress/RangeTabs";
import { MuscleFocus } from "@/components/progress/MuscleFocus";
import { SymmetryRadarCard } from "@/components/progress/SymmetryRadarCard";
import { useProgressData } from "@/components/progress/useProgressData";
import { startOfWeek } from "@/lib/analytics";
import { muscleSplit } from "@/lib/calc";
import { useT } from "@/i18n";

export default function MusclesPage() {
  return (
    <HydrationGate>
      <Muscles />
    </HydrationGate>
  );
}

/** Progress > Muscles: sets per muscle (this week or the range) and the balance radar. */
function Muscles() {
  const t = useT();
  const d = useProgressData();
  const [splitRange, setSplitRange] = useState<"week" | "range">("week");
  const split = useMemo(() => {
    const start = splitRange === "week" ? startOfWeek(d.now, d.firstDay) : d.from;
    return muscleSplit(d.completed.filter((s) => s.startedAt >= start), d.byId);
  }, [d.completed, splitRange, d.now, d.firstDay, d.from, d.byId]);

  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("Muscles")} back={{ href: "/profile", label: t("Profile") }} />
      <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
        <RangeTabs
          id="split"
          label={t("Muscle split range")}
          options={[
            { value: "week" as const, label: t("This week") },
            { value: "range" as const, label: t("Last {n} weeks", { n: d.weeks }) },
          ]}
          value={splitRange}
          onChange={setSplitRange}
        />
        <MuscleFocus
          key={`${splitRange}-${d.weeks}`}
          title={splitRange === "week" ? t("Sets per muscle, this week") : t("Sets per muscle, last {n} weeks", { n: d.weeks })}
          split={split}
        />
        <SymmetryRadarCard sessions={d.sessions} byId={d.byId} now={d.now} />
      </div>
    </main>
  );
}

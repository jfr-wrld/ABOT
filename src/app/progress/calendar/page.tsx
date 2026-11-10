"use client";

import { HydrationGate } from "@/components/ui/Loading";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkoutCalendar } from "@/components/analytics/WorkoutCalendar";
import { useProgressData } from "@/components/progress/useProgressData";
import { useT } from "@/i18n";

export default function CalendarPage() {
  return (
    <HydrationGate>
      <Calendar />
    </HydrationGate>
  );
}

/** Progress > Calendar: the month grid of trained days, each opening its workouts. */
function Calendar() {
  const t = useT();
  const d = useProgressData();
  return (
    <main className="flex flex-1 flex-col">
      <PageHeader title={t("Calendar")} back={{ href: "/profile", label: t("Profile") }} />
      <div className="px-4 pb-8 pt-4">
        <WorkoutCalendar sessions={d.sessions} firstDay={d.firstDay} now={d.now} />
      </div>
    </main>
  );
}

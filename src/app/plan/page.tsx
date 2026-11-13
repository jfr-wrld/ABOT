"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanSaved, PlanSetup, todaysPlanned } from "@/components/plan/PlanSetup";
import { applyPlan, type AppliedPlan } from "@/lib/apply-plan";
import { answersOf, defaultAnswers } from "@/lib/training-plan";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useWorkoutStore } from "@/store/useWorkoutStore";
import { useT } from "@/i18n";

/** Set up or adjust the training week from Home: the same steps as at install, prefilled. */
export default function PlanPage() {
  const router = useRouter();
  const t = useT();
  const plan = useSettingsStore((s) => s.trainingPlan);
  const [saved, setSaved] = useState<AppliedPlan | null>(null);
  const back = () => (window.history.length > 1 ? router.back() : router.replace("/"));

  return (
    <main className="fixed inset-0 z-30 flex h-dvh flex-col overflow-hidden bg-bg px-5 pt-[calc(16px+env(safe-area-inset-top))]">
      {saved ? (
        <PlanSaved
          routines={Object.keys(saved.plan.routineIds).length}
          replaced={saved.replaced}
          kept={saved.kept}
          time={saved.plan.time}
          weekdays={saved.plan.weekdays}
          today={todaysPlanned(useRoutineStore.getState().routines, useReminderStore.getState().schedule)}
          onStart={(r) => {
            useWorkoutStore.getState().startFromRoutine(r);
            router.replace("/workout");
          }}
          onHome={() => router.replace("/")}
        />
      ) : (
        <PlanSetup
          key={plan ? plan.createdAt : "new"}
          initial={plan ? answersOf(plan) : defaultAnswers()}
          adjusting={!!plan}
          onSave={(a) => setSaved(applyPlan(a))}
          onExit={back}
          exitLabel={t("Cancel")}
        />
      )}
    </main>
  );
}

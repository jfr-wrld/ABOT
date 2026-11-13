import { useRoutineStore } from "@/store/useRoutineStore";
import { useReminderStore } from "@/store/useReminderStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { markOnboardingSeen } from "@/lib/onboarding";
import { currentT } from "@/i18n";
import { buildPlan, planFolder, planRoutinesToReplace, planSchedule, type PlanAnswers, type TrainingPlan } from "@/lib/training-plan";

export interface AppliedPlan {
  plan: TrainingPlan;
  /** Routines of the previous plan that were removed, and the edited ones kept. */
  replaced: number;
  kept: number;
}

/**
 * Turns answers into the lifter's week, in one step: the previous plan's untouched routines go,
 * the new ones land in My Routines under "My plan", the schedule names a routine for each
 * training day (which also sets the reminders, Home's Next up and the weekly ring), and the plan
 * is saved with the settings so Home can adjust it later. History is never touched.
 */
export function applyPlan(a: PlanAnswers): AppliedPlan {
  const settings = useSettingsStore.getState();
  const routineStore = useRoutineStore.getState();
  const { replace, kept } = planRoutinesToReplace(settings.trainingPlan, routineStore.routines);
  for (const id of replace) routineStore.remove(id);

  const built = buildPlan(a, settings.firstDayOfWeek);
  const folder = currentT()("My plan · {n} days", { n: a.weekdays.length });
  const routineIds: Record<string, string> = {};
  const routineStamps: Record<string, number> = {};
  for (const { templateId, routine } of built.routines) {
    const saved = useRoutineStore.getState().create(routine.name, folder || planFolder(a.weekdays.length));
    useRoutineStore.getState().setExercises(saved.id, routine.exercises);
    routineIds[templateId] = saved.id;
    routineStamps[saved.id] = useRoutineStore.getState().routines.find((r) => r.id === saved.id)!.updatedAt;
  }

  // The schedule is on whatever the notification answer: it also drives Next up and the ring.
  const schedule = planSchedule(a, built.assignment, routineIds, true);
  const { leadMinutes } = useReminderStore.getState().schedule;
  useReminderStore.getState().update({ ...schedule, leadMinutes });

  const plan: TrainingPlan = { ...a, days: a.weekdays.length as TrainingPlan["days"], routineIds, routineStamps, createdAt: Date.now() };
  useSettingsStore.getState().update({ trainingPlan: plan });
  markOnboardingSeen();
  return { plan, replaced: replace.length, kept: kept.length };
}

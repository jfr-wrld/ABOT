import { create } from "zustand";
import { DEFAULT_SCHEDULE, type Weekday, type WorkoutSchedule } from "@/lib/notifications/schedule";
import {
  askPermission,
  notificationPermission,
  saveSchedule,
  startReminderLoop,
  type PermissionState,
  type RoutineInfo,
} from "@/lib/notifications/reminder-service";
import { buildExerciseIndex } from "@/lib/sets";
import { MUSCLE_GROUP_LABELS } from "@/types/workout";
import { getActiveRepository } from "./persistence";
import { useRoutineStore } from "./useRoutineStore";
import { useExerciseStore } from "./useExerciseStore";

interface ReminderState {
  schedule: WorkoutSchedule;
  permission: PermissionState;
  update: (patch: Partial<WorkoutSchedule>) => void;
  setDay: (wd: Weekday, patch: Partial<WorkoutSchedule["days"][Weekday]>) => void;
  requestPermission: () => Promise<void>;
}

/** Saves to IndexedDB in the background; the panel never waits on storage. */
function persist(s: WorkoutSchedule) {
  const repo = getActiveRepository();
  if (repo) void saveSchedule(repo, s);
}

export const useReminderStore = create<ReminderState>()((set, get) => ({
  schedule: DEFAULT_SCHEDULE,
  permission: "default",
  update: (patch) => {
    const schedule = { ...get().schedule, ...patch };
    set({ schedule });
    persist(schedule);
  },
  setDay: (wd, patch) => {
    const s = get().schedule;
    const schedule = { ...s, days: { ...s.days, [wd]: { ...s.days[wd], ...patch } } };
    set({ schedule });
    persist(schedule);
  },
  requestPermission: async () => set({ permission: await askPermission() }),
}));

/** The routine a reminder names, with up to three primary muscles across its exercises. */
export function routineInfo(id: string | null): RoutineInfo | null {
  if (!id) return null;
  const r = useRoutineStore.getState().routines.find((x) => x.id === id);
  if (!r) return null;
  const { custom, catalog } = useExerciseStore.getState();
  const { byId } = buildExerciseIndex(custom, catalog);
  const muscles = [...new Set(r.exercises.flatMap((e) => byId[e.exerciseId]?.primaryMuscles ?? []))]
    .slice(0, 3)
    .map((m) => MUSCLE_GROUP_LABELS[m]);
  return { id: r.id, name: r.name, muscles };
}

/** Loads the saved schedule and starts the reminder loop; runs when this tab becomes the writer. */
export async function initReminders(): Promise<void> {
  const repo = getActiveRepository();
  if (!repo) return;
  const schedule = (await repo.kv.get("reminders")) ?? DEFAULT_SCHEDULE;
  useReminderStore.setState({ schedule, permission: notificationPermission() });
  startReminderLoop(repo, routineInfo);
}

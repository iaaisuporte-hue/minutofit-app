export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body"
  | "cardio"
  | "mobility";

export type WorkoutHistoryEntry = {
  workoutId: string;
  title: string;
  muscleGroups: MuscleGroup[];
  date: string;
};

const HISTORY_KEY = "workout_history_v1";

export function readWorkoutHistory(): WorkoutHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<
      WorkoutHistoryEntry | (Omit<WorkoutHistoryEntry, "muscleGroups"> & { muscleGroup?: MuscleGroup })
    >;
    return parsed.map((entry) => {
      const legacyEntry = entry as Omit<WorkoutHistoryEntry, "muscleGroups"> & { muscleGroup?: MuscleGroup };
      return ({
      workoutId: entry.workoutId,
      title: entry.title,
      muscleGroups:
        "muscleGroups" in entry && Array.isArray(entry.muscleGroups)
          ? entry.muscleGroups
          : legacyEntry.muscleGroup
            ? [legacyEntry.muscleGroup]
            : [],
      date: entry.date,
    });
    });
  } catch {
    return [];
  }
}

export function addWorkoutHistoryEntry(entry: WorkoutHistoryEntry) {
  const list = readWorkoutHistory();
  list.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(fromIso: string, toDate = new Date()) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(toDate);
  return Math.floor((+to - +from) / (1000 * 60 * 60 * 24));
}

export function getLastWorkoutEntry() {
  const list = readWorkoutHistory();
  return list[list.length - 1] || null;
}

export function wasMuscleGroupTrainedYesterday(muscleGroup: MuscleGroup) {
  return readWorkoutHistory().some((entry) => dayDiff(entry.date) === 1 && entry.muscleGroups.includes(muscleGroup));
}

export function wereAnyMuscleGroupsTrainedYesterday(muscleGroups: MuscleGroup[]) {
  return muscleGroups.some((group) => wasMuscleGroupTrainedYesterday(group));
}

export function getYesterdayMuscleGroups() {
  const set = new Set<MuscleGroup>();
  readWorkoutHistory().forEach((entry) => {
    if (dayDiff(entry.date) === 1) {
      entry.muscleGroups.forEach((group) => set.add(group));
    }
  });
  return Array.from(set);
}

export function getCurrentWeekdayLabel(locale = "pt-BR") {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}

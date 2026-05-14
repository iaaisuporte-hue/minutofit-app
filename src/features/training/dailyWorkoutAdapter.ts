import type { AuthUser } from "../../auth/AuthContext";
import type { DailyCondition } from "../dailyCheckin/useDailyCondition";
import type { OnboardingAnswers } from "../../pages/user/onboarding/onboardingStorage";
import { readWorkoutHistory, type WorkoutHistoryEntry } from "../../pages/user/workoutHistory";
import {
  generateDailyWorkout,
  type DailyWorkoutCondition,
  type DailyWorkoutEngineInput,
} from "./generateDailyWorkout";
import { searchExercises, type ExerciseSummary } from "../../services/exercisesApi";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(fromIso: string, toDate = new Date()) {
  const from = startOfDay(new Date(fromIso));
  const to = startOfDay(toDate);
  return Math.floor((+to - +from) / (1000 * 60 * 60 * 24));
}

function startOfWeek(date = new Date()) {
  const start = startOfDay(date);
  const weekday = start.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + diff);
  return start;
}

export function normalizeDailyCondition(condition: DailyCondition | null): DailyWorkoutCondition {
  if (!condition) return "normal";
  const { feeling, details } = condition;

  // Explicit tired → always tired
  if (feeling === "tired") return "tired";

  // Count recovery signals from check-in details
  if (details) {
    const recoverySignals = [!details.sleptWell, details.inPain, details.stressed].filter(Boolean).length;
    // 2+ signals → downgrade to tired regardless of feeling
    if (recoverySignals >= 2) return "tired";
    // 1 signal → cap at normal even when feeling energized
    if (recoverySignals >= 1 && feeling === "energized") return "normal";
  }

  if (feeling === "energized") return "high";
  return "normal";
}

export function summarizeWorkoutHistory(history: WorkoutHistoryEntry[]) {
  const lastEntry = history[history.length - 1] ?? null;
  const daysWithoutTraining = lastEntry ? Math.max(0, dayDiff(lastEntry.date)) : 7;
  const currentWeekStart = startOfWeek();
  const workoutsThisWeek = history.filter((entry) => new Date(entry.date) >= currentWeekStart).length;

  return {
    daysWithoutTraining,
    workoutsThisWeek,
  };
}

export function buildDailyWorkoutInput(params: {
  condition: DailyCondition | null;
  user?: AuthUser;
  onboarding?: OnboardingAnswers | null;
  history?: WorkoutHistoryEntry[];
}): DailyWorkoutEngineInput {
  const history = params.history ?? readWorkoutHistory();
  const historySummary = summarizeWorkoutHistory(history);

  return {
    dailyCondition: normalizeDailyCondition(params.condition),
    userProfile: {
      age: undefined,
      weight: params.user?.weightKg,
      height: params.user?.heightCm,
    },
    userHistory: historySummary,
    preferredTrainingPlace: params.onboarding?.trainingPlace,
  };
}

export function buildDailyWorkoutRecommendation(params: {
  condition: DailyCondition | null;
  user?: AuthUser;
  onboarding?: OnboardingAnswers | null;
  history?: WorkoutHistoryEntry[];
}) {
  return generateDailyWorkout(buildDailyWorkoutInput(params));
}

export function getWorkoutRoute(type: "home" | "gym") {
  return type === "home" ? "/app/user/treinos/em-casa" : "/app/user/treinos";
}

// ---------------------------------------------------------------------------
// Resolução assíncrona de exercise_id por nome (para enriquecer o motor diário)
// ---------------------------------------------------------------------------

let _exerciseCacheTimestamp = 0;
let _exerciseCache: ExerciseSummary[] = [];
const EXERCISE_CACHE_TTL = 5 * 60 * 1000;

async function getExerciseCacheLocal(): Promise<ExerciseSummary[]> {
  if (_exerciseCache.length && Date.now() - _exerciseCacheTimestamp < EXERCISE_CACHE_TTL) {
    return _exerciseCache;
  }
  try {
    const exercises = await searchExercises({ limit: 200 });
    _exerciseCache = exercises;
    _exerciseCacheTimestamp = Date.now();
    return exercises;
  } catch {
    return _exerciseCache; // fallback to stale cache on error
  }
}

/**
 * Enriquece uma lista de nomes de exercícios com exercise_id da biblioteca.
 * Usado por SuggestedTrainingPage e TodayPage para vincular exercícios à biblioteca.
 * Retorna um map: nome normalizado → ExerciseSummary (ou null se não encontrado).
 */
export async function resolveExerciseNamesBatch(
  names: string[]
): Promise<Map<string, ExerciseSummary>> {
  const result = new Map<string, ExerciseSummary>();
  if (!names.length) return result;

  try {
    const all = await getExerciseCacheLocal();

    for (const name of names) {
      const normalized = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const exact = all.find((e) => e.normalizedName === normalized);
      if (exact) {
        result.set(name, exact);
        continue;
      }
      const partial = all.find(
        (e) => e.normalizedName.includes(normalized) || normalized.includes(e.normalizedName.split(" ")[0])
      );
      if (partial) result.set(name, partial);
    }
  } catch {
    // silent — caller handles empty map
  }

  return result;
}

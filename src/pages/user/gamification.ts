import { readWorkoutHistory } from "./workoutHistory";
import { dayKey } from "../../lib/appDay";

export type DailyCheckin = {
  dateKey: string;
  source: "workout" | "activity";
  xp: number;
};

export type DailyMission = {
  id: "move_20" | "complete_workout" | "cardio_day";
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardXp: number;
  completed: boolean;
};

const XP_KEY = "gamification_xp_v1";
const DAILY_KEY = "gamification_daily_checkins_v1";
const ACTIVITY_KEY = "activities";
const STREAK_KEY = "workout_streak_v1";
const STREAK_LAST_KEY = "workout_streak_lastday_v1";

// Dia do aluno, não dia UTC — ver lib/appDay.ts. Precisa casar com o
// `date_key` que o backend grava, senão streak local e do servidor divergem.
function todayKey(date = new Date()) {
  return dayKey(date);
}

function sameWeek(reference: Date, isoDate: string) {
  const target = new Date(isoDate);
  const start = new Date(reference);
  const day = start.getDay();
  const diffToMonday = (day + 6) % 7;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  return target >= start && target < end;
}

export function getXp() {
  return Number(localStorage.getItem(XP_KEY) || "0");
}

export function getStreak() {
  return Number(localStorage.getItem(STREAK_KEY) || "0");
}

export function updateDailyStreak(referenceDate = new Date()) {
  const lastDayRaw = localStorage.getItem(STREAK_LAST_KEY);
  let streak = getStreak();

  if (!lastDayRaw) {
    streak = 1;
  } else {
    const last = new Date(lastDayRaw);
    const lastDate = new Date(last.toDateString());
    const nowDate = new Date(referenceDate.toDateString());
    const diffDays = Math.floor((+nowDate - +lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return streak;
    }

    if (diffDays === 1) {
      streak += 1;
    } else {
      streak = 1;
    }
  }

  localStorage.setItem(STREAK_KEY, String(streak));
  localStorage.setItem(STREAK_LAST_KEY, referenceDate.toISOString());
  return streak;
}

export function addXp(amount: number) {
  const next = getXp() + amount;
  localStorage.setItem(XP_KEY, String(next));
  return next;
}

export function getLevel() {
  const xp = getXp();
  return Math.max(1, Math.floor(xp / 100) + 1);
}

export function readDailyCheckins(): DailyCheckin[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DailyCheckin[];
  } catch {
    return [];
  }
}

export function hasTodayCheckin() {
  const key = todayKey();
  return readDailyCheckins().some((item) => item.dateKey === key);
}

export function registerDailyCheckin(source: DailyCheckin["source"], xp: number) {
  const key = todayKey();
  const list = readDailyCheckins();
  const existing = list.find((item) => item.dateKey === key);

  if (existing) {
    return { alreadyCheckedIn: true, xp: getXp(), streak: getStreak() };
  }

  const next = [...list, { dateKey: key, source, xp }];
  localStorage.setItem(DAILY_KEY, JSON.stringify(next));
  const totalXp = addXp(xp);
  const streak = updateDailyStreak();
  return { alreadyCheckedIn: false, xp: totalXp, streak };
}

function readActivities() {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Array<{ duration: number; type: "walk" | "run" | "cycling"; startTime: string }>;
  } catch {
    return [];
  }
}

export function getWeeklyActivityMinutes() {
  const now = new Date();
  return readActivities()
    .filter((activity) => sameWeek(now, new Date(activity.startTime).toISOString()))
    .reduce((sum, activity) => sum + Math.round(activity.duration / 60), 0);
}

export function getWeeklyWorkoutCount() {
  const now = new Date();
  return readWorkoutHistory().filter((item) => sameWeek(now, item.date)).length;
}

export function getWeekHeatmap() {
  const now = new Date();
  const labels = ["S", "T", "Q", "Q", "S", "S", "D"];
  const checkins = readDailyCheckins();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const dateKey = todayKey(date);
    return {
      label: labels[index],
      dateKey,
      completed: checkins.some((item) => item.dateKey === dateKey),
      isToday: dateKey === todayKey(),
    };
  });
}

export function getDailyMission(): DailyMission {
  const activityMinutes = getWeeklyActivityMinutes();
  const workouts = getWeeklyWorkoutCount();
  const activities = readActivities();
  const lastActivity = activities[activities.length - 1];

  if (lastActivity?.type === "run" || lastActivity?.type === "cycling") {
    const progress = Math.min(1, lastActivity.duration >= 20 * 60 ? 1 : 0);
    return {
      id: "cardio_day",
      title: "Missão cardio",
      description: "Complete uma corrida ou pedalada hoje.",
      target: 1,
      progress,
      rewardXp: 30,
      completed: progress >= 1,
    };
  }

  if (workouts < 3) {
    return {
      id: "complete_workout",
      title: "Missão de consistência",
      description: "Feche mais um treino nesta semana.",
      target: 3,
      progress: workouts,
      rewardXp: 25,
      completed: workouts >= 3,
    };
  }

  return {
    id: "move_20",
    title: "Missão movimento",
    description: "Acumule pelo menos 20 minutos de atividade nesta semana.",
    target: 20,
    progress: activityMinutes,
    rewardXp: 20,
    completed: activityMinutes >= 20,
  };
}

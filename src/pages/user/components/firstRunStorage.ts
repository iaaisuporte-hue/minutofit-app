// Mesmo padrão de onboardingStorage.ts — localStorage com chave por userId.
// profileDone é derivado de isOnboardingDone (não armazenado separadamente).
import { isOnboardingDone } from "../onboarding/onboardingStorage";

const KEY = "first_run_v1";

function normalizeUserId(userId: string) {
  return (userId ?? "").trim().toLowerCase();
}

function k(userId: string) {
  return `${KEY}:${normalizeUserId(userId)}`;
}

export type FirstRunState = {
  checkinDone: boolean;
  profileDone: boolean;
  workoutDone: boolean;
};

type StoredState = {
  checkinDone: boolean;
  workoutDone: boolean;
};

function load(userId: string): StoredState {
  try {
    const raw = localStorage.getItem(k(userId));
    if (!raw) return { checkinDone: false, workoutDone: false };
    return JSON.parse(raw) as StoredState;
  } catch {
    return { checkinDone: false, workoutDone: false };
  }
}

function save(userId: string, state: StoredState) {
  localStorage.setItem(k(userId), JSON.stringify(state));
}

export function getFirstRunState(userId: string): FirstRunState {
  const s = load(userId);
  return {
    checkinDone: s.checkinDone,
    profileDone: isOnboardingDone(userId),
    workoutDone: s.workoutDone,
  };
}

export function markCheckinDone(userId: string) {
  const s = load(userId);
  save(userId, { ...s, checkinDone: true });
}

export function markWorkoutDone(userId: string) {
  const s = load(userId);
  save(userId, { ...s, workoutDone: true });
}

export function isFirstRunComplete(userId: string): boolean {
  if (!userId) return true;
  const s = load(userId);
  return s.checkinDone && isOnboardingDone(userId) && s.workoutDone;
}

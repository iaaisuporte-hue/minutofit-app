// Rascunho da sessão de treino em andamento (estados "pausado"/"retomado"/
// "abandonado"). Fica em localStorage para sobreviver a sair e voltar da tela
// sem depender do backend. A persistência real (POST /training/sessions) só
// acontece na finalização. Uma chave por plano+dia.

export interface DraftSetEntry {
  setIndex: number;
  plannedReps: string;
  plannedRestS: number | null;
  loadKg: string;
  reps: string;
  done: boolean;
  restDoneS: number | null;
  completedAt: number | null;
}

export interface DraftExercise {
  exerciseId: string | null;
  name: string;
  biSetGroupId: string | null;
  sets: DraftSetEntry[];
}

export interface SessionDraft {
  version: 1;
  planId: number;
  dayIndex: number;
  startedAt: number;
  currentIndex: number;
  exercises: DraftExercise[];
  /** Instante (ms) em que um descanso ativo termina — recalculado ao retomar. */
  restEndsAt: number | null;
  restForKey: string | null;
}

const PREFIX = "s2core:workout:draft:";

export function draftKey(planId: number, dayIndex: number): string {
  return `${PREFIX}${planId}:${dayIndex}`;
}

export function loadDraft(planId: number, dayIndex: number): SessionDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(planId, dayIndex));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(draft: SessionDraft): void {
  try {
    localStorage.setItem(draftKey(draft.planId, draft.dayIndex), JSON.stringify(draft));
  } catch {
    /* quota/privado: rascunho é best-effort */
  }
}

export function clearDraft(planId: number, dayIndex: number): void {
  try {
    localStorage.removeItem(draftKey(planId, dayIndex));
  } catch {
    /* silencioso */
  }
}

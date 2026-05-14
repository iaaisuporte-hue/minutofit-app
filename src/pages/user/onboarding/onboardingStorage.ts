// src/pages/user/onboarding/onboardingStorage.ts
import { authFetch } from "../../../services/apiClient";
import { API_URL } from "../../../services/apiBase";

export type UserPlan = "basic" | "silver" | "gold" | "black";

export type OnboardingAnswers = {
  trainingPlace: "home" | "gym" | "both";
  timePerDay: "10-15" | "20-30" | "30-45" | "60+";

  injuries: Array<"none" | "joelho" | "ombro" | "lombar" | "tornozelo" | "outra">;
  surgeryRecent: "no" | "yes";
  frequentPain: "no" | "sometimes" | "often";

  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  bestTime: "morning" | "afternoon" | "night" | "variable";

  intensityPref: "intense" | "progressive" | "any";
  equipmentPref: "weights" | "no_weights" | "both";
  wantsCloseFollow: "yes" | "no";
};

export type Recommendation = {
  title: string;
  subtitle: string;
  route: string;
  tags: string[];
  safetyNotes: string[];
};

const KEY_DONE = "onboarding_v1_done";
const KEY_ANSWERS = "onboarding_v1_answers";
const KEY_RECO = "onboarding_v1_recommendation";

// opcional: no futuro você pode usar para “lembrar depois” com TTL
const KEY_BANNER_DISMISS_UNTIL = "onboarding_v1_banner_dismiss_until";

function normalizeUserId(userId: string) {
  return (userId ?? "").trim().toLowerCase();
}

function k(base: string, userId: string) {
  const id = normalizeUserId(userId);
  return `${base}:${id}`;
}

export function isOnboardingDone(userId: string) {
  const id = normalizeUserId(userId);
  if (!id) return false;
  return localStorage.getItem(k(KEY_DONE, id)) === "1";
}

export function setOnboardingDone(userId: string) {
  const id = normalizeUserId(userId);
  if (!id) return;
  localStorage.setItem(k(KEY_DONE, id), "1");
}

export function clearOnboarding(userId: string) {
  const id = normalizeUserId(userId);
  if (!id) return;
  localStorage.removeItem(k(KEY_DONE, id));
  localStorage.removeItem(k(KEY_ANSWERS, id));
  localStorage.removeItem(k(KEY_RECO, id));
  localStorage.removeItem(k(KEY_BANNER_DISMISS_UNTIL, id));
}

export function saveAnswers(a: OnboardingAnswers, userId: string) {
  const id = normalizeUserId(userId);
  if (!id) return;
  localStorage.setItem(k(KEY_ANSWERS, id), JSON.stringify(a));
  // Persiste na API de forma assíncrona — falha silenciosa (localStorage é a fonte de verdade local)
  syncOnboardingToApi(a).catch(() => {});
}

/** Envia as respostas de onboarding para a API para persistência cross-device. */
async function syncOnboardingToApi(answers: OnboardingAnswers): Promise<void> {
  try {
    await authFetch(`${API_URL}/auth/onboarding`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
  } catch {
    // Sem rede ou token expirado — ignora; dado está salvo em localStorage
  }
}

/**
 * Hidrata o localStorage com os dados de onboarding vindos do servidor.
 * Chamar após login quando o usuário não tem respostas locais (ex: novo device).
 */
export function hydrateOnboardingFromUser(
  userId: string,
  onboardingAnswers: OnboardingAnswers | null | undefined
): void {
  if (!onboardingAnswers) return;
  const id = normalizeUserId(userId);
  if (!id) return;
  if (localStorage.getItem(k(KEY_ANSWERS, id))) return; // já tem dados locais — não sobrescreve
  localStorage.setItem(k(KEY_ANSWERS, id), JSON.stringify(onboardingAnswers));
}

export function loadAnswers(userId: string): OnboardingAnswers | null {
  const id = normalizeUserId(userId);
  if (!id) return null;
  try {
    const raw = localStorage.getItem(k(KEY_ANSWERS, id));
    return raw ? (JSON.parse(raw) as OnboardingAnswers) : null;
  } catch {
    return null;
  }
}

export function saveRecommendation(r: Recommendation, userId: string) {
  const id = normalizeUserId(userId);
  if (!id) return;
  localStorage.setItem(k(KEY_RECO, id), JSON.stringify(r));
}

export function loadRecommendation(userId: string): Recommendation | null {
  const id = normalizeUserId(userId);
  if (!id) return null;
  try {
    const raw = localStorage.getItem(k(KEY_RECO, id));
    return raw ? (JSON.parse(raw) as Recommendation) : null;
  } catch {
    return null;
  }
}

/** ✅ Recomendação simples (v1). Depois você pluga IA/back */
export function buildRecommendation(a: OnboardingAnswers): Recommendation {
  const safetyNotes: string[] = [];

  const hasInjury = a.injuries.length > 0 && !(a.injuries.length === 1 && a.injuries[0] === "none");
  const highRisk = a.surgeryRecent === "yes" || a.frequentPain === "often";

  if (highRisk) {
    safetyNotes.push("Recomendação conservadora por segurança.");
    if (a.surgeryRecent === "yes") safetyNotes.push("Cirurgia recente: comece com baixo impacto e, se possível, aval médico.");
    if (a.frequentPain === "often") safetyNotes.push("Dor frequente: evite intensidades altas e ajuste movimentos.");
  }

  if (hasInjury) {
    const map: Record<string, string> = {
      joelho: "Evite agachamento profundo/pulos se houver dor no joelho.",
      ombro: "Evite pressão acima da cabeça se houver dor no ombro.",
      lombar: "Priorize core e técnica, evite cargas altas no início.",
      tornozelo: "Reduza impactos e movimentos instáveis no início.",
      outra: "Respeite limitações e ajuste exercícios.",
    };

    a.injuries.forEach((i) => {
      if (i !== "none") safetyNotes.push(map[i] ?? "Respeite suas limitações e ajuste exercícios.");
    });
  }

  let route = "/app/user/treinos/em-casa";
  let title = "Plano recomendado: Treino em casa";
  let subtitle = "Comece leve, com consistência, e evolua semana a semana.";
  const tags: string[] = [];

  if (a.timePerDay === "10-15") tags.push("10–15 min");
  if (a.timePerDay === "20-30") tags.push("20–30 min");
  if (a.timePerDay === "30-45") tags.push("30–45 min");
  if (a.timePerDay === "60+") tags.push("60+ min");

  tags.push(`${a.daysPerWeek}x/sem`);

  if (a.intensityPref === "intense") tags.push("Intenso");
  if (a.intensityPref === "progressive") tags.push("Progressivo");

  if (a.trainingPlace === "gym" && !highRisk) {
    title = "Plano recomendado: Academia (base)";
    subtitle = "Treinos simples para construir técnica + consistência.";
    route = "/app/user/treinos";
    tags.push("Academia");
  }

  if (highRisk) {
    title = "Plano recomendado: Começo seguro";
    subtitle = "Treinos leves, sem impacto, para ganhar ritmo com segurança.";
    route = "/app/user/treinos/em-casa";
    tags.push("Seguro");
  }

  return { title, subtitle, route, tags, safetyNotes };
}

// src/pages/user/onboarding/onboardingStorage.ts

export type UserPlan = "basic" | "silver" | "gold" | "black";

export type OnboardingAnswers = {
  ageRange: "13-17" | "18-25" | "26-35" | "36-45" | "46-55" | "56+";
  gender: "male" | "female" | "na";

  heightCm?: number;
  weightKg?: number;

  goal: "emagrecimento" | "hipertrofia" | "condicionamento" | "resistencia" | "mobilidade" | "saude";

  experience: "never" | "stopped" | "1-2" | "3-4" | "5+";
  trainingPlace: "home" | "gym" | "both";
  timePerDay: "10-15" | "20-30" | "30-45" | "60+";

  injuries: Array<"none" | "joelho" | "ombro" | "lombar" | "tornozelo" | "outra">;
  surgeryRecent: "no" | "yes";
  conditions: Array<"none" | "pressao" | "cardiaco" | "diabetes" | "respiratorio">;
  frequentPain: "no" | "sometimes" | "often";
  clearedByDoctor: "yes" | "no" | "unsure";

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
  const hasCondition = a.conditions.length > 0 && !(a.conditions.length === 1 && a.conditions[0] === "none");
  const highRisk =
    a.surgeryRecent === "yes" ||
    a.clearedByDoctor !== "yes" ||
    a.frequentPain === "often" ||
    hasCondition;

  if (highRisk) {
    safetyNotes.push("Recomendação conservadora por segurança.");
    if (a.surgeryRecent === "yes") safetyNotes.push("Cirurgia recente: comece com baixo impacto e, se possível, aval médico.");
    if (a.clearedByDoctor !== "yes") safetyNotes.push("Se tiver dúvidas, confirme liberação médica.");
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

  const goalLabel: Record<OnboardingAnswers["goal"], string> = {
    emagrecimento: "Emagrecimento",
    hipertrofia: "Hipertrofia",
    condicionamento: "Condicionamento",
    resistencia: "Resistência",
    mobilidade: "Mobilidade",
    saude: "Saúde",
  };
  tags.push(goalLabel[a.goal]);

  if (a.intensityPref === "intense") tags.push("Intenso");
  if (a.intensityPref === "progressive") tags.push("Progressivo");

  if (a.trainingPlace === "gym" && !highRisk) {
    title = "Plano recomendado: Academia (base)";
    subtitle = "Treinos simples para construir técnica + consistência.";
    route = "/app/user/treinos";
    tags.push("Academia");
  }

  if (a.goal === "mobilidade") {
    title = "Plano recomendado: Mobilidade + Core";
    subtitle = "Foco em qualidade de movimento e base forte.";
    route = "/app/user/treinos/em-casa";
    tags.push("Baixo impacto");
  }

  if (highRisk) {
    title = "Plano recomendado: Começo seguro";
    subtitle = "Treinos leves, sem impacto, para ganhar ritmo com segurança.";
    route = "/app/user/treinos/em-casa";
    tags.push("Seguro");
  }

  return { title, subtitle, route, tags, safetyNotes };
}
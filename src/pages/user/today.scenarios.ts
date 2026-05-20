import type { ProfessionalContext } from "../../features/professionalVoice";
import type { UserWorkoutPlan } from "../../services/userWorkoutPlansApi";

export type ScenarioKey =
  | "autonomo"
  | "personal_com_ficha"
  | "personal_sem_ficha"
  | "personal_com_academy"
  | "so_academia"
  | "app_completo";

export interface TodayScenarioFixture {
  professionalContext: ProfessionalContext;
  activePlan: UserWorkoutPlan | null;
  products: Array<"app" | "personal" | "nutri" | "academia">;
}

const personalAna = {
  id: 4201,
  name: "Ana Vieira",
  photo: null,
  lastObservation: null,
};

const personalAnaWithNote = {
  ...personalAna,
  lastObservation: {
    text: "Observei que seu sono caiu ontem — diminuí a carga e troquei o foco para mobilidade.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
};

const samplePlan: UserWorkoutPlan = {
  id: 9101,
  personal_id: personalAna.id,
  student_id: 1,
  title: "Hipertrofia metabólica",
  week_preset: "4",
  selected_group: "upper",
  payload_json: [],
  days: [
    {
      index: 0,
      name: "Segunda · Empurrar",
      focus: "Peito e ombros · força base",
      items: [
        { exerciseId: "supino-reto", name: "Supino reto", sets: "4", reps: "6-8", rest: "90s" },
        { exerciseId: "desenvolvimento", name: "Desenvolvimento halteres", sets: "3", reps: "8-10", rest: "75s" },
        { exerciseId: "crucifixo", name: "Crucifixo inclinado", sets: "3", reps: "10-12", rest: "60s" },
        { exerciseId: "elevacao-lateral", name: "Elevação lateral", sets: "3", reps: "12-15", rest: "45s" },
        { exerciseId: "triceps-corda", name: "Tríceps corda", sets: "3", reps: "10-12", rest: "60s" },
      ],
    },
  ],
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
};

export const TODAY_SCENARIOS: Record<ScenarioKey, TodayScenarioFixture> = {
  autonomo: {
    professionalContext: { personal: null, nutri: null },
    activePlan: null,
    products: ["app"],
  },
  personal_com_ficha: {
    professionalContext: { personal: personalAnaWithNote, nutri: null },
    activePlan: samplePlan,
    products: ["app", "personal"],
  },
  personal_sem_ficha: {
    professionalContext: { personal: personalAna, nutri: null },
    activePlan: null,
    products: ["app", "personal"],
  },
  personal_com_academy: {
    professionalContext: { personal: personalAnaWithNote, nutri: null },
    activePlan: samplePlan,
    products: ["app", "personal", "academia"],
  },
  so_academia: {
    professionalContext: { personal: null, nutri: null },
    activePlan: null,
    products: ["academia"],
  },
  app_completo: {
    professionalContext: { personal: personalAnaWithNote, nutri: null },
    activePlan: samplePlan,
    products: ["app", "personal", "nutri", "academia"],
  },
};

export function isValidScenario(key: string | null): key is ScenarioKey {
  return key !== null && key in TODAY_SCENARIOS;
}

export type PersonalStudentPlan = "basic" | "silver" | "gold" | "black";
export type PersonalStudentGender = "M" | "F";

export type PersonalStudentRecord = {
  id: string;
  name: string;
  plan: PersonalStudentPlan;
  gender: PersonalStudentGender;
  chatParticipantId: string;
  planExpiresAt: string;
  lastWorkoutUpdateAt?: string;
  workoutsDoneInCurrentPlan?: number;
  workoutsPlannedInCurrentPlan?: number;
};

export const PERSONAL_STUDENTS: PersonalStudentRecord[] = [
  { id: "1", name: "João Silva", plan: "basic", gender: "M", chatParticipantId: "joao.silva@treinai.com", planExpiresAt: "2026-03-20" },
  { id: "2", name: "Maria Souza", plan: "basic", gender: "F", chatParticipantId: "maria.souza@treinai.com", planExpiresAt: "2026-02-10" },
  { id: "3", name: "Pedro Lima", plan: "basic", gender: "M", chatParticipantId: "pedro.lima@treinai.com", planExpiresAt: "2026-03-05" },
  { id: "4", name: "Ana Costa", plan: "basic", gender: "F", chatParticipantId: "ana.costa@treinai.com", planExpiresAt: "2026-02-26" },
  { id: "5", name: "Lucas Rocha", plan: "basic", gender: "M", chatParticipantId: "lucas.rocha@treinai.com", planExpiresAt: "2026-04-01" },
  { id: "6", name: "Bruno Santos", plan: "silver", gender: "M", chatParticipantId: "bruno.santos@treinai.com", planExpiresAt: "2026-03-22" },
  { id: "7", name: "Carla Nunes", plan: "silver", gender: "F", chatParticipantId: "carla.nunes@treinai.com", planExpiresAt: "2026-03-01" },
  { id: "8", name: "Diego Alves", plan: "silver", gender: "M", chatParticipantId: "diego.alves@treinai.com", planExpiresAt: "2026-02-24" },
  { id: "9", name: "Fernanda Melo", plan: "silver", gender: "F", chatParticipantId: "fernanda.melo@treinai.com", planExpiresAt: "2026-04-10" },
  { id: "10", name: "Rafaela Dias", plan: "silver", gender: "F", chatParticipantId: "rafaela.dias@treinai.com", planExpiresAt: "2026-02-18" },
  { id: "11", name: "Gustavo Araújo", plan: "gold", gender: "M", chatParticipantId: "gustavo.araujo@treinai.com", planExpiresAt: "2026-03-30" },
  { id: "12", name: "Helena Ribeiro", plan: "gold", gender: "F", chatParticipantId: "helena.ribeiro@treinai.com", planExpiresAt: "2026-03-12" },
  { id: "13", name: "Igor Fernandes", plan: "gold", gender: "M", chatParticipantId: "igor.fernandes@treinai.com", planExpiresAt: "2026-02-28" },
  { id: "14", name: "Juliana Martins", plan: "gold", gender: "F", chatParticipantId: "juliana.martins@treinai.com", planExpiresAt: "2026-04-05" },
  { id: "15", name: "Marcos Oliveira", plan: "gold", gender: "M", chatParticipantId: "marcos.oliveira@treinai.com", planExpiresAt: "2026-03-02" },
  {
    id: "16",
    name: "Natália Freitas",
    plan: "black",
    gender: "F",
    chatParticipantId: "natalia.freitas@treinai.com",
    planExpiresAt: "2026-03-25",
    lastWorkoutUpdateAt: "2026-02-10",
    workoutsDoneInCurrentPlan: 8,
    workoutsPlannedInCurrentPlan: 16,
  },
  {
    id: "17",
    name: "Otávio Barbosa",
    plan: "black",
    gender: "M",
    chatParticipantId: "otavio.barbosa@treinai.com",
    planExpiresAt: "2026-03-03",
    lastWorkoutUpdateAt: "2026-02-20",
    workoutsDoneInCurrentPlan: 5,
    workoutsPlannedInCurrentPlan: 12,
  },
  {
    id: "18",
    name: "Patrícia Lima",
    plan: "black",
    gender: "F",
    chatParticipantId: "patricia.lima@treinai.com",
    planExpiresAt: "2026-02-23",
    lastWorkoutUpdateAt: "2026-01-20",
    workoutsDoneInCurrentPlan: 10,
    workoutsPlannedInCurrentPlan: 10,
  },
  {
    id: "19",
    name: "Renato Sousa",
    plan: "black",
    gender: "M",
    chatParticipantId: "renato.sousa@treinai.com",
    planExpiresAt: "2026-04-15",
    lastWorkoutUpdateAt: "2026-02-01",
    workoutsDoneInCurrentPlan: 14,
    workoutsPlannedInCurrentPlan: 20,
  },
  {
    id: "20",
    name: "Sabrina Cardoso",
    plan: "black",
    gender: "F",
    chatParticipantId: "sabrina.cardoso@treinai.com",
    planExpiresAt: "2026-03-08",
    lastWorkoutUpdateAt: "2026-02-24",
    workoutsDoneInCurrentPlan: 1,
    workoutsPlannedInCurrentPlan: 10,
  },
];

export function getPersonalStudentById(studentId?: string | null) {
  if (!studentId) return undefined;
  return PERSONAL_STUDENTS.find((student) => student.id === studentId);
}

export function getPersonalStudentByName(studentName?: string | null) {
  if (!studentName) return undefined;
  const normalizedName = studentName.trim().toLowerCase();
  return PERSONAL_STUDENTS.find((student) => student.name.trim().toLowerCase() === normalizedName);
}

export function resolvePersonalStudentReference(input: { id?: string | null; name?: string | null }) {
  return getPersonalStudentByName(input.name) ?? getPersonalStudentById(input.id);
}

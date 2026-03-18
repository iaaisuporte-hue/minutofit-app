export type AdminStudent = {
  id: string;
  name: string;
  email: string;
  plan: "basic" | "silver" | "gold" | "black";
  status: "ativo" | "em risco" | "pendente";
  goal: string;
  personal?: string;
  onboarding: "completo" | "pendente";
  lastCheckin: string;
  weeklyConsistency: string;
};

export type AdminProfessional = {
  id: string;
  name: string;
  email: string;
  role: "personal" | "nutri";
  status: "ativo" | "pausado";
  activeClients: number;
  specialty: string;
};

export type AdminPayment = {
  id: string;
  studentName: string;
  plan: "basic" | "silver" | "gold" | "black";
  amount: string;
  status: "pago" | "pendente" | "falhou" | "reembolsado";
  dueDate: string;
  method: string;
};

export const adminStudents: AdminStudent[] = [
  {
    id: "1",
    name: "João Silva",
    email: "joao.silva@minutofit.app",
    plan: "basic",
    status: "ativo",
    goal: "Emagrecimento",
    personal: "Camila Rocha",
    onboarding: "completo",
    lastCheckin: "Hoje",
    weeklyConsistency: "5/7",
  },
  {
    id: "2",
    name: "Maria Souza",
    email: "maria.souza@minutofit.app",
    plan: "black",
    status: "ativo",
    goal: "Hipertrofia",
    personal: "Pedro Alves",
    onboarding: "completo",
    lastCheckin: "Ontem",
    weeklyConsistency: "6/7",
  },
  {
    id: "3",
    name: "Fernanda Costa",
    email: "fernanda.costa@minutofit.app",
    plan: "gold",
    status: "em risco",
    goal: "Condicionamento",
    personal: "Camila Rocha",
    onboarding: "pendente",
    lastCheckin: "Há 4 dias",
    weeklyConsistency: "1/7",
  },
  {
    id: "4",
    name: "Lucas Martins",
    email: "lucas.martins@minutofit.app",
    plan: "silver",
    status: "pendente",
    goal: "Saúde metabólica",
    onboarding: "pendente",
    lastCheckin: "Nunca",
    weeklyConsistency: "0/7",
  },
];

export const adminPersonals: AdminProfessional[] = [
  {
    id: "p1",
    name: "Camila Rocha",
    email: "camila.rocha@minutofit.app",
    role: "personal",
    status: "ativo",
    activeClients: 28,
    specialty: "Hipertrofia e condicionamento",
  },
  {
    id: "p2",
    name: "Pedro Alves",
    email: "pedro.alves@minutofit.app",
    role: "personal",
    status: "ativo",
    activeClients: 16,
    specialty: "Treino funcional e corrida",
  },
];

export const adminNutris: AdminProfessional[] = [
  {
    id: "n1",
    name: "Bruna Nunes",
    email: "bruna.nunes@minutofit.app",
    role: "nutri",
    status: "ativo",
    activeClients: 21,
    specialty: "Nutrição esportiva",
  },
  {
    id: "n2",
    name: "Paula Lima",
    email: "paula.lima@minutofit.app",
    role: "nutri",
    status: "pausado",
    activeClients: 9,
    specialty: "Saúde metabólica e clínica",
  },
];

export const adminPayments: AdminPayment[] = [
  {
    id: "pay_001",
    studentName: "Maria Souza",
    plan: "black",
    amount: "R$ 189,90",
    status: "pago",
    dueDate: "18 mar",
    method: "Cartão",
  },
  {
    id: "pay_002",
    studentName: "Fernanda Costa",
    plan: "gold",
    amount: "R$ 129,90",
    status: "falhou",
    dueDate: "17 mar",
    method: "Cartão",
  },
  {
    id: "pay_003",
    studentName: "Lucas Martins",
    plan: "silver",
    amount: "R$ 89,90",
    status: "pendente",
    dueDate: "19 mar",
    method: "Pix",
  },
  {
    id: "pay_004",
    studentName: "João Silva",
    plan: "basic",
    amount: "R$ 49,90",
    status: "pago",
    dueDate: "16 mar",
    method: "Pix",
  },
];

export function getAdminStudentById(id?: string) {
  return adminStudents.find((student) => student.id === id);
}

export function getAdminPersonalById(id?: string) {
  return adminPersonals.find((professional) => professional.id === id);
}

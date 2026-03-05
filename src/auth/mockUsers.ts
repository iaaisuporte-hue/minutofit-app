export type MockUser = {
  id: string;
  email: string;
  password: string;
  role: "user" | "personal";
  plan: "basic" | "silver" | "gold" | "black";
  name: string;
};

export const MOCK_USERS: MockUser[] = [
  { id: "u_basic_1", email: "basic1@treinai.app", password: "12345678", role: "user", plan: "basic", name: "Teste Basic 1" },
  { id: "u_basic_2", email: "basic2@treinai.app", password: "12345678", role: "user", plan: "basic", name: "Teste Basic 2" },
  { id: "u_basic_3", email: "basic3@treinai.app", password: "12345678", role: "user", plan: "basic", name: "Teste Basic 3" },
  { id: "u_basic_4", email: "basic4@treinai.app", password: "12345678", role: "user", plan: "basic", name: "Teste Basic 4" },
  { id: "u_basic_5", email: "basic5@treinai.app", password: "12345678", role: "user", plan: "basic", name: "Teste Basic 5" },
];

const KEY = "treinai_mock_users_v1";

export function seedMockUsersOnce() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return; // já existe
    localStorage.setItem(KEY, JSON.stringify(MOCK_USERS));
  } catch {
    // ignore
  }
}

export function getMockUsers(): MockUser[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MockUser[];
  } catch {
    return [];
  }
}
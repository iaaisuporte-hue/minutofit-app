/**
 * Abas do cockpit do aluno — contrato (Spec 033, Onda P5).
 *
 * Até a P5 a aba ativa era estado local: recarregar a página devolvia o personal
 * para "Hoje", e não havia como mandar a ninguém o link de uma aba. Estes testes
 * travam o comportamento novo — a aba vive na URL — e a lista de abas, que antes
 * era JSX escrito à mão em dois lugares do mesmo arquivo.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../../services/personalDashboardApi", () => ({
  fetchPersonalStudentSnapshot: vi.fn().mockResolvedValue({
    name: "Aluna Teste",
    today: {},
    week: { days: [] },
    history: {},
    technical: { highlights: [], recentNotes: [] },
  }),
}));
vi.mock("../../services/personalPerformanceApi", () => ({
  fetchStudentPerformance: vi.fn().mockReturnValue(new Promise(() => {})),
  requestPerformanceInsight: vi.fn(),
  PerformanceAccessError: class extends Error {},
}));
vi.mock("../../features/performance/performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));

import StudentProfileModal, { COCKPIT_TABS } from "./StudentProfileModal";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/app/personal/students/:studentId"
          element={
            <StudentProfileModal
              studentId="42"
              studentName="Aluna Teste"
              onClose={() => {}}
              variant="inline"
            />
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("lista de abas", () => {
  it("Performance entra sem derrubar as seis que já existiam", () => {
    expect(COCKPIT_TABS.map((t) => t.id)).toEqual([
      "today",
      "technical",
      "relationship",
      "week",
      "evolucao",
      "performance",
      "ia_summary",
    ]);
  });

  it("cada aba é um `tab` acessível", async () => {
    renderAt("/app/personal/students/42");
    await waitFor(() => expect(screen.getAllByRole("tab").length).toBe(COCKPIT_TABS.length));
  });
});

describe("a aba vive na URL", () => {
  it("deep link abre direto na Performance", async () => {
    renderAt("/app/personal/students/42?ctab=performance");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Performance" }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("sem parâmetro, começa em Hoje", async () => {
    renderAt("/app/personal/students/42");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Hoje" }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("aba desconhecida degrada para a primeira em vez de tela branca", async () => {
    renderAt("/app/personal/students/42?ctab=inventada");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Hoje" }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("clicar numa aba muda a seleção", async () => {
    renderAt("/app/personal/students/42");
    await screen.findByRole("tab", { name: "Performance" });

    await userEvent.click(screen.getByRole("tab", { name: "Performance" }));
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Performance" }).getAttribute("aria-selected")).toBe("true"),
    );
  });

  it("`ctab` não colide com o `tab` da página do aluno", async () => {
    // A página em volta usa `?tab=` para outro nível de navegação (visão geral ×
    // fichas). Se os dois compartilhassem nome, um sobrescreveria o outro.
    renderAt("/app/personal/students/42?tab=workouts&ctab=performance");
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Performance" }).getAttribute("aria-selected")).toBe("true"),
    );
  });
});

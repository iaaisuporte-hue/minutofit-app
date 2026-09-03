/**
 * Execução dinâmica no cockpit do personal.
 *
 * Sessão em que o aluno trocou ou acrescentou exercício não é sessão "errada":
 * o chip diz o fato ("2 substituições") e o personal tira a conclusão.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { StudentTrainingSummary } from "../../../services/personalWorkoutApi";

const fetchStudentTrainingSummary = vi.fn();
vi.mock("../../../services/personalWorkoutApi", () => ({
  fetchStudentTrainingSummary: (id: string) => fetchStudentTrainingSummary(id),
}));

import { StudentExecutionCard } from "./StudentExecutionCard";

type Session = StudentTrainingSummary["sessions"][number];

function summary(over: Partial<Session>): StudentTrainingSummary {
  return {
    adherencePct: 80,
    last7d: 2,
    total: 5,
    sessions: [
      {
        id: 1,
        date: "2026-09-01T10:00:00.000Z",
        status: "completed",
        source: "personal",
        readinessLevel: null,
        setsDone: 9,
        prescribedSets: 12,
        discomfortExercises: [],
        ...over,
      },
    ],
  };
}

async function renderCard(s: StudentTrainingSummary) {
  fetchStudentTrainingSummary.mockResolvedValue(s);
  render(<StudentExecutionCard studentId="42" />);
  return screen.findByText("Execução do treino");
}

beforeEach(() => vi.clearAllMocks());

describe("StudentExecutionCard — substituições e extras", () => {
  it("mostra o contador de substituições, no plural", async () => {
    await renderCard(summary({ substitutionsCount: 2 }));
    expect(screen.getByText(/· 2 substituições/)).toBeInTheDocument();
  });

  it("usa o singular com uma substituição só", async () => {
    await renderCard(summary({ substitutionsCount: 1 }));
    expect(screen.getByText(/· 1 substituição/)).toBeInTheDocument();
  });

  it("soma substituições e extras no mesmo chip", async () => {
    await renderCard(summary({ substitutionsCount: 2, extraExercisesCount: 1 }));
    expect(screen.getByText(/· 2 substituições · 1 extra/)).toBeInTheDocument();
  });

  it("contador zerado não escreve nada", async () => {
    await renderCard(summary({ substitutionsCount: 0, extraExercisesCount: 0 }));
    expect(screen.queryByText(/substitui/)).not.toBeInTheDocument();
    expect(screen.queryByText(/extra/)).not.toBeInTheDocument();
  });

  it("backend uma versão atrás (sem os campos) segue renderizando o chip de sempre", async () => {
    await renderCard(summary({}));
    expect(screen.getByText(/9\/12/)).toBeInTheDocument();
    expect(screen.queryByText(/substitui/)).not.toBeInTheDocument();
  });
});

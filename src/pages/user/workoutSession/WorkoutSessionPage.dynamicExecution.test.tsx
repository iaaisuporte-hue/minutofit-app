/**
 * Execução dinâmica: o aluno troca e acrescenta exercício no meio da ficha.
 *
 * Dois riscos justificam estes testes, e os dois são de PERDA DE TREINO.
 *
 * O primeiro é a retomada: a regra antiga aceitava o rascunho só quando ele
 * tinha o MESMO número de exercícios da ficha — o que, com substituição e
 * acréscimo, passa a acusar diferença justamente onde não houve mudança nenhuma
 * do personal. Aceitar demais é pior ainda: um rascunho de uma ficha reescrita
 * faria o aluno executar o treino de ontem sem saber.
 *
 * O segundo é o que chega ao servidor: `executionSource` é o que separa o que a
 * ficha pediu do que o aluno resolveu fazer, e é dessa distinção que a aderência
 * vive. Ausência do campo tem significado próprio (cliente antigo = prescrito),
 * então o teste verifica também o caso em que ele NÃO vai.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMyWorkoutPlans = vi.fn();
const getExercisesBatch = vi.fn();
const searchExercises = vi.fn();
const getWorkoutStats = vi.fn();
const createWorkoutSession = vi.fn();

vi.mock("../../../services/userWorkoutPlansApi", () => ({
  fetchMyWorkoutPlans: (...a: unknown[]) => fetchMyWorkoutPlans(...a),
}));
vi.mock("../../../services/exercisesApi", () => ({
  getExercisesBatch: (...a: unknown[]) => getExercisesBatch(...a),
  searchExercises: (...a: unknown[]) => searchExercises(...a),
}));
vi.mock("../../../services/workoutSessionApi", () => ({
  getWorkoutStats: (...a: unknown[]) => getWorkoutStats(...a),
  createWorkoutSession: (...a: unknown[]) => createWorkoutSession(...a),
}));
vi.mock("../../../features/training/adaptive/useAdaptiveTraining", () => ({
  useAdaptiveTraining: () => ({ data: null, loading: false, error: null }),
}));
vi.mock("../../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    loading: false,
    planName: "Free",
    features: {},
    hasFeature: () => false,
    refresh: async () => {},
  }),
}));

import WorkoutSessionPage from "../WorkoutSessionPage";
import {
  computePrescribedBaseline,
  loadDraft,
  saveDraft,
  type DraftExercise,
  type SessionDraft,
} from "./sessionDraft";
import type { UserWorkoutPlan, UserWorkoutPlanItem } from "../../../services/userWorkoutPlansApi";

const PLAN_ID = 7;
const DAY_INDEX = 0;

const ITENS: UserWorkoutPlanItem[] = [
  { exerciseId: "ex-1", name: "Supino reto", sets: "1", reps: "10", rest: "60s" },
  { exerciseId: "ex-2", name: "Crucifixo", sets: "1", reps: "12", rest: "60s" },
];

function plano(itens: UserWorkoutPlanItem[] = ITENS): UserWorkoutPlan {
  return {
    id: PLAN_ID,
    personal_id: 1,
    student_id: 2,
    title: "Ficha A",
    week_preset: "3x",
    selected_group: null,
    payload_json: itens,
    days: [{ index: DAY_INDEX, name: "Dia 1", focus: "Peito", items: itens }],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  };
}

/** Fingerprint como a página calcula — a comparação da retomada é sobre ele. */
function baselineDe(itens: UserWorkoutPlanItem[]): string {
  return computePrescribedBaseline(
    itens.map((it) => ({
      exerciseId: it.exerciseId ?? null,
      name: it.name,
      sets: it.sets,
      reps: it.reps,
      rest: it.rest,
      technique: it.technique
        ? { type: it.technique.type, biSetGroupId: it.technique.biSetGroupId ?? null }
        : null,
    })),
  );
}

function exercicio(
  exerciseId: string,
  name: string,
  extra: Partial<DraftExercise> = {},
  done = false,
): DraftExercise {
  return {
    exerciseId,
    name,
    biSetGroupId: null,
    sets: [
      {
        setIndex: 1,
        plannedReps: "10",
        plannedRestS: 60,
        loadKg: done ? "40" : "",
        reps: "",
        done,
        restDoneS: null,
        completedAt: done ? Date.now() : null,
      },
    ],
    ...extra,
  };
}

function semearRascunho(exercises: DraftExercise[], baseline?: string) {
  const draft: SessionDraft = {
    version: 1,
    planId: PLAN_ID,
    dayIndex: DAY_INDEX,
    startedAt: Date.now() - 5 * 60 * 1000,
    currentIndex: 0,
    exercises,
    restEndsAt: null,
    restForKey: null,
  };
  if (baseline) draft.prescribedBaseline = baseline;
  saveDraft(draft);
}

function renderSessao() {
  return render(
    <MemoryRouter initialEntries={[`/app/user/treino/${PLAN_ID}/${DAY_INDEX}`]}>
      <Routes>
        <Route path="/app/user/treino/:planId/:dayIndex" element={<WorkoutSessionPage />} />
        <Route path="/app/user/ficha" element={<div>Ficha</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fetchMyWorkoutPlans.mockResolvedValue([plano()]);
  getWorkoutStats.mockResolvedValue(null);
  getExercisesBatch.mockResolvedValue([]);
  searchExercises.mockResolvedValue([]);
  createWorkoutSession.mockResolvedValue({ streak: 1, prEvents: [], celebrate: false });
});

describe("retomada com a lista editada pelo aluno", () => {
  it("aceita o rascunho inteiro quando a ficha não mudou, mesmo com outro tamanho", async () => {
    semearRascunho(
      [
        exercicio("ex-9", "Supino máquina", {
          origin: "replacement",
          replacedSnapshot: exercicio("ex-1", "Supino reto"),
          substitutionReason: "Equipamento ocupado",
        }),
        exercicio("ex-2", "Crucifixo"),
        exercicio("ex-7", "Tríceps corda", { origin: "user_added" }),
      ],
      baselineDe(ITENS),
    );
    renderSessao();

    expect(await screen.findByText("Supino máquina")).toBeTruthy();
    expect(screen.getByText("Substituiu: Supino reto")).toBeTruthy();
    // 3 exercícios: o rascunho voltou inteiro, sem cair na regra por comprimento.
    expect(screen.getByText(/Exercício 1\/3/)).toBeTruthy();
  });

  it("descarta o rascunho quando o personal reescreveu a ficha", async () => {
    // Mesma quantidade de exercícios, reps diferentes: é exatamente o caso que a
    // comparação por comprimento não enxergava.
    semearRascunho(
      [exercicio("ex-9", "Supino máquina", { origin: "replacement" }), exercicio("ex-2", "Crucifixo")],
      baselineDe([{ ...ITENS[0], reps: "8" }, ITENS[1]]),
    );
    renderSessao();

    expect(await screen.findByText("Supino reto")).toBeTruthy();
    expect(screen.queryByText("Supino máquina")).toBeNull();
    expect(screen.getByText(/Exercício 1\/2/)).toBeTruthy();
  });

  it("rascunho antigo (sem fingerprint) segue a checagem por comprimento — aceita", async () => {
    semearRascunho([exercicio("ex-1", "Supino reto", {}, true), exercicio("ex-2", "Crucifixo")]);
    renderSessao();

    expect(await screen.findByText("Supino reto")).toBeTruthy();
    // A série marcada sobreviveu: o rascunho foi aceito, não remontado da ficha.
    expect(screen.getByText(/1\/2 séries/)).toBeTruthy();
  });

  it("rascunho antigo (sem fingerprint) segue a checagem por comprimento — descarta", async () => {
    semearRascunho([
      exercicio("ex-1", "Supino reto", {}, true),
      exercicio("ex-2", "Crucifixo"),
      exercicio("ex-7", "Tríceps corda"),
    ]);
    renderSessao();

    expect(await screen.findByText("Supino reto")).toBeTruthy();
    expect(screen.getByText(/Exercício 1\/2/)).toBeTruthy();
    expect(screen.getByText(/0\/2 séries/)).toBeTruthy();
  });
});

describe("substituir o exercício atual", () => {
  it("grava origem e motivo no rascunho, mostra o selo e desfaz enquanto nada foi feito", async () => {
    searchExercises.mockResolvedValue([
      { id: "ex-9", name: "Supino máquina", bodyPart: "peito", equipment: "máquina", primaryMediaUrl: null },
    ]);
    renderSessao();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Substituir exercício" }));
    await user.click(await screen.findByRole("button", { name: /Supino máquina/ }));

    // Confirmação com motivo — o chip é opcional, mas quando escolhido viaja
    // junto da série até o personal.
    await user.click(await screen.findByRole("button", { name: "Equipamento ocupado" }));
    await user.click(screen.getByRole("button", { name: "Substituir" }));

    expect(await screen.findByText("Substituiu: Supino reto")).toBeTruthy();
    await waitFor(() => {
      const ex = loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0];
      expect(ex?.origin).toBe("replacement");
      expect(ex?.exerciseId).toBe("ex-9");
      expect(ex?.substitutionReason).toBe("Equipamento ocupado");
      expect(ex?.replacedSnapshot?.name).toBe("Supino reto");
    });

    await user.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Supino reto")).toBeTruthy();
    await waitFor(() => {
      expect(loadDraft(PLAN_ID, DAY_INDEX)?.exercises[0].origin).toBeUndefined();
    });
  });

  it("com série já feita, oferece acrescentar em vez de descartar o que foi registrado", async () => {
    searchExercises.mockResolvedValue([
      { id: "ex-9", name: "Supino máquina", bodyPart: "peito", equipment: "máquina", primaryMediaUrl: null },
    ]);
    semearRascunho([exercicio("ex-1", "Supino reto", {}, true), exercicio("ex-2", "Crucifixo")]);
    renderSessao();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Substituir exercício" }));
    await user.click(await screen.findByRole("button", { name: /Supino máquina/ }));
    await user.click(
      await screen.findByRole("button", { name: "Encerrar Supino reto e adicionar Supino máquina" }),
    );

    await waitFor(() => {
      const exs = loadDraft(PLAN_ID, DAY_INDEX)?.exercises ?? [];
      // O novo entra LOGO DEPOIS do atual, e o trabalho do atual continua lá.
      expect(exs.map((e) => e.exerciseId)).toEqual(["ex-1", "ex-9", "ex-2"]);
      expect(exs[0].sets[0].done).toBe(true);
      // Não foi substituição: sem snapshot, sem motivo.
      expect(exs[1].origin).toBe("user_added");
      expect(exs[1].replacedSnapshot).toBeUndefined();
    });
  });
});

describe("payload da sessão", () => {
  it("leva a procedência de cada série — e a omite no que veio da ficha", async () => {
    semearRascunho(
      [
        exercicio("ex-1", "Supino reto", {}, true),
        exercicio(
          "ex-9",
          "Supino máquina",
          {
            origin: "replacement",
            replacedSnapshot: exercicio("ex-2", "Crucifixo"),
            substitutionReason: "Dor ou desconforto",
          },
          true,
        ),
        exercicio("ex-7", "Tríceps corda", { origin: "user_added" }, true),
      ],
      baselineDe(ITENS),
    );
    renderSessao();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Finalizar treino" }));
    await user.click(await screen.findByRole("button", { name: "Concluir e salvar" }));

    await waitFor(() => expect(createWorkoutSession).toHaveBeenCalled());
    const payload = createWorkoutSession.mock.calls[0][0];
    const sets = payload.sets as Array<Record<string, unknown>>;
    const por = (id: string) => sets.find((s) => s.exerciseId === id)!;

    // Ficha: campo ausente. O servidor assume `prescribed`, que é o que todo
    // cliente anterior a esta coluna mandava.
    expect(por("ex-1").executionSource).toBeUndefined();
    expect(por("ex-1").substitutedFromExerciseId).toBeUndefined();

    expect(por("ex-9").executionSource).toBe("replacement");
    expect(por("ex-9").substitutedFromExerciseId).toBe("ex-2");
    expect(por("ex-9").substitutionReason).toBe("Dor ou desconforto");

    expect(por("ex-7").executionSource).toBe("user_added");
    expect(por("ex-7").substitutedFromExerciseId).toBeUndefined();
    expect(por("ex-7").substitutionReason).toBeUndefined();

    // O que foi PRESCRITO continua saindo da ficha, intocado pela execução.
    expect((payload.prescribed as Array<{ exerciseId: string }>).map((p) => p.exerciseId)).toEqual([
      "ex-1",
      "ex-2",
    ]);
  });
});

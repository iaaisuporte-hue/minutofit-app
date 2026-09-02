import { beforeEach, describe, expect, it } from "vitest";
import {
  alvoDePlano,
  exerciciosDeSessaoLivre,
  podeRepetir,
  prepararLivreRepetido,
} from "./repeatWorkout";
import { loadFreeDraft } from "./sessionDraft";
import type { WorkoutSessionDetail, WorkoutSessionListItem } from "../../../services/workoutSessionApi";

function sessao(p: Partial<WorkoutSessionListItem> = {}): WorkoutSessionListItem {
  return {
    id: 1, source: "personal", planId: 5, dayIndex: 2, readinessLevel: null,
    status: "completed", sessionRpe: null, title: "Treino A · Peito",
    startedAt: "2026-09-01T10:00:00Z", endedAt: null, performedAt: "2026-09-01T10:00:00Z",
    isRetroactive: false, setsDone: 12, ...p,
  };
}

function linha(p: Partial<WorkoutSessionDetail["sets"][number]>): WorkoutSessionDetail["sets"][number] {
  return {
    exerciseId: "uuid-a", exerciseName: "Supino", orderIndex: 0, setIndex: 1,
    plannedReps: "10", repsDone: 10, loadDoneKg: 80, rpe: null, discomfort: null,
    status: "done", ...p,
  };
}

function detalhe(sets: WorkoutSessionDetail["sets"], p: Partial<WorkoutSessionDetail> = {}): WorkoutSessionDetail {
  return { ...sessao({ source: "free", planId: null, dayIndex: null }), notes: null, sets, ...p };
}

beforeEach(() => localStorage.clear());

describe("podeRepetir", () => {
  it("sessão de ficha com plano e dia pode", () => {
    expect(podeRepetir(sessao())).toBe(true);
  });

  it("sessão de ficha sem plano não pode — não há o que reabrir", () => {
    expect(podeRepetir(sessao({ planId: null }))).toBe(false);
  });

  it("sessão livre com séries pode", () => {
    expect(podeRepetir(sessao({ source: "free", planId: null, dayIndex: null, setsDone: 6 }))).toBe(true);
  });

  it("sessão livre vazia não pode", () => {
    expect(podeRepetir(sessao({ source: "free", planId: null, dayIndex: null, setsDone: 0 }))).toBe(false);
  });

  it("retroativa não é treino para refazer", () => {
    expect(podeRepetir(sessao({ isRetroactive: true }))).toBe(false);
  });

  it("Lab guiado não é um treino — é análise de um exercício", () => {
    expect(podeRepetir(sessao({ source: "movement_lab" as never }))).toBe(false);
  });

  it("nada não quebra", () => {
    expect(podeRepetir(null)).toBe(false);
    expect(podeRepetir(undefined)).toBe(false);
  });
});

describe("alvoDePlano", () => {
  it("aponta para o mesmo dia da ficha", () => {
    expect(alvoDePlano(sessao())).toEqual({
      title: "Treino A · Peito", route: "/app/user/treino/5/2", kind: "plan",
    });
  });
});

describe("exerciciosDeSessaoLivre", () => {
  it("agrupa por exercício preservando a ordem de execução", () => {
    const d = detalhe([
      linha({ exerciseId: "b", exerciseName: "Remada", orderIndex: 1, setIndex: 1 }),
      linha({ exerciseId: "a", exerciseName: "Supino", orderIndex: 0, setIndex: 1 }),
      linha({ exerciseId: "a", exerciseName: "Supino", orderIndex: 0, setIndex: 2 }),
    ]);
    const ex = exerciciosDeSessaoLivre(d);
    expect(ex.map((e) => e.name)).toEqual(["Supino", "Remada"]);
    expect(ex[0].sets).toHaveLength(2);
  });

  it("carga e reps entram preenchidas mas NÃO marcadas — é referência, não execução", () => {
    const ex = exerciciosDeSessaoLivre(detalhe([linha({ loadDoneKg: 82.5, repsDone: 9 })]));
    expect(ex[0].sets[0]).toMatchObject({ loadKg: "82.5", reps: "9", done: false, completedAt: null });
  });

  it("descarta linha sem exerciseId — gravar por nome seria rejeitado no fim", () => {
    const ex = exerciciosDeSessaoLivre(detalhe([
      linha({ exerciseId: null, exerciseName: "Exercício legado" }),
      linha({ exerciseId: "a" }),
    ]));
    expect(ex).toHaveLength(1);
    expect(ex[0].exerciseId).toBe("a");
  });

  it("ignora série pulada", () => {
    const ex = exerciciosDeSessaoLivre(detalhe([
      linha({ setIndex: 1 }),
      linha({ setIndex: 2, status: "skipped" }),
    ]));
    expect(ex[0].sets).toHaveLength(1);
  });

  it("renumera as séries a partir de 1", () => {
    const ex = exerciciosDeSessaoLivre(detalhe([
      linha({ setIndex: 3 }), linha({ setIndex: 7 }),
    ]));
    expect(ex[0].sets.map((s) => s.setIndex)).toEqual([1, 2]);
  });
});

describe("prepararLivreRepetido", () => {
  it("grava o rascunho livre e devolve a rota da sessão", () => {
    const alvo = prepararLivreRepetido(detalhe([linha({})], { title: "Treino livre" }));
    expect(alvo).toEqual({ title: "Treino livre", route: "/app/user/treino-livre/sessao", kind: "free" });
    const draft = loadFreeDraft();
    expect(draft?.exercises).toHaveLength(1);
    expect(draft?.exercises[0].name).toBe("Supino");
  });

  it("gera clientKey NOVA — senão o servidor devolveria a sessão antiga como replay", () => {
    prepararLivreRepetido(detalhe([linha({})]));
    const primeira = loadFreeDraft()!.clientKey;
    localStorage.clear();
    prepararLivreRepetido(detalhe([linha({})]));
    expect(loadFreeDraft()!.clientKey).not.toBe(primeira);
  });

  it("nada aproveitável devolve null em vez de abrir sessão vazia", () => {
    expect(prepararLivreRepetido(detalhe([linha({ exerciseId: null })]))).toBeNull();
    expect(loadFreeDraft()).toBeNull();
  });
});

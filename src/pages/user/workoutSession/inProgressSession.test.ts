import { beforeEach, describe, expect, it } from "vitest";
import { discardInProgressSession, findInProgressSession, sessaoAtiva } from "./inProgressSession";
import { saveDraft, saveFreeDraft, type DraftExercise } from "./sessionDraft";

function ex(nome: string, feitas: number, total: number): DraftExercise {
  return {
    exerciseId: null,
    name: nome,
    biSetGroupId: null,
    sets: Array.from({ length: total }, (_, i) => ({
      setIndex: i,
      plannedReps: "10",
      plannedRestS: 60,
      loadKg: i < feitas ? "40" : "",
      reps: i < feitas ? "10" : "",
      done: i < feitas,
      restDoneS: null,
      completedAt: i < feitas ? Date.now() : null,
    })),
  };
}

beforeEach(() => localStorage.clear());

describe("findInProgressSession", () => {
  it("sem rascunho, não inventa treino", () => {
    expect(findInProgressSession()).toBeNull();
  });

  it("acha o treino prescrito aberto e monta a rota que reabre a sessão", () => {
    saveDraft({
      version: 1, planId: 7, dayIndex: 2, startedAt: 1000, currentIndex: 0,
      exercises: [ex("Supino", 2, 4)], restEndsAt: null, restForKey: null,
    });
    const s = findInProgressSession();
    expect(s).toMatchObject({
      mode: "plan", route: "/app/user/treino/7/2",
      doneSets: 2, totalSets: 4, currentExercise: "Supino",
    });
  });

  it("ignora rascunho sem NENHUMA série feita — abrir e sair não é treino aberto", () => {
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: 1000, currentIndex: 0,
      exercises: [ex("Supino", 0, 4)], restEndsAt: null, restForKey: null,
    });
    expect(findInProgressSession()).toBeNull();
  });

  it("acha o treino livre", () => {
    saveFreeDraft({
      version: 1, mode: "free", startedAt: 2000, currentIndex: 0,
      exercises: [ex("Remada", 1, 3)], restEndsAt: null, restForKey: null, clientKey: "k",
    });
    expect(findInProgressSession()).toMatchObject({
      mode: "free", route: "/app/user/treino-livre/sessao", doneSets: 1, totalSets: 3,
    });
  });

  it("com dois rascunhos abertos, vence o que começou por último", () => {
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: 1000, currentIndex: 0,
      exercises: [ex("Antigo", 1, 4)], restEndsAt: null, restForKey: null,
    });
    saveFreeDraft({
      version: 1, mode: "free", startedAt: 9000, currentIndex: 0,
      exercises: [ex("Recente", 1, 3)], restEndsAt: null, restForKey: null, clientKey: "k",
    });
    expect(findInProgressSession()?.mode).toBe("free");
  });

  it("rascunho corrompido não derruba a Hoje", () => {
    localStorage.setItem("s2core:workout:draft:9:9", "{ isto não é json");
    expect(() => findInProgressSession()).not.toThrow();
    expect(findInProgressSession()).toBeNull();
  });

  it("não confunde chave de outro domínio guardada no mesmo storage", () => {
    localStorage.setItem("s2core:workout:draft-setup:free", JSON.stringify({ version: 1 }));
    expect(findInProgressSession()).toBeNull();
  });
});

describe("discardInProgressSession", () => {
  it("apaga só o rascunho indicado", () => {
    saveDraft({
      version: 1, planId: 7, dayIndex: 2, startedAt: 1000, currentIndex: 0,
      exercises: [ex("Supino", 2, 4)], restEndsAt: null, restForKey: null,
    });
    saveFreeDraft({
      version: 1, mode: "free", startedAt: 500, currentIndex: 0,
      exercises: [ex("Remada", 1, 3)], restEndsAt: null, restForKey: null, clientKey: "k",
    });
    const s = findInProgressSession()!;
    expect(s.mode).toBe("plan");
    discardInProgressSession(s);
    // o livre continua lá — descartar um não pode levar o outro junto
    expect(findInProgressSession()?.mode).toBe("free");
  });
});

describe("sessaoAtiva — separa 'treinando agora' de 'esqueci aberto'", () => {
  it("série marcada há pouco = ativa", () => {
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: Date.now() - 20 * 60_000, currentIndex: 0,
      exercises: [ex("Supino", 1, 4)], restEndsAt: null, restForKey: null,
    });
    const s = findInProgressSession()!;
    expect(sessaoAtiva(s)).toBe(true);
  });

  it("parada há mais de 3h = esfriou", () => {
    const velho = Date.now() - 5 * 60 * 60_000;
    const e = ex("Supino", 1, 4);
    e.sets[0].completedAt = velho;
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: velho, currentIndex: 0,
      exercises: [e], restEndsAt: null, restForKey: null,
    });
    const s = findInProgressSession()!;
    expect(sessaoAtiva(s)).toBe(false);
  });

  it("um treino LONGO com pausa continua sendo o mesmo treino", () => {
    // 2h de treino: começou cedo, mas a última série foi agora.
    const e = ex("Agachamento", 2, 4);
    e.sets[0].completedAt = Date.now() - 2 * 60 * 60_000;
    e.sets[1].completedAt = Date.now() - 60_000;
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: Date.now() - 2.5 * 60 * 60_000,
      currentIndex: 0, exercises: [e], restEndsAt: null, restForKey: null,
    });
    expect(sessaoAtiva(findInProgressSession()!)).toBe(true);
  });

  it("lastActivityAt nunca fica atrás de startedAt", () => {
    const inicio = Date.now() - 10 * 60_000;
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: inicio, currentIndex: 0,
      exercises: [ex("Supino", 1, 4)], restEndsAt: null, restForKey: null,
    });
    const s = findInProgressSession()!;
    expect(s.lastActivityAt).toBeGreaterThanOrEqual(inicio);
  });

  it("expõe o instante absoluto do descanso para o mini-player", () => {
    const fim = Date.now() + 45_000;
    saveDraft({
      version: 1, planId: 7, dayIndex: 0, startedAt: Date.now(), currentIndex: 0,
      exercises: [ex("Supino", 1, 4)], restEndsAt: fim, restForKey: "0:1",
    });
    expect(findInProgressSession()!.restEndsAt).toBe(fim);
  });
});

/**
 * Lembrete de treino não finalizado.
 *
 * O risco que estes testes cobrem não é visual: é uma notificação tocar quando
 * não devia (treino já concluído, ou um lembrete velho depois de a pessoa ter
 * voltado ao treino) e é o lembrete NÃO tocar quando devia. Nada disso aparece
 * em revisão de código — depende de aritmética de tempo e de cancelamento — e
 * nada disso é observável em teste de UI, porque quem entrega é o sistema
 * operacional. Daí a camada adaptável: a regra de tempo é pura, e o plugin é
 * substituído por um dublê.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` é içado para o topo do arquivo, então os dublês precisam existir
// antes de qualquer `const` do módulo — daí o `vi.hoisted`.
const { checkPermissions, requestPermissions, schedule, cancel, getPending, addListener, estado } =
  vi.hoisted(() => ({
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    schedule: vi.fn(),
    cancel: vi.fn(),
    getPending: vi.fn(),
    addListener: vi.fn(),
    estado: { nativo: true },
  }));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: { checkPermissions, requestPermissions, schedule, cancel, getPending, addListener },
}));

vi.mock("../../../lib/platform", () => ({
  isNativeApp: () => estado.nativo,
  getPlatform: () => "android",
}));

import { traduzirDeepLink } from "../../../lib/deepLinks";
import { __resetPermissaoCache } from "./notificationPermission";
import {
  ATRASO_LEMBRETE_1_MS,
  ATRASO_LEMBRETE_2_MS,
  agendarLembretesTreino,
  cancelarLembretesTreino,
  chaveSessao,
  definirLembretesAtivados,
  ehIdDeLembrete,
  escutarToqueDeLembrete,
  idsLembrete,
  lembretesAtivados,
  linkDaSessao,
  planejarLembretes,
  type SessaoLembrete,
} from "./pendingWorkoutReminder";

const FICHA: SessaoLembrete = { mode: "plan", planId: 7, dayIndex: 2 };
const LIVRE: SessaoLembrete = { mode: "free", planId: null, dayIndex: null };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  __resetPermissaoCache();
  estado.nativo = true;
  checkPermissions.mockResolvedValue({ display: "granted" });
  requestPermissions.mockResolvedValue({ display: "granted" });
  schedule.mockResolvedValue(undefined);
  cancel.mockResolvedValue(undefined);
  getPending.mockResolvedValue({ notifications: [] });
});

/** Os lembretes efetivamente entregues ao sistema na última chamada. */
function agendados() {
  return schedule.mock.calls.at(-1)?.[0].notifications ?? [];
}

describe("planejarLembretes (regra de tempo, pura)", () => {
  const t0 = 1_700_000_000_000;

  it("agenda exatamente dois lembretes: 45 min e 2 h após a última atividade", () => {
    const p = planejarLembretes("7:2", t0, t0);
    expect(p).toHaveLength(2);
    expect(p[0]).toMatchObject({ ordem: 1, at: t0 + ATRASO_LEMBRETE_1_MS });
    expect(p[1]).toMatchObject({ ordem: 2, at: t0 + ATRASO_LEMBRETE_2_MS });
    // A regra é fechada: nunca há um terceiro, nunca há recorrência.
    expect(ATRASO_LEMBRETE_1_MS).toBe(45 * 60 * 1000);
    expect(ATRASO_LEMBRETE_2_MS).toBe(2 * 60 * 60 * 1000);
  });

  it("caso 8: atividade aos 40 min NÃO faz o primeiro lembrete soar 5 min depois", () => {
    const atividade = t0 + 40 * 60 * 1000;
    const p = planejarLembretes("7:2", atividade, atividade);
    expect(p[0].at).toBe(atividade + ATRASO_LEMBRETE_1_MS); // 85 min do início
    expect(p[0].at - t0).toBeGreaterThan(45 * 60 * 1000);
  });

  it("não agenda lembrete cujo instante já passou", () => {
    // Retomada tardia: 3 h depois da última série, o primeiro lembrete não tem
    // mais sentido — só o segundo ainda está no futuro.
    const antiga = t0 - 3 * 60 * 60 * 1000;
    const p = planejarLembretes("7:2", antiga, t0);
    expect(p).toHaveLength(0);
    const p2 = planejarLembretes("7:2", t0 - 60 * 60 * 1000, t0);
    expect(p2.map((x) => x.ordem)).toEqual([2]);
  });

  it("ids são determinísticos por sessão e distintos entre sessões", () => {
    expect(idsLembrete("7:2")).toEqual(idsLembrete("7:2"));
    expect(idsLembrete("7:2")).not.toEqual(idsLembrete("7:3"));
    expect(idsLembrete("7:2")).not.toEqual(idsLembrete("free"));
    const { primeiro, segundo } = idsLembrete("7:2");
    expect(primeiro).not.toBe(segundo);
    // Fora da faixa genérica e longe do aviso de descanso (90_001).
    expect(ehIdDeLembrete(primeiro)).toBe(true);
    expect(ehIdDeLembrete(segundo)).toBe(true);
    expect(ehIdDeLembrete(1)).toBe(false);
    expect(ehIdDeLembrete(90_001)).toBe(false);
  });

  it("a chave da sessão separa ficha por dia e o treino livre", () => {
    expect(chaveSessao(FICHA)).toBe("7:2");
    expect(chaveSessao({ mode: "plan", planId: 7, dayIndex: 3 })).toBe("7:3");
    expect(chaveSessao(LIVRE)).toBe("free");
  });
});

describe("agendamento", () => {
  it("entrega os dois lembretes ao sistema, com hora absoluta", async () => {
    const n = await agendarLembretesTreino(FICHA, Date.now());
    expect(n).toBe(2);
    const notas = agendados();
    expect(notas).toHaveLength(2);
    expect(notas[0].schedule.at).toBeInstanceOf(Date);
    expect(notas[0].schedule.allowWhileIdle).toBe(true);
    expect(notas.map((x: { id: number }) => x.id)).toEqual([
      idsLembrete("7:2").primeiro,
      idsLembrete("7:2").segundo,
    ]);
  });

  it("reagendar cancela o anterior antes de entregar o novo", async () => {
    const { primeiro } = idsLembrete("7:2");
    getPending.mockResolvedValue({ notifications: [{ id: primeiro }] });
    await agendarLembretesTreino(FICHA, Date.now());
    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: primeiro }] });
    // E o cancelamento vem ANTES do agendamento — senão apagaria o que acabou
    // de ser entregue.
    expect(cancel.mock.invocationCallOrder[0]).toBeLessThan(schedule.mock.invocationCallOrder[0]);
  });

  it("reagendar move os dois lembretes para a frente", async () => {
    const t0 = Date.now();
    await agendarLembretesTreino(FICHA, t0);
    const antes = agendados().map((x: { schedule: { at: Date } }) => x.schedule.at.getTime());
    await agendarLembretesTreino(FICHA, t0 + 20 * 60 * 1000);
    const depois = agendados().map((x: { schedule: { at: Date } }) => x.schedule.at.getTime());
    expect(depois[0]).toBe(antes[0] + 20 * 60 * 1000);
    expect(depois[1]).toBe(antes[1] + 20 * 60 * 1000);
  });

  it("fora do app empacotado não agenda nada (web/PWA não entrega com a aba fechada)", async () => {
    estado.nativo = false;
    expect(await agendarLembretesTreino(FICHA, Date.now())).toBe(0);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("sem permissão não agenda, e não insiste depois de negada", async () => {
    checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await agendarLembretesTreino(FICHA, Date.now())).toBe(0);
    expect(schedule).not.toHaveBeenCalled();
    await agendarLembretesTreino(FICHA, Date.now());
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("erro do plugin nunca escapa — treino não pode quebrar por notificação", async () => {
    schedule.mockRejectedValue(new Error("sem canal"));
    await expect(agendarLembretesTreino(FICHA, Date.now())).resolves.toBe(0);
  });
});

describe("preferência do usuário", () => {
  it("vem ligada por padrão", () => {
    expect(lembretesAtivados()).toBe(true);
  });

  it("desligada, não agenda e ainda cancela o que já estava no sistema", async () => {
    const { primeiro } = idsLembrete("7:2");
    getPending.mockResolvedValue({ notifications: [{ id: primeiro }] });
    definirLembretesAtivados(false);
    expect(lembretesAtivados()).toBe(false);
    expect(await agendarLembretesTreino(FICHA, Date.now())).toBe(0);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: primeiro }] });
  });
});

describe("cancelamento (treino concluído ou descartado)", () => {
  it("cancela QUALQUER lembrete pendente, inclusive de sessão anterior", async () => {
    // Caso 7 do enunciado: um treino concluído não pode receber lembrete —
    // nem mesmo o que ficou de uma execução cuja chave a tela atual não conhece.
    const outra = idsLembrete("99:0");
    getPending.mockResolvedValue({
      notifications: [{ id: outra.primeiro }, { id: outra.segundo }],
    });
    await cancelarLembretesTreino();
    expect(cancel).toHaveBeenCalledWith({
      notifications: [{ id: outra.primeiro }, { id: outra.segundo }],
    });
  });

  it("não toca no aviso de descanso nem em notificação de terceiros", async () => {
    getPending.mockResolvedValue({ notifications: [{ id: 90_001 }, { id: 42 }] });
    await cancelarLembretesTreino();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("sem pendentes, não chama o plugin à toa", async () => {
    await cancelarLembretesTreino();
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("retomada pelo toque na notificação", () => {
  it("o link do lembrete reabre EXATAMENTE a sessão que o originou", () => {
    expect(traduzirDeepLink(linkDaSessao(FICHA))).toEqual({
      rota: "/app/user/treino/7/2",
      origem: "notificacao",
    });
    expect(traduzirDeepLink(linkDaSessao(LIVRE))).toEqual({
      rota: "/app/user/treino-livre/sessao",
      origem: "notificacao",
    });
    // Dia diferente é destino diferente — o lembrete não pode abrir o treino errado.
    expect(traduzirDeepLink(linkDaSessao({ mode: "plan", planId: 7, dayIndex: 3 })).rota).toBe(
      "/app/user/treino/7/3",
    );
  });

  it("o agendamento carrega o link da própria sessão", async () => {
    await agendarLembretesTreino(LIVRE, Date.now());
    for (const nota of agendados()) {
      expect(nota.extra).toEqual({ kind: "workout_pending", link: linkDaSessao(LIVRE) });
    }
  });

  it("o ouvinte entrega o link só do lembrete de treino", async () => {
    let handler: (e: unknown) => void = () => {};
    addListener.mockImplementation((_evento: string, cb: (e: unknown) => void) => {
      handler = cb;
      return Promise.resolve({ remove: vi.fn() });
    });
    const visto: string[] = [];
    await escutarToqueDeLembrete((link) => visto.push(link));

    handler({ notification: { extra: { kind: "workout_pending", link: "s2core://workout/session/7/2" } } });
    // O aviso de descanso passa pelo mesmo canal e NÃO deve navegar.
    handler({ notification: { extra: { kind: "rest_done" } } });
    handler({ notification: {} });

    expect(visto).toEqual(["s2core://workout/session/7/2"]);
  });
});

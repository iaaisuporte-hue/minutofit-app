/**
 * `garantirPermissaoNotificacao` é o único portão de POST_NOTIFICATIONS do
 * app — usado pelo descanso do treino, pelo lembrete de treino não
 * finalizado e, desde o achado de teste em dispositivo real (P1E), pelo
 * Tracker outdoor: sem essa permissão concedida, o serviço de primeiro plano
 * (P1B) sobe normalmente, mas a notificação nunca aparece — silenciosamente.
 * Nenhum teste existia para esta função antes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    checkPermissions: (...a: unknown[]) => checkPermissions(...a),
    requestPermissions: (...a: unknown[]) => requestPermissions(...a),
  },
}));

const { garantirPermissaoNotificacao, __resetPermissaoCache, notificacaoPermitida } = await import(
  "./notificationPermission"
);

beforeEach(() => {
  vi.clearAllMocks();
  __resetPermissaoCache();
});

afterEach(() => vi.restoreAllMocks());

describe("garantirPermissaoNotificacao", () => {
  it("já concedida: devolve true sem abrir diálogo", async () => {
    checkPermissions.mockResolvedValue({ display: "granted" });
    expect(await garantirPermissaoNotificacao()).toBe(true);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("negada permanentemente: devolve false sem tentar pedir de novo", async () => {
    checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await garantirPermissaoNotificacao()).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("nunca pedida: abre o diálogo uma vez e reflete a resposta", async () => {
    checkPermissions.mockResolvedValue({ display: "prompt" });
    requestPermissions.mockResolvedValue({ display: "granted" });
    expect(await garantirPermissaoNotificacao()).toBe(true);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("já negada antes: NÃO reabre diálogo (o sistema não mostraria mesmo)", async () => {
    checkPermissions.mockResolvedValue({ display: "prompt" });
    requestPermissions.mockResolvedValue({ display: "denied" });
    expect(await garantirPermissaoNotificacao()).toBe(false);
    checkPermissions.mockResolvedValue({ display: "denied" });
    requestPermissions.mockClear();
    expect(await garantirPermissaoNotificacao()).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("chamadas CONCORRENTES compartilham um único diálogo, não dois", async () => {
    checkPermissions.mockResolvedValue({ display: "prompt" });
    let resolvePedido: (v: { display: string }) => void = () => {};
    requestPermissions.mockReturnValue(new Promise((r) => { resolvePedido = r; }));

    const chamada1 = garantirPermissaoNotificacao();
    const chamada2 = garantirPermissaoNotificacao();
    resolvePedido({ display: "granted" });

    expect(await chamada1).toBe(true);
    expect(await chamada2).toBe(true);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it(
    "NÃO cacheia o resultado entre chamadas sequenciais — bug corrigido: " +
      "negar uma vez não trava 'false' para sempre na sessão",
    async () => {
      checkPermissions.mockResolvedValue({ display: "denied" });
      expect(await garantirPermissaoNotificacao()).toBe(false);

      // A pessoa foi em Configurações e reativou — sem reabrir o app.
      checkPermissions.mockResolvedValue({ display: "granted" });
      expect(await garantirPermissaoNotificacao()).toBe(true);
      expect(checkPermissions).toHaveBeenCalledTimes(2);
    },
  );

  it("também reflete uma REVOGAÇÃO no meio da sessão, não só a concessão", async () => {
    checkPermissions.mockResolvedValue({ display: "granted" });
    expect(await garantirPermissaoNotificacao()).toBe(true);

    checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await garantirPermissaoNotificacao()).toBe(false);
  });

  it("bridge indisponível (web/erro): degrada para false, nunca lança", async () => {
    checkPermissions.mockRejectedValue(new Error("plugin indisponível"));
    await expect(garantirPermissaoNotificacao()).resolves.toBe(false);
  });

  it("erro numa chamada não deixa a trava de concorrência presa para a próxima", async () => {
    checkPermissions.mockRejectedValueOnce(new Error("falha transitória"));
    expect(await garantirPermissaoNotificacao()).toBe(false);

    checkPermissions.mockResolvedValueOnce({ display: "granted" });
    expect(await garantirPermissaoNotificacao()).toBe(true);
  });
});

describe("notificacaoPermitida — só consulta, nunca pede", () => {
  it("reflete o estado atual sem chamar requestPermissions", async () => {
    checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await notificacaoPermitida()).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("erro vira false, nunca lança", async () => {
    checkPermissions.mockRejectedValue(new Error("boom"));
    await expect(notificacaoPermitida()).resolves.toBe(false);
  });
});

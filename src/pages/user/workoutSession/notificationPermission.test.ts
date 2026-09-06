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

  it("cacheia por processo — uma segunda chamada NÃO reabre o diálogo", async () => {
    checkPermissions.mockResolvedValue({ display: "prompt" });
    requestPermissions.mockResolvedValue({ display: "granted" });
    await garantirPermissaoNotificacao();
    await garantirPermissaoNotificacao();
    expect(requestPermissions).toHaveBeenCalledTimes(1);
    expect(checkPermissions).toHaveBeenCalledTimes(1);
  });

  it("bridge indisponível (web/erro): degrada para false, nunca lança", async () => {
    checkPermissions.mockRejectedValue(new Error("plugin indisponível"));
    await expect(garantirPermissaoNotificacao()).resolves.toBe(false);
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ init: vi.fn(), close: vi.fn(() => Promise.resolve(true)) }));

vi.mock("@sentry/react", () => ({
  init: (o: unknown) => sentry.init(o),
  close: () => sentry.close(),
}));

/** Cada teste monta um gate novo; sem desmontar, o listener do teste anterior
 *  continua vivo na mesma janela e o Sentry seria inicializado duas vezes. */
const desmontar: Array<() => void> = [];

async function montarGate() {
  vi.resetModules();
  const { setupSentryConsentGate } = await import("./sentryConsent");
  desmontar.push(setupSentryConsentGate());
}

beforeEach(() => {
  localStorage.clear();
  sentry.init.mockClear();
  sentry.close.mockClear();
  vi.stubEnv("VITE_SENTRY_DSN", "https://exemplo@sentry.invalid/1");
});

afterEach(() => {
  while (desmontar.length) desmontar.pop()!();
  vi.unstubAllEnvs();
});

describe("gate Sentry ↔ consentimento (LGPD / 5.1.2)", () => {
  it("não inicializa quando o titular ainda não respondeu ao banner", async () => {
    await montarGate();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("não inicializa quando o titular recusou medição", async () => {
    const { writeCookieConsent } = await import("./cookieConsent");
    writeCookieConsent(false);

    await montarGate();
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("inicializa quando o consentimento já existe no boot", async () => {
    const { writeCookieConsent } = await import("./cookieConsent");
    writeCookieConsent(true);

    await montarGate();
    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it("inicializa no instante do aceite, sem reload", async () => {
    await montarGate();
    expect(sentry.init).not.toHaveBeenCalled();

    const { writeCookieConsent } = await import("./cookieConsent");
    writeCookieConsent(true);

    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it("fecha o cliente quando o consentimento é revogado", async () => {
    const { writeCookieConsent, clearCookieConsent } = await import("./cookieConsent");

    await montarGate();
    writeCookieConsent(true);
    expect(sentry.init).toHaveBeenCalledTimes(1);

    clearCookieConsent();
    expect(sentry.close).toHaveBeenCalledTimes(1);
  });

  it("sem DSN não inicializa nem com consentimento", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const { writeCookieConsent } = await import("./cookieConsent");
    writeCookieConsent(true);

    await montarGate();
    expect(sentry.init).not.toHaveBeenCalled();
  });
});

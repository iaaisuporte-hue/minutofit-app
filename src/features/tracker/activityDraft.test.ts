import { beforeEach, describe, expect, it } from "vitest";
import {
  acrescentarPonto,
  atividadeAtiva,
  carregarRascunho,
  duracaoAtivaS,
  duracaoParedeS,
  estaPausada,
  gravarRascunho,
  limparRascunho,
  novoRascunho,
  pausar,
  retomar,
  tempoPausadoMs,
  type ActivityDraft,
} from "./activityDraft";

const T0 = 1_800_000_000_000;
const ponto = (i: number) => ({ lat: -23.55 + i * 0.0001, lng: -46.63, accuracy: 8, timestamp: T0 + i * 5000 });

beforeEach(() => localStorage.clear());

describe("persistência incremental (§36)", () => {
  it("cada ponto é gravado na hora — a rota não vive só em memória", () => {
    let d = novoRascunho("run", T0);
    gravarRascunho(d);
    for (let i = 0; i < 5; i++) d = acrescentarPonto(d, ponto(i));
    // Simula o processo morrer: o estado em memória some, só resta o storage.
    const recuperado = carregarRascunho();
    expect(recuperado?.pontos).toHaveLength(5);
    expect(recuperado?.tipo).toBe("run");
    expect(recuperado?.clientKey).toBe(d.clientKey);
  });

  it("sem rascunho, não inventa atividade", () => {
    expect(carregarRascunho()).toBeNull();
  });

  it("rascunho corrompido não derruba a tela", () => {
    localStorage.setItem("s2core:activity:draft", "{ isto não é json");
    expect(() => carregarRascunho()).not.toThrow();
    expect(carregarRascunho()).toBeNull();
  });

  it("rascunho de versão desconhecida é ignorado", () => {
    localStorage.setItem("s2core:activity:draft", JSON.stringify({ version: 99, pontos: [], pausas: [] }));
    expect(carregarRascunho()).toBeNull();
  });

  it("rascunho sem clientKey ganha uma em vez de ser descartado", () => {
    const d = novoRascunho("walk", T0);
    localStorage.setItem("s2core:activity:draft", JSON.stringify({ ...d, clientKey: "" }));
    const r = carregarRascunho();
    expect(r).not.toBeNull();
    expect(r!.clientKey).toBeTruthy();
  });

  it("limpar remove", () => {
    gravarRascunho(novoRascunho("run", T0));
    limparRascunho();
    expect(carregarRascunho()).toBeNull();
  });

  it("uma atividade por aparelho — a chave é fixa", () => {
    gravarRascunho(novoRascunho("run", T0));
    gravarRascunho(novoRascunho("walk", T0 + 1000));
    expect(carregarRascunho()?.tipo).toBe("walk");
    expect(localStorage.length).toBe(1);
  });
});

describe("pausa e retomada (§22)", () => {
  it("pausar abre um intervalo; retomar fecha", () => {
    let d: ActivityDraft = novoRascunho("run", T0);
    expect(estaPausada(d)).toBe(false);
    d = pausar(d, T0 + 60_000);
    expect(estaPausada(d)).toBe(true);
    d = retomar(d, T0 + 90_000);
    expect(estaPausada(d)).toBe(false);
    expect(tempoPausadoMs(d, T0 + 120_000)).toBe(30_000);
  });

  it("pausar duas vezes seguidas não abre dois intervalos", () => {
    let d = pausar(novoRascunho("run", T0), T0 + 10_000);
    d = pausar(d, T0 + 20_000);
    expect(d.pausas).toHaveLength(1);
  });

  it("retomar sem pausa não faz nada", () => {
    const d = retomar(novoRascunho("run", T0), T0 + 10_000);
    expect(d.pausas).toHaveLength(0);
  });

  it("pausa em curso conta até agora", () => {
    const d = pausar(novoRascunho("run", T0), T0 + 60_000);
    expect(tempoPausadoMs(d, T0 + 120_000)).toBe(60_000);
  });

  it("o estado de pausa sobrevive ao app morrer", () => {
    const d = pausar(novoRascunho("run", T0), T0 + 60_000);
    gravarRascunho(d);
    expect(estaPausada(carregarRascunho()!)).toBe(true);
  });
});

describe("duração derivada de instantes absolutos", () => {
  it("duração ativa desconta as pausas", () => {
    let d = novoRascunho("run", T0);
    d = pausar(d, T0 + 600_000);   // 10 min correndo
    d = retomar(d, T0 + 900_000);  // 5 min parado
    // 20 min de parede aos T0+1200000, menos 5 de pausa = 15 ativos
    expect(duracaoAtivaS(d, T0 + 1_200_000)).toBe(900);
    expect(duracaoParedeS(d, T0 + 1_200_000)).toBe(1200);
  });

  it("a duração é DERIVADA — o tempo com a tela apagada não se perde", () => {
    // O JS congela e não conta nada, mas `startedAt` é absoluto: voltar 30 min
    // depois mostra 30 min, não zero.
    const d = novoRascunho("walk", T0);
    expect(duracaoAtivaS(d, T0 + 1_800_000)).toBe(1800);
  });

  it("nunca devolve duração negativa por relógio para trás", () => {
    const d = novoRascunho("run", T0);
    expect(duracaoAtivaS(d, T0 - 10_000)).toBe(0);
    expect(duracaoParedeS(d, T0 - 10_000)).toBe(0);
  });
});

describe("atividade ativa × esquecida (§35)", () => {
  it("gravação recente é atividade em curso", () => {
    gravarRascunho(novoRascunho("run", Date.now()));
    expect(atividadeAtiva(carregarRascunho()!)).toBe(true);
  });

  it("parada há mais de 6h esfriou", () => {
    const velho = Date.now() - 7 * 60 * 60 * 1000;
    localStorage.setItem(
      "s2core:activity:draft",
      JSON.stringify({ ...novoRascunho("run", velho), atualizadoEm: velho }),
    );
    expect(atividadeAtiva(carregarRascunho()!)).toBe(false);
  });
});

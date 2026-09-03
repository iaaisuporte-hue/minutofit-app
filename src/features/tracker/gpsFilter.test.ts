import { describe, expect, it } from "vitest";
import {
  calcularPace,
  calcularVelocidadeKmh,
  filtrarTrajetoria,
  formatarPace,
  metricaPrincipal,
  MOVIMENTO_MINIMO_M,
  PRECISAO_MAXIMA_M,
  SALTO_MAXIMO_M,
  type PontoBruto,
} from "./gpsFilter";

/**
 * Gera um ponto deslocado `metros` ao norte do anterior. 1 grau de latitude
 * ≈ 111.320 m, o que basta para montar trajetórias previsíveis.
 */
const GRAU_LAT_M = 111_320;
function norte(base: PontoBruto, metros: number, deltaMs: number, over: Partial<PontoBruto> = {}): PontoBruto {
  return {
    lat: base.lat + metros / GRAU_LAT_M,
    lng: base.lng,
    accuracy: 8,
    timestamp: base.timestamp + deltaMs,
    ...over,
  };
}

const P0: PontoBruto = { lat: -23.55, lng: -46.63, accuracy: 8, timestamp: 1_000_000 };

describe("filtrarTrajetoria — trajetória limpa", () => {
  it("soma os trechos de uma caminhada reta", () => {
    // 10 passos de 10 m a cada 5 s = 100 m
    let p = P0;
    const pts = [p];
    for (let i = 0; i < 10; i++) { p = norte(p, 10, 5000); pts.push(p); }
    const r = filtrarTrajetoria(pts, "walk");
    expect(r.pontos).toHaveLength(11);
    expect(r.distanciaKm).toBeCloseTo(0.1, 2);
    expect(Object.values(r.descartados).every((n) => n === 0)).toBe(true);
  });

  it("lista vazia ou um ponto não geram distância", () => {
    expect(filtrarTrajetoria([], "run").distanciaKm).toBe(0);
    expect(filtrarTrajetoria([P0], "run").distanciaKm).toBe(0);
  });

  it("coordenada inválida é ignorada sem quebrar", () => {
    const r = filtrarTrajetoria(
      [P0, { lat: NaN, lng: -46.63, timestamp: 1_005_000 }, norte(P0, 10, 10_000)],
      "walk",
    );
    expect(r.distanciaKm).toBeCloseTo(0.01, 3);
  });
});

describe("filtrarTrajetoria — as quatro rejeições (§28)", () => {
  it("descarta ponto com precisão pior que o limite", () => {
    const ruim = norte(P0, 10, 5000, { accuracy: PRECISAO_MAXIMA_M + 1 });
    const bom = norte(P0, 20, 10_000);
    const r = filtrarTrajetoria([P0, ruim, bom], "walk");
    expect(r.descartados.precisao).toBe(1);
    // A distância é medida do P0 até o ponto BOM — o ruim não entra no meio.
    expect(r.distanciaKm).toBeCloseTo(0.02, 3);
  });

  it("descarta teleporte — o salto não vira distância percorrida", () => {
    const salto = norte(P0, SALTO_MAXIMO_M + 50, 2000);
    const r = filtrarTrajetoria([P0, salto], "walk");
    expect(r.descartados.salto).toBe(1);
    expect(r.distanciaKm).toBe(0);
  });

  it("descarta velocidade irreal para a modalidade", () => {
    // 100 m em 2 s = 180 km/h. Impossível a pé; e o salto (100m) está abaixo
    // do teto de 200 m, então quem tem que pegar é a checagem de velocidade.
    const r = filtrarTrajetoria([P0, norte(P0, 100, 2000)], "walk");
    expect(r.descartados.velocidade).toBe(1);
    expect(r.distanciaKm).toBe(0);
  });

  it("o mesmo trecho é ACEITO na bicicleta — o teto é por modalidade", () => {
    // 100 m em 10 s = 36 km/h: absurdo caminhando, normal pedalando.
    expect(filtrarTrajetoria([P0, norte(P0, 100, 10_000)], "walk").descartados.velocidade).toBe(1);
    expect(filtrarTrajetoria([P0, norte(P0, 100, 10_000)], "cycling").distanciaKm).toBeCloseTo(0.1, 2);
  });

  it("descarta a deriva do aparelho parado", () => {
    // Deriva real OSCILA em torno de um ponto — não marcha numa direção. 60
    // leituras alternando ±2 m com o telefone na mesa: sem o filtro, cada
    // oscilação virava distância e o total passava de 100 m parado.
    const pts: PontoBruto[] = [P0];
    for (let i = 0; i < 60; i++) {
      pts.push(norte(P0, i % 2 === 0 ? MOVIMENTO_MINIMO_M - 1 : 0, (i + 1) * 1000));
    }
    const r = filtrarTrajetoria(pts, "walk");
    expect(r.descartados.parado).toBe(60);
    expect(r.distanciaKm).toBe(0);
  });

  it("mas NÃO descarta caminhada lenta legítima — passos somam", () => {
    // Passos de 4 m: acima do piso, então contam. O filtro não pode transformar
    // caminhada de idoso em "parado".
    let p = P0;
    const pts = [p];
    for (let i = 0; i < 25; i++) { p = norte(p, 4, 4000); pts.push(p); }
    const r = filtrarTrajetoria(pts, "walk");
    expect(r.descartados.parado).toBe(0);
    expect(r.distanciaKm).toBeCloseTo(0.1, 2);
  });
});

describe("filtrarTrajetoria — o efeito no número final", () => {
  it("ruído inflava a distância; o filtro devolve a caminhada real", () => {
    // 500 m reais, com 20 leituras de deriva e 3 teleportes no meio.
    let p = P0;
    const pts: PontoBruto[] = [p];
    for (let i = 0; i < 50; i++) {
      p = norte(p, 10, 6000);
      pts.push(p);
      if (i % 17 === 0) {
        // teleporte que volta — o padrão clássico de perda de fix
        pts.push({ ...norte(p, SALTO_MAXIMO_M + 100, 500), accuracy: 8 });
      }
      if (i % 10 === 0) pts.push(norte(p, 1, 1000)); // deriva
    }
    const r = filtrarTrajetoria(pts, "walk");
    expect(r.distanciaKm).toBeCloseTo(0.5, 1);
    expect(r.descartados.salto).toBeGreaterThan(0);
    expect(r.descartados.parado).toBeGreaterThan(0);
  });
});

describe("elevação", () => {
  it("acumula só a subida, e só acima do ruído vertical", () => {
    const pts = [
      { ...P0, altitude: 700 },
      { ...norte(P0, 20, 10_000), altitude: 710 },   // +10 sobe
      { ...norte(P0, 40, 20_000), altitude: 705 },   // desce: não conta
      { ...norte(P0, 60, 30_000), altitude: 705.5 }, // +0,5: ruído, não conta
      { ...norte(P0, 80, 40_000), altitude: 715 },   // +9,5 sobe
    ];
    expect(filtrarTrajetoria(pts, "walk").ganhoElevacaoM).toBe(20);
  });
});

describe("pace e velocidade (§30, §21)", () => {
  it("pace é tempo ativo por distância", () => {
    expect(calcularPace(1800, 5)).toBeCloseTo(6, 5); // 30 min / 5 km
  });

  it("distância zero devolve null, não zero — 0:00/km seria o pace mais rápido possível", () => {
    expect(calcularPace(600, 0)).toBeNull();
    expect(formatarPace(calcularPace(600, 0))).toBe("--");
  });

  it("duração zero devolve null", () => {
    expect(calcularPace(0, 5)).toBeNull();
  });

  it("o tempo pausado não piora o pace", () => {
    // 40 min de parede, 30 ativos, 5 km: o pace é o dos 30.
    expect(calcularPace(1800, 5)).toBeCloseTo(6, 5);
    expect(calcularPace(2400, 5)).toBeCloseTo(8, 5);
  });

  it("formata como se lê pace, não como decimal", () => {
    expect(formatarPace(6.4)).toBe("6:24");
    expect(formatarPace(5)).toBe("5:00");
    expect(formatarPace(6.999)).toBe("7:00"); // nunca 6:60
    expect(formatarPace(null)).toBe("--");
  });

  it("velocidade em km/h", () => {
    expect(calcularVelocidadeKmh(3600, 25)).toBeCloseTo(25, 5);
    expect(calcularVelocidadeKmh(1800, 0)).toBeNull();
  });
});

describe("metricaPrincipal — a unidade certa por modalidade", () => {
  it("bike mostra velocidade, não pace", () => {
    const m = metricaPrincipal("cycling", 3600, 25);
    expect(m).toEqual({ valor: "25.0", unidade: "km/h", rotulo: "Velocidade média" });
  });

  it("corrida e caminhada mostram pace", () => {
    expect(metricaPrincipal("run", 1800, 5)).toEqual({ valor: "6:00", unidade: "/km", rotulo: "Pace médio" });
    expect(metricaPrincipal("walk", 3600, 5).unidade).toBe("/km");
  });

  it("sem distância, a métrica não inventa número", () => {
    expect(metricaPrincipal("run", 600, 0).valor).toBe("--");
    expect(metricaPrincipal("cycling", 600, 0).valor).toBe("--");
  });
});

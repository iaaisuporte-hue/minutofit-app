import { describe, expect, it } from "vitest";
import { eyebrowDaAtividade, focoDaAtividade, linhasDaAtividade, textoDaAtividade } from "./activityShare";
import type { Activity } from "./types";

const corrida = (over: Partial<Activity> = {}): Activity => ({
  id: "1", type: "run", startTime: new Date(), distance: 5.14, pace: 6.35,
  duration: 1962, routeCoordinates: [{ lat: -23.55, lng: -46.63 }], calories: 410, ...over,
});

describe("arte da atividade (§63/§65)", () => {
  it("a manchete nomeia a modalidade", () => {
    expect(eyebrowDaAtividade("run")).toBe("CORRIDA CONCLUÍDA");
    expect(eyebrowDaAtividade("walk")).toBe("CAMINHADA CONCLUÍDA");
    expect(eyebrowDaAtividade("cycling")).toBe("CICLISMO CONCLUÍDA");
  });

  it("o destaque é a distância quando houve percurso", () => {
    expect(focoDaAtividade(corrida())).toBe("5,14 km");
  });

  it("sem distância, o destaque é o tempo — esteira não mostra 0,00 km", () => {
    expect(focoDaAtividade(corrida({ distance: 0, duration: 2400 }))).toBe("40 min");
  });

  it("lista duração, distância, pace e calorias", () => {
    const l = linhasDaAtividade(corrida());
    expect(l.map((x) => x.name)).toEqual(["Duração", "Distância", "Pace médio", "Calorias"]);
    expect(l[0].reps).toBe("32:42");
    expect(l[1].reps).toBe("5,14 km");
    expect(l[2].reps).toBe("6:22 /km");
    expect(l[3].reps).toBe("410 kcal");
  });

  it("bike mostra velocidade, não pace (§21)", () => {
    const l = linhasDaAtividade(corrida({ type: "cycling", distance: 25, duration: 3600 }));
    expect(l.map((x) => x.name)).toContain("Velocidade média");
    expect(l.map((x) => x.name)).not.toContain("Pace médio");
    expect(l.find((x) => x.name === "Velocidade média")?.reps).toBe("25,0 km/h");
  });

  it("métrica ausente não vira linha com '--'", () => {
    const l = linhasDaAtividade(corrida({ distance: 0, calories: 0 }));
    expect(l.map((x) => x.name)).toEqual(["Duração"]);
  });

  it("duração acima de uma hora mostra horas", () => {
    expect(linhasDaAtividade(corrida({ duration: 5445 }))[0].reps).toBe("1:30:45");
  });
});

describe("privacidade da arte (§32)", () => {
  it("a ROTA nunca aparece — nem nas linhas, nem no texto", () => {
    const a = corrida({ routeCoordinates: [{ lat: -23.5505, lng: -46.6333 }] });
    const serializado = JSON.stringify(linhasDaAtividade(a)) + textoDaAtividade(a);
    expect(serializado).not.toContain("-23.55");
    expect(serializado).not.toContain("lat");
    expect(serializado).not.toContain("lng");
  });

  it("o texto não expõe horário nem local de partida", () => {
    const t = textoDaAtividade(corrida({ startTime: new Date("2026-09-01T06:12:00Z") }));
    expect(t).not.toMatch(/06:12|2026-09-01/);
    expect(t).toContain("Corrida concluída");
    expect(t).toContain("5,14 km");
  });
});

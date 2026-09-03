import { describe, expect, it } from "vitest";
import { faixaDeDistancia, type ActivityEventPayload } from "./activityEvents";

describe("faixaDeDistancia — distância exata nunca sai em analytics (§70)", () => {
  it("classifica em faixas", () => {
    expect(faixaDeDistancia(0)).toBe("0");
    expect(faixaDeDistancia(0.4)).toBe("0-1km");
    expect(faixaDeDistancia(3.2)).toBe("1-5km");
    expect(faixaDeDistancia(7.8)).toBe("5-10km");
    expect(faixaDeDistancia(21.1)).toBe("10km+");
  });

  it("valores inválidos caem em zero, não em NaN", () => {
    expect(faixaDeDistancia(NaN)).toBe("0");
    expect(faixaDeDistancia(-5)).toBe("0");
    // Infinity não é distância: cai em "0" junto com NaN, e não na faixa mais
    // alta — classificar lixo como "10km+" poluiria a métrica de produto.
    expect(faixaDeDistancia(Infinity)).toBe("0");
  });
});

describe("contrato do payload", () => {
  it("o tipo não admite coordenada, endereço nem horário exato", () => {
    // Este teste é de TIPO: se alguém acrescentar `lat`, `lng`, `route` ou
    // `startedAt` ao payload, o `@ts-expect-error` deixa de ser erro e o teste
    // quebra na compilação — que é o momento certo de barrar.
    const p: ActivityEventPayload = { activityType: "run", distanceBand: "5-10km", hasRoute: true };
    expect(p.hasRoute).toBe(true);
    // @ts-expect-error coordenada não pode existir neste payload
    const proibido: ActivityEventPayload = { lat: -23.5, lng: -46.6 };
    expect(proibido).toBeDefined();
  });
});

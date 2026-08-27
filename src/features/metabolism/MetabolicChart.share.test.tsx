import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetabolicChart } from "./MetabolicChart";
import { dayKey } from "../../lib/appDay";

// ResponsiveContainer não mede em jsdom; fixa um tamanho para o gráfico existir.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div style={{ width: 600, height: 220 }}>{children}</div>
  ) };
});

const today = dayKey();
const yesterday = dayKey(new Date(Date.now() - 864e5));

const data = [
  { date: yesterday, score: 60 },
  { date: today, score: 66 },
];

describe("MetabolicChart — compartilhar o treino de hoje", () => {
  it("só oferece a ação no dia corrente, e só com treino registrado", () => {
    const onTodayWorkoutClick = vi.fn();
    render(
      <MetabolicChart
        data={data}
        loading={false}
        forecast={null}
        markers={[
          { date: yesterday, kind: "workout", label: "Treino" },
          { date: today, kind: "workout", label: "Treino" },
        ]}
        onTodayWorkoutClick={onTodayWorkoutClick}
      />,
    );
    // Só o dia corrente vira ação: o chip de ontem segue como leitura.
    // (O marcador SVG dentro do gráfico expõe a mesma ação, mas o recharts não
    // desenha pontos em jsdom — sem largura medida não há layout —, então essa
    // metade é verificada em navegador, não aqui.)
    const buttons = screen.getAllByRole("button", { name: /Compartilhar o treino de hoje/i });
    expect(buttons).toHaveLength(1);
    buttons[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onTodayWorkoutClick).toHaveBeenCalledTimes(1);
  });

  it("sem a prop (cockpit do personal) o gráfico continua só leitura", () => {
    render(
      <MetabolicChart
        data={data}
        loading={false}
        forecast={null}
        markers={[{ date: today, kind: "workout", label: "Treino" }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /Compartilhar o treino de hoje/i })).toBeNull();
  });
});

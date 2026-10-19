/**
 * P0 "Feito → diário" — o convite pós-"Segui" (componente, card da Hoje e
 * drawer da página do plano). Regras travadas aqui:
 *  - "Segui" continua sendo só adesão: nada vai ao diário sem confirmação;
 *  - sucesso só aparece DEPOIS da resposta do servidor;
 *  - plano só texto nunca mostra número presumido;
 *  - refeição já registrada não oferece o registro integral de novo.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MealTimeline, MealTimelineEntry } from "../../services/nutriApi";

const registerPlanMealAsPlanned = vi.fn();
const getDayIntake = vi.fn();
const fetchMealTimeline = vi.fn();
const recordMealCheckin = vi.fn();
const sheetProps: Array<{ open: boolean; defaultMealId?: number | null }> = [];

vi.mock("../../services/nutritionIntakeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutritionIntakeApi")>();
  return {
    ...actual,
    registerPlanMealAsPlanned: (...a: unknown[]) => registerPlanMealAsPlanned(...a),
    getDayIntake: () => getDayIntake(),
  };
});
vi.mock("../../services/nutriApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/nutriApi")>();
  return {
    ...actual,
    fetchMealTimeline: () => fetchMealTimeline(),
    recordMealCheckin: (...a: unknown[]) => recordMealCheckin(...a),
  };
});
vi.mock("../../auth/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    loading: false, planName: "Free", features: [], refresh: vi.fn(),
    hasFeature: (key: string) => key === "nutrition_intake",
  }),
}));
vi.mock("./IntakeLogSheet", () => ({
  IntakeLogSheet: (props: { open: boolean; defaultMealId?: number | null }) => {
    sheetProps.push(props);
    return props.open ? <div data-testid="intake-sheet" data-meal={String(props.defaultMealId)} /> : null;
  },
}));
vi.mock("./usePushSubscription", () => ({ usePushSubscription: () => {} }));
vi.mock("./NutritionDaySummary", () => ({
  NutritionDaySummary: ({ refreshToken }: { refreshToken?: number }) => <div data-testid="day-summary" data-refresh={String(refreshToken ?? 0)} />,
}));
vi.mock("./NutritionTargetCard", () => ({ default: () => null }));
vi.mock("./DietaryProfileCard", () => ({ default: () => null }));

import { PlanMealConsumptionPrompt } from "./PlanMealConsumptionPrompt";
import { NutritionCheckinCard } from "./NutritionCheckinCard";
import NutritionPlanViewPage from "../../pages/user/NutritionPlanViewPage";

const ITEM = (id: number, foodName: string, kcal: number, p: number, c: number, f: number, grams = 50) => ({
  id, foodId: 1, customFoodId: null, quantity: grams, unitType: "grams" as const, measureId: null, customMeasureId: null,
  grams, orderIndex: 0, notes: null, foodName, energyKcal: kcal, proteinG: p, carbohydrateG: c, fatG: f, fiberG: null,
});

function meal(over: Partial<MealTimelineEntry> = {}): MealTimelineEntry {
  return {
    id: 11, plan_id: 1, name: "Café da manhã", orientation: "Pão com ovo", order_index: 0,
    meal_time: null, tolerance_minutes: null, reminder_minutes: null, metabolic_goal: null, workout_relation: null,
    hydration_note: null, supplement_note: null, alternatives: [],
    items: [ITEM(101, "Pão", 200, 8, 36, 3), ITEM(102, "Ovo", 100, 12, 4, 5)],
    totals: { energyKcal: 300, proteinG: 20, carbohydrateG: 40, fatG: 8 },
    status: "upcoming", checkin: null, intakeToday: null,
    ...over,
  } as MealTimelineEntry;
}
const TEXT_ONLY = () => meal({ id: 12, name: "Lanche", items: [], totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 } });
const LOG = (energyKcal = 300) => ({ id: 900, mealId: 11, energyKcal, proteinG: 20, carbohydrateG: 40, fatG: 8 }) as never;

function timeline(meals: MealTimelineEntry[]): MealTimeline {
  return { plan_id: 1, title: "Plano", objective: "maintenance", general_notes: null, nutri_name: "Dra. Ana", today: "2026-10-19", meals, workoutToday: null, streak: 0 } as unknown as MealTimeline;
}

beforeEach(() => {
  [registerPlanMealAsPlanned, getDayIntake, fetchMealTimeline, recordMealCheckin].forEach((f) => f.mockReset());
  getDayIntake.mockResolvedValue({ logs: [], meals: [], totals: { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 }, target: null });
  recordMealCheckin.mockResolvedValue({});
  sheetProps.length = 0;
});

describe("PlanMealConsumptionPrompt", () => {
  it("refeição estruturada: pergunta, prévia com os valores do plano e as duas ações", () => {
    render(<PlanMealConsumptionPrompt meal={meal()} onRegistered={vi.fn()} onOpenIntake={vi.fn()} />);
    expect(screen.getByText("Você consumiu os alimentos e quantidades previstos no plano?")).toBeInTheDocument();
    expect(screen.getByText("Pão (50 g), Ovo (50 g)")).toBeInTheDocument();
    expect(screen.getByText("300 kcal · P 20 g · C 40 g · G 8 g")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sim, registrar conforme o plano" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comi algo diferente" })).toBeInTheDocument();
  });

  it("'Sim': envia os ids dos itens, trava durante o envio e só mostra sucesso após o servidor", async () => {
    let resolve!: (v: unknown) => void;
    registerPlanMealAsPlanned.mockImplementation(() => new Promise((r) => { resolve = r; }));
    const onRegistered = vi.fn();
    render(<PlanMealConsumptionPrompt meal={meal()} onRegistered={onRegistered} onOpenIntake={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Sim, registrar conforme o plano" }));
    expect(registerPlanMealAsPlanned).toHaveBeenCalledWith({ id: 11, name: "Café da manhã", itemIds: [101, 102] });
    const busy = screen.getByRole("button", { name: "Registrando..." });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(registerPlanMealAsPlanned).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Registrado no seu dia/)).not.toBeInTheDocument();
    expect(onRegistered).not.toHaveBeenCalled();

    resolve({ log: LOG(), alreadyLogged: false });
    expect(await screen.findByText("Registrado no seu dia · 300 kcal")).toBeInTheDocument();
    expect(onRegistered).toHaveBeenCalledTimes(1);
  });

  it("falha do servidor: mensagem de erro, sem sucesso, ações continuam disponíveis", async () => {
    registerPlanMealAsPlanned.mockRejectedValue(new Error("500"));
    const onRegistered = vi.fn();
    render(<PlanMealConsumptionPrompt meal={meal()} onRegistered={onRegistered} onOpenIntake={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Sim, registrar conforme o plano" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível registrar agora.");
    expect(onRegistered).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sim, registrar conforme o plano" })).toBeEnabled();
  });

  it("409 (já registrada por outro caminho): mostra 'já registrado' com o valor do servidor", async () => {
    registerPlanMealAsPlanned.mockResolvedValue({ log: LOG(120), alreadyLogged: true });
    render(<PlanMealConsumptionPrompt meal={meal()} onRegistered={vi.fn()} onOpenIntake={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Sim, registrar conforme o plano" }));
    expect(await screen.findByText("Consumo já registrado hoje · 120 kcal")).toBeInTheDocument();
  });

  it("'Comi algo diferente' abre o fluxo de registro existente, sem registrar nada", async () => {
    const onOpenIntake = vi.fn();
    render(<PlanMealConsumptionPrompt meal={meal()} onRegistered={vi.fn()} onOpenIntake={onOpenIntake} />);
    await userEvent.click(screen.getByRole("button", { name: "Comi algo diferente" }));
    expect(onOpenIntake).toHaveBeenCalledTimes(1);
    expect(registerPlanMealAsPlanned).not.toHaveBeenCalled();
  });

  it("plano só texto: mensagem honesta, nenhum número presumido, abre o registro manual", async () => {
    const onOpenIntake = vi.fn();
    render(<PlanMealConsumptionPrompt meal={TEXT_ONLY()} onRegistered={vi.fn()} onOpenIntake={onOpenIntake} />);
    expect(screen.getByText(/Seu plano não possui quantidades definidas/)).toBeInTheDocument();
    expect(screen.queryByText(/kcal/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conforme o plano/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Registrar o que comi" }));
    expect(onOpenIntake).toHaveBeenCalled();
  });

  it("refeição já registrada hoje: não oferece o registro integral; leva à edição", async () => {
    const onOpenIntake = vi.fn();
    render(<PlanMealConsumptionPrompt meal={meal({ intakeToday: { logId: 900, energyKcal: 410 } })} onRegistered={vi.fn()} onOpenIntake={onOpenIntake} />);
    expect(screen.getByText("Consumo já registrado hoje · 410 kcal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conforme o plano/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Ver ou editar registro/ }));
    expect(onOpenIntake).toHaveBeenCalled();
  });
});

describe("NutritionCheckinCard (Hoje) — convite pós-'Segui'", () => {
  function renderCard() {
    return render(<MemoryRouter><NutritionCheckinCard /></MemoryRouter>);
  }

  it("'Segui' grava só adesão e mostra o convite da refeição marcada, mesmo com o card já na próxima", async () => {
    fetchMealTimeline.mockResolvedValue(timeline([meal({ status: "due_now" }), meal({ id: 13, name: "Almoço", status: "upcoming" })]));
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Segui" }));

    expect(recordMealCheckin).toHaveBeenCalledWith(11, { status: "done" });
    expect(registerPlanMealAsPlanned).not.toHaveBeenCalled();
    expect(await screen.findByText("Café da manhã · Feito")).toBeInTheDocument();
    expect(screen.getByText("Você consumiu os alimentos e quantidades previstos no plano?")).toBeInTheDocument();
    // O card avançou para a próxima refeição (Almoço) e o convite segue preso ao café.
    expect(screen.getByText("Almoço")).toBeInTheDocument();
  });

  it("confirmar recarrega o dia; 'Comi algo diferente' abre a folha na refeição marcada; 'Agora não' dispensa", async () => {
    fetchMealTimeline.mockResolvedValue(timeline([meal({ status: "due_now" }), meal({ id: 13, name: "Almoço", status: "upcoming" })]));
    registerPlanMealAsPlanned.mockResolvedValue({ log: LOG(), alreadyLogged: false });
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Segui" }));
    const callsBefore = getDayIntake.mock.calls.length;
    await userEvent.click(await screen.findByRole("button", { name: "Sim, registrar conforme o plano" }));
    expect(await screen.findByText("Registrado no seu dia · 300 kcal")).toBeInTheDocument();
    await waitFor(() => expect(getDayIntake.mock.calls.length).toBeGreaterThan(callsBefore));

    await userEvent.click(screen.getByRole("button", { name: /Ver ou editar registro/ }));
    expect(screen.getByTestId("intake-sheet")).toHaveAttribute("data-meal", "11");

    await userEvent.click(screen.getByRole("button", { name: "Agora não" }));
    expect(screen.queryByText("Café da manhã · Feito")).not.toBeInTheDocument();
  });

  it("'Pulei' não oferece registro de consumo", async () => {
    fetchMealTimeline.mockResolvedValue(timeline([meal({ status: "due_now" }), meal({ id: 13, name: "Almoço", status: "upcoming" })]));
    renderCard();
    await userEvent.click(await screen.findByRole("button", { name: "Pulei" }));
    expect(recordMealCheckin).toHaveBeenCalledWith(11, { status: "skipped" });
    expect(screen.queryByText(/Você consumiu/)).not.toBeInTheDocument();
  });
});

describe("NutritionPlanViewPage — drawer da refeição", () => {
  function renderPage() {
    return render(<MemoryRouter><NutritionPlanViewPage /></MemoryRouter>);
  }

  it("'Segui' mantém o drawer aberto com o convite; confirmar atualiza o dia e o selo da timeline sem reload", async () => {
    fetchMealTimeline
      .mockResolvedValueOnce(timeline([meal({ status: "due_now" })]))
      .mockResolvedValueOnce(timeline([meal({ status: "done", intakeToday: { logId: 900, energyKcal: 300 } })]));
    registerPlanMealAsPlanned.mockResolvedValue({ log: LOG(), alreadyLogged: false });
    renderPage();

    await userEvent.click(await screen.findByText("Café da manhã"));
    const drawer = screen.getByRole("dialog", { name: "Café da manhã" });
    await userEvent.click(within(drawer).getByRole("button", { name: "Segui" }));

    expect(recordMealCheckin).toHaveBeenCalledWith(11, expect.objectContaining({ status: "done" }));
    expect(within(drawer).getByText(/Registrado — Feito/)).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: "Pulei" })).not.toBeInTheDocument();
    expect(screen.getByTestId("day-summary")).toHaveAttribute("data-refresh", "0");

    await userEvent.click(within(drawer).getByRole("button", { name: "Sim, registrar conforme o plano" }));
    expect(await within(drawer).findByText("Registrado no seu dia · 300 kcal")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("day-summary")).toHaveAttribute("data-refresh", "1"));
    await waitFor(() => expect(fetchMealTimeline).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No seu dia · 300 kcal")).toBeInTheDocument();
  });

  it("refeição já marcada e já registrada: reabrir mostra 'já registrado', sem oferecer o registro integral", async () => {
    fetchMealTimeline.mockResolvedValue(timeline([meal({ status: "done", intakeToday: { logId: 900, energyKcal: 300 } })]));
    renderPage();
    await userEvent.click(await screen.findByText("Café da manhã"));
    const drawer = screen.getByRole("dialog", { name: "Café da manhã" });
    expect(within(drawer).getByText("Consumo já registrado hoje · 300 kcal")).toBeInTheDocument();
    expect(within(drawer).queryByRole("button", { name: /conforme o plano/ })).not.toBeInTheDocument();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Apple 3.1.1: fora da storefront dos EUA, o app e a ficha não podem ter botão,
 * link ou chamada que leve a outro meio de pagamento — e "gerencie na versão
 * web" conta como chamada. O que PODE aparecer é o estado da conta (o plano
 * atual, o limite, que um recurso não está disponível).
 *
 * Fica de fora de propósito: a contratação de profissional
 * (MySubscriptionsSection, AddProfessionalSheet), que é serviço pessoa-a-pessoa
 * em tempo real — 3.1.3(d) cita "fitness training" como exemplo de pagamento
 * fora da compra in-app permitido.
 *
 * Os componentes rodam nas duas plataformas: no app nenhum texto comercial; na
 * web, a vitrine de sempre.
 */

const plataforma = vi.hoisted(() => ({ nativo: true }));
const plano = vi.hoisted(() => ({
  atual: { plan: "free", status: "active", studentLimit: 3, aiEnabled: false, currentPeriodEnd: null } as {
    plan: string; status: string; studentLimit: number | null; aiEnabled: boolean; currentPeriodEnd: string | null;
  },
}));
const convite = vi.hoisted(() => ({ createDirectInvite: vi.fn() }));

vi.mock("../lib/platform", () => ({
  isNativeApp: () => plataforma.nativo,
  getPlatform: () => (plataforma.nativo ? "ios" : "web"),
}));
vi.mock("../features/personalPlan/usePlan", () => ({ usePlan: () => plano.atual }));
vi.mock("../services/personalPlanApi", () => ({
  fetchPersonalPlan: vi.fn(async () => plano.atual),
  startPersonalCheckout: vi.fn(),
  cancelPersonalPlan: vi.fn(),
}));
vi.mock("../services/academyApi", () => ({ startAcademyCheckout: vi.fn() }));
vi.mock("../services/personalDirectInvitesApi", () => convite);
vi.mock("../features/performance/performanceEvents", () => ({ postPerformanceEvent: vi.fn() }));

const { UpgradeToProButton } = await import("../features/personalPlan/UpgradeToProButton");
const { AiUpgradeCTA } = await import("../features/personalPlan/AiUpgradeCTA");
const { StudentLimitBanner } = await import("../features/personalPlan/StudentLimitBanner");
const { AcademyUpgradeButton } = await import("../features/academyPlan/AcademyUpgradeButton");
const { IntelligenceUpsellCard } = await import("../features/academyPlan/IntelligenceUpsellCard");
const { PerformanceUpsell } = await import("../features/performance/PerformanceUpsell");
const { StudentInviteDrawer } = await import("../pages/personal/students/StudentInviteDrawer");

/** Tudo que soa como vitrine ou como "vá pagar em outro lugar". */
const COMERCIAL = /versão web|upgrade|assin|R\$|Premium|\bPro\b|Mercado Pago|checkout/i;

function semTextoComercial(container: HTMLElement) {
  expect(container.textContent ?? "").not.toMatch(COMERCIAL);
  expect(container.querySelector('a[href*="upgrade"], a[href*="checkout"]')).toBeNull();
}

beforeEach(() => {
  plataforma.nativo = true;
  plano.atual = { plan: "free", status: "active", studentLimit: 3, aiEnabled: false, currentPeriodEnd: null };
  convite.createDirectInvite.mockReset();
});

describe("no app empacotado — nenhuma chamada para comprar fora", () => {
  it("botões de compra do personal e da academia não existem", () => {
    const a = render(<UpgradeToProButton />);
    expect(a.container).toBeEmptyDOMElement();
    const b = render(<AcademyUpgradeButton />);
    expect(b.container).toBeEmptyDOMElement();
  });

  it("card de upsell da academia não existe", () => {
    const { container } = render(<IntelligenceUpsellCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("resumo IA fora do plano vira só o estado do recurso", () => {
    const { container } = render(<AiUpgradeCTA />);
    expect(screen.getByText(/não está disponível nesta conta/i)).toBeInTheDocument();
    semTextoComercial(container);
  });

  it("aviso de limite continua (explica o convite que não sai), sem nome de plano nem botão", () => {
    const { container } = render(<StudentLimitBanner studentCount={3} />);
    expect(screen.getByText(/Limite atingido: 3 de 3 alunos do seu plano atual/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Free|Starter/);
    semTextoComercial(container);
  });

  it.each(["progressao", "recordes", "evolucao", "metas"] as const)(
    "Premium do aluno (%s): sem vitrine nem link para /upgrade",
    (area) => {
      const { container } = render(<PerformanceUpsell area={area} />);
      expect(screen.getByText(/Não disponível nesta conta/i)).toBeInTheDocument();
      semTextoComercial(container);
    },
  );

  it("limite no convite: troca o 'Faça upgrade para o Pro' do servidor pelo fato", async () => {
    convite.createDirectInvite.mockRejectedValue(
      Object.assign(
        new Error("Seu plano permite 3 alunos e você já tem 3. Faça upgrade para o Pro para adicionar mais alunos."),
        { code: "STUDENT_LIMIT_REACHED" },
      ),
    );
    render(<StudentInviteDrawer open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /gerar|criar|convite/i }));
    expect(await screen.findByText("Você atingiu o limite de alunos do seu plano atual.")).toBeInTheDocument();
    expect(screen.queryByText(/Faça upgrade/i)).not.toBeInTheDocument();
  });
});

describe("na web — vitrine e checkout seguem como antes", () => {
  beforeEach(() => {
    plataforma.nativo = false;
  });

  it("botão de assinar o Pro continua", () => {
    render(<UpgradeToProButton />);
    expect(screen.getByRole("button", { name: /Assinar Pro/i })).toBeInTheDocument();
  });

  it("resumo IA mostra o plano e o preço", () => {
    render(<AiUpgradeCTA />);
    expect(screen.getByText(/Resumo IA disponível no plano Pro/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 89\/mês/).length).toBeGreaterThan(0);
  });

  it("aviso de limite nomeia o plano e oferece o Pro", () => {
    render(<StudentLimitBanner studentCount={3} />);
    expect(screen.getByText(/no plano Free/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assinar Pro/i })).toBeInTheDocument();
  });

  it("Premium do aluno mantém o convite", () => {
    render(<PerformanceUpsell area="recordes" />);
    expect(screen.getByRole("link", { name: /Ver o plano Premium/i })).toHaveAttribute("href", "/app/user/upgrade");
  });

  it("limite no convite mostra a mensagem do servidor", async () => {
    convite.createDirectInvite.mockRejectedValue(
      Object.assign(new Error("Seu plano permite 3 alunos e você já tem 3. Faça upgrade para o Pro para adicionar mais alunos."), {
        code: "STUDENT_LIMIT_REACHED",
      }),
    );
    render(<StudentInviteDrawer open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /gerar|criar|convite/i }));
    await waitFor(() => expect(screen.getByText(/Faça upgrade para o Pro/)).toBeInTheDocument());
  });
});

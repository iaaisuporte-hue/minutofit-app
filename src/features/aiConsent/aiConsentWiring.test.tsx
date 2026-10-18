import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";

/**
 * Onde o consentimento de IA encosta no resto do app (Spec 039): o titular do dado decide, e quem
 * pede a IA (profissional) vê com clareza quando ela está indisponível por causa dessa decisão —
 * sem que isso vire erro nem tire outra função de tela.
 */

const rede = vi.hoisted(() => ({
  respostas: [] as Array<(url: string, init?: RequestInit) => Response | undefined>,
  chamadas: [] as string[],
  consentimentoDoUsuario: false,
}));

vi.mock("../../services/apiClient", () => ({
  authFetch: async (url: string, init?: RequestInit) => {
    rede.chamadas.push(`${init?.method ?? "GET"} ${url}`);
    if (/\/user\/ai-consent$/.test(url)) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            granted: rede.consentimentoDoUsuario, grantedAt: null, version: null, revokedAt: null,
            currentVersion: "2026-10-18", needsReconsent: false,
          },
        }),
        { status: 200 },
      );
    }
    for (const r of rede.respostas) {
      const res = r(url, init);
      if (res) return res;
    }
    return new Response("{}", { status: 200 });
  },
}));
vi.mock("../../services/authTokens", async (orig) => ({ ...(await orig<object>()), getAccessToken: () => "token" }));
vi.mock("../../lib/externalLink", () => ({ handleExternal: vi.fn() }));
vi.mock("../personalPlan/usePlan", () => ({ usePlan: () => ({ aiEnabled: true, plan: "pro", studentLimit: null }) }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  rede.respostas = [];
  rede.chamadas = [];
  rede.consentimentoDoUsuario = false;
  localStorage.clear();
});

describe("metabolismo relê quando a autorização muda", () => {
  it("conceder ou revogar IA dispara nova leitura do /me/metabolism (a narrativa depende disso)", async () => {
    rede.respostas.push((url) => (/\/me\/metabolism$/.test(url) ? json({ score: 60, status: "good", trend: "stable", factors: [], recommendations: [] }) : undefined));
    const { useMetabolism } = await import("../metabolism/useMetabolism");
    const { AI_CONSENT_CHANGED_EVENT } = await import("../../services/aiConsentApi");

    renderHook(() => useMetabolism());
    await waitFor(() => expect(rede.chamadas.filter((c) => /me\/metabolism$/.test(c))).toHaveLength(1));

    window.dispatchEvent(new CustomEvent(AI_CONSENT_CHANGED_EVENT));
    await waitFor(() => expect(rede.chamadas.filter((c) => /me\/metabolism$/.test(c))).toHaveLength(2));
  });
});

describe("resumo IA do aluno (personal) — o titular é o aluno", () => {
  it("403 AI_CONSENT_REQUIRED vira um código próprio, não um erro genérico", async () => {
    rede.respostas.push((url) =>
      /ai-summary$/.test(url) ? json({ success: false, code: "AI_CONSENT_REQUIRED", subject: "student", error: "O aluno ainda não autorizou…" }, 403) : undefined,
    );
    const { fetchStudentAiSummary } = await import("../../services/personalDashboardApi");
    await expect(fetchStudentAiSummary("7")).rejects.toMatchObject({ code: "STUDENT_AI_CONSENT_REQUIRED" });
  });

  it("a aba explica que foi escolha do aluno (sem alarme vermelho) e mantém o resto disponível", async () => {
    rede.respostas.push((url) =>
      /ai-summary$/.test(url) ? json({ success: false, code: "AI_CONSENT_REQUIRED", subject: "student", error: "x" }, 403) : undefined,
    );
    const { CockpitTabAiSummary } = await import("../../pages/personal/cockpit/CockpitTabAiSummary");
    render(<CockpitTabAiSummary studentId="7" />);
    fireEvent.click(screen.getByRole("button", { name: /gerar resumo/i }));

    const aviso = await screen.findByRole("status");
    expect(aviso).toHaveTextContent(/aluno ainda não autorizou o uso de ia/i);
    expect(aviso).toHaveTextContent(/perfil › privacidade/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // O botão segue lá: o aluno pode mudar de ideia a qualquer momento.
    expect(screen.getByRole("button", { name: /gerar resumo/i })).toBeEnabled();
  });
});

describe("insight de performance — texto montado dos números quando o aluno não autorizou", () => {
  it("repassa o aviso do servidor, sem tratar como erro", async () => {
    rede.respostas.push((url) =>
      /performance\/insight$/.test(url)
        ? json({ success: true, data: { headline: "h", highlights: [], attentionPoints: [], nextStep: null, source: "deterministic", disclaimer: "d" }, aiConsentRequired: "student" })
        : undefined,
    );
    const { requestPerformanceInsight } = await import("../../services/personalPerformanceApi");
    const r = await requestPerformanceInsight("7");
    expect(r.source).toBe("deterministic");
    expect(r.aiConsentRequired).toBe("student");
  });

  it("sem o aviso, nada muda para quem usa", async () => {
    rede.respostas.push((url) =>
      /performance\/insight$/.test(url) ? json({ success: true, data: { headline: "h", source: "ai" } }) : undefined,
    );
    const { requestPerformanceInsight } = await import("../../services/personalPerformanceApi");
    expect((await requestPerformanceInsight("7")).aiConsentRequired).toBeUndefined();
  });
});

describe("gerador de ficha por IA (o pedido é texto do próprio personal)", () => {
  const props = {
    protocolSuggestions: [],
    suggestionsLoading: false,
    aiLoading: false,
    onGenerate: vi.fn(),
    onLoadProtocol: vi.fn(),
  };

  it("sem autorização: o convite aparece SEM 'Agora não', o botão fica desativado e o aviso de não incluir dados de alunos está lá", async () => {
    const { QuickStartCard } = await import("../../pages/personal/workoutBuilder/QuickStartCard");
    render(<QuickStartCard {...props} />);

    expect(await screen.findByRole("region", { name: /autorização de ia/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agora não" })).not.toBeInTheDocument();
    expect(screen.getByText(/não inclua nome nem dados pessoais de alunos/i)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "treino ABC para iniciantes" } });
    expect(screen.getByRole("button", { name: /gerar ficha com ia/i })).toBeDisabled();
  });

  it("com autorização: o convite some e a geração é liberada", async () => {
    rede.consentimentoDoUsuario = true;
    const { QuickStartCard } = await import("../../pages/personal/workoutBuilder/QuickStartCard");
    render(<QuickStartCard {...props} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "treino ABC para iniciantes" } });
    await waitFor(() => expect(screen.getByRole("button", { name: /gerar ficha com ia/i })).toBeEnabled());
    expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument();
  });

  it("se o servidor ainda assim recusar (403), o personal recebe a orientação, não 'erro genérico'", async () => {
    rede.respostas.push((url) =>
      /generate-workout$/.test(url) ? json({ success: false, code: "AI_CONSENT_REQUIRED", subject: "self", error: "x" }, 403) : undefined,
    );
    const { generateWorkoutWithAi } = await import("../../services/aiWorkoutApi");
    await expect(generateWorkoutWithAi("treino", [])).rejects.toThrow(/autorize o uso de ia em privacidade/i);
  });
});

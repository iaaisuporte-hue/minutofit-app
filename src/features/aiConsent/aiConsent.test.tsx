import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Consentimento de IA no cliente (Spec 039). O servidor é quem barra; aqui se prova que a tela:
 * pede de forma explícita e sem pré-marcar, aceita a recusa sem tirar funções, mostra o estado
 * REAL do servidor (nunca presume), permite revogar e não se confunde com o banner de cookies.
 */

type Estado = {
  granted: boolean;
  grantedAt: string | null;
  version: string | null;
  revokedAt: string | null;
  currentVersion: string;
  needsReconsent: boolean;
};

const servidor = vi.hoisted(() => ({
  estado: null as unknown as Estado,
  falhaNoPost: false,
  falhaNoGet: false,
  chamadas: [] as Array<{ method: string; body?: string }>,
}));

const semConsentimento = (): Estado => ({
  granted: false, grantedAt: null, version: null, revokedAt: null, currentVersion: "2026-10-18", needsReconsent: false,
});

vi.mock("../../services/apiClient", () => ({
  authFetch: async (_url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    servidor.chamadas.push({ method, body: typeof init.body === "string" ? init.body : undefined });
    if (method === "GET" && servidor.falhaNoGet) return new Response(JSON.stringify({ error: "x" }), { status: 500 });
    if (method === "POST") {
      if (servidor.falhaNoPost) return new Response(JSON.stringify({ error: "x" }), { status: 500 });
      servidor.estado = { ...servidor.estado, granted: true, grantedAt: "2026-10-18T12:00:00.000Z", version: "2026-10-18", revokedAt: null };
    }
    if (method === "DELETE") {
      servidor.estado = { ...servidor.estado, granted: false, revokedAt: "2026-10-19T09:00:00.000Z" };
    }
    return new Response(JSON.stringify({ success: true, data: servidor.estado }), { status: 200 });
  },
}));
vi.mock("../../lib/externalLink", () => ({ handleExternal: vi.fn() }));

const { AiConsentCard } = await import("./AiConsentCard");
const { AiPrivacySection } = await import("./AiPrivacySection");
const { useAiConsent } = await import("./useAiConsent");
const { COOKIE_CONSENT_STORAGE_KEY, writeCookieConsent } = await import("../../lib/cookieConsent");

beforeEach(() => {
  servidor.estado = semConsentimento();
  servidor.falhaNoPost = false;
  servidor.falhaNoGet = false;
  servidor.chamadas.length = 0;
  localStorage.clear();
});

describe("AiConsentCard — pedido explícito e sem pressão", () => {
  it("explica finalidade, provedor, o que NÃO vai, que é opcional e linka a política; nada vem marcado", async () => {
    render(<AiConsentCard finalidade="o seu score metabólico e os fatores do dia" />);
    const card = await screen.findByRole("region", { name: /autorização de ia/i });

    expect(card).toHaveTextContent(/inteligência artificial/i);
    expect(card).toHaveTextContent(/OpenAI/);
    expect(card).toHaveTextContent("o seu score metabólico e os fatores do dia");
    expect(card).toHaveTextContent(/sem o seu nome, e-mail, telefone ou CPF/i);
    expect(card).toHaveTextContent(/opcional/i);
    expect(card).toHaveTextContent(/o app funciona normalmente/i);
    expect(screen.getByRole("link", { name: /política de ia/i })).toHaveAttribute("href", "https://s2core.com.br/politica-ia");
    // Dois caminhos de peso igual; nenhum checkbox pré-marcado.
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agora não" })).toBeInTheDocument();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    // Nada foi gravado só por abrir a tela.
    expect(servidor.chamadas.every((c) => c.method === "GET")).toBe(true);
  });

  it("Autorizar manda o aceite literal ao servidor e o convite some", async () => {
    const aoAutorizar = vi.fn();
    render(<AiConsentCard finalidade="x" onGranted={aoAutorizar} />);
    fireEvent.click(await screen.findByRole("button", { name: "Autorizar" }));

    await waitFor(() => expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument());
    expect(servidor.chamadas.find((c) => c.method === "POST")?.body).toBe(JSON.stringify({ accepted: true }));
    expect(aoAutorizar).toHaveBeenCalledTimes(1);
  });

  it("falha ao registrar → mostra o erro, NÃO considera autorizado e mantém o convite", async () => {
    servidor.falhaNoPost = true;
    render(<AiConsentCard finalidade="x" />);
    fireEvent.click(await screen.findByRole("button", { name: "Autorizar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível registrar/i);
    expect(screen.getByRole("region", { name: /autorização de ia/i })).toBeInTheDocument();
  });

  it("Agora não: recusa sem consequência, nada é gravado no servidor, e o convite não volta logo", async () => {
    const { unmount } = render(<AiConsentCard finalidade="x" />);
    fireEvent.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument();
    expect(servidor.chamadas.some((c) => c.method !== "GET")).toBe(false);
    unmount();

    render(<AiConsentCard finalidade="x" />);
    await waitFor(() => expect(servidor.chamadas.length).toBeGreaterThan(1));
    expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument();
  });

  it("quando o recurso depende da autorização (dismissible=false) não há 'Agora não' para esconder o pedido", async () => {
    render(<AiConsentCard finalidade="x" dismissible={false} />);
    await screen.findByRole("button", { name: "Autorizar" });
    expect(screen.queryByRole("button", { name: "Agora não" })).not.toBeInTheDocument();
  });

  it("já autorizado → não aparece; política atualizada → pede de novo, dizendo por quê", async () => {
    servidor.estado = { ...semConsentimento(), granted: true, grantedAt: "2026-10-18T12:00:00.000Z", version: "2026-10-18" };
    const { unmount } = render(<AiConsentCard finalidade="x" />);
    await waitFor(() => expect(servidor.chamadas.length).toBeGreaterThan(0));
    expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument();
    unmount();

    servidor.estado = { ...semConsentimento(), needsReconsent: true, version: "2020-01-01" };
    render(<AiConsentCard finalidade="x" />);
    expect(await screen.findByText(/atualizamos a política de ia/i)).toBeInTheDocument();
  });

  it("se não dá para consultar o servidor, NÃO presume nada: não aparece como autorizado nem insiste", async () => {
    servidor.falhaNoGet = true;
    render(<AiConsentCard finalidade="x" />);
    await waitFor(() => expect(servidor.chamadas.length).toBeGreaterThan(0));
    expect(screen.queryByRole("region", { name: /autorização de ia/i })).not.toBeInTheDocument();
  });
});

describe("independência do banner de cookies/analytics", () => {
  it("aceitar cookies de analytics NÃO autoriza IA", async () => {
    writeCookieConsent(true);
    render(<AiConsentCard finalidade="x" />);
    expect(await screen.findByRole("region", { name: /autorização de ia/i })).toBeInTheDocument();
  });

  it("autorizar IA NÃO mexe na decisão de cookies", async () => {
    writeCookieConsent(false);
    const antes = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    render(<AiConsentCard finalidade="x" />);
    fireEvent.click(await screen.findByRole("button", { name: "Autorizar" }));
    await waitFor(() => expect(servidor.estado.granted).toBe(true));
    expect(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe(antes);
  });
});

describe("AiPrivacySection — consultar, revogar, autorizar de novo", () => {
  it("mostra o estado do servidor; revogar vale na hora e o botão passa a autorizar de novo", async () => {
    servidor.estado = { ...semConsentimento(), granted: true, grantedAt: "2026-10-18T12:00:00.000Z", version: "2026-10-18" };
    render(<AiPrivacySection audience="aluno" />);

    expect(await screen.findByText(/autorizado desde/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /revogar autorização/i }));

    expect(await screen.findByText(/revogado em/i)).toBeInTheDocument();
    expect(servidor.chamadas.some((c) => c.method === "DELETE")).toBe(true);
    expect(screen.getByRole("button", { name: "Autorizar" })).toBeInTheDocument();
  });

  it("o texto muda por público: aluno autoriza dado dele; profissional, o texto do pedido (e não consente pelo aluno)", async () => {
    const { unmount } = render(<AiPrivacySection audience="aluno" />);
    expect(await screen.findByText(/score\s+metabólico/i)).toBeInTheDocument();
    unmount();

    render(<AiPrivacySection audience="profissional" />);
    expect(await screen.findByText(/texto que você escreve ao pedir uma\s+ficha/i)).toBeInTheDocument();
    expect(screen.getByText(/dependem da autorização do próprio aluno/i)).toBeInTheDocument();
  });

  it("política atualizada pede autorização de novo", async () => {
    servidor.estado = { ...semConsentimento(), needsReconsent: true, version: "2020-01-01" };
    render(<AiPrivacySection audience="aluno" />);
    expect(await screen.findByRole("button", { name: /autorizar de novo/i })).toBeInTheDocument();
  });
});

describe("estado compartilhado entre telas", () => {
  function Dois() {
    const a = useAiConsent();
    const b = useAiConsent();
    return (
      <>
        <span data-testid="a">{String(a.granted)}</span>
        <span data-testid="b">{String(b.granted)}</span>
        <button onClick={() => void a.grant()}>conceder</button>
      </>
    );
  }

  it("conceder numa tela atualiza as outras já abertas, sem recarregar", async () => {
    render(<Dois />);
    await waitFor(() => expect(servidor.chamadas.length).toBeGreaterThan(0));
    await act(async () => {
      fireEvent.click(screen.getByText("conceder"));
    });
    await waitFor(() => expect(screen.getByTestId("a")).toHaveTextContent("true"));
    expect(screen.getByTestId("b")).toHaveTextContent("true");
  });
});

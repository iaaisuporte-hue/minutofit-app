import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Guideline 1.2 das lojas: app com mensagem entre pessoas precisa de um caminho
 * de denúncia. O registro vai pelo canal `POST /user/events` que já existe — o
 * teste garante o nome do evento, porque ele tem que bater com a allow-list do
 * backend, e uma divergência viraria 400 silencioso na cara do usuário.
 */

const rede = vi.hoisted(() => ({ authFetch: vi.fn(async () => new Response("{}", { status: 200 })) }));

vi.mock("../../services/apiClient", () => ({ authFetch: rede.authFetch }));
vi.mock("../../services/apiBase", () => ({ API_URL: "https://api.teste/api" }));

const { ReportConversationButton } = await import("./ReportConversationButton");

beforeEach(() => {
  rede.authFetch.mockClear();
  rede.authFetch.mockResolvedValue(new Response("{}", { status: 200 }));
});

function corpoEnviado() {
  const [, init] = rede.authFetch.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body));
}

describe("Denunciar conversa", () => {
  it("começa fechado, com a ação disponível", () => {
    render(<ReportConversationButton conversationId="c-1" />);
    expect(screen.getByRole("button", { name: /denunciar conversa/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/o que aconteceu/i)).not.toBeInTheDocument();
  });

  it("registra a denúncia sem exigir motivo e confirma ao usuário", async () => {
    const user = userEvent.setup();
    render(<ReportConversationButton conversationId="c-1" />);

    await user.click(screen.getByRole("button", { name: /denunciar conversa/i }));
    await user.click(screen.getByRole("button", { name: /enviar denúncia/i }));

    await waitFor(() => expect(rede.authFetch).toHaveBeenCalledTimes(1));
    expect(corpoEnviado()).toEqual({
      eventType: "chat.conversation_reported",
      payload: { conversationId: "c-1" },
    });
    expect(await screen.findByText(/denúncia registrada/i)).toBeInTheDocument();
  });

  it("leva junto o motivo quando o usuário escreve", async () => {
    const user = userEvent.setup();
    render(<ReportConversationButton conversationId="c-2" />);

    await user.click(screen.getByRole("button", { name: /denunciar conversa/i }));
    await user.type(screen.getByLabelText(/o que aconteceu/i), "mensagem ofensiva");
    await user.click(screen.getByRole("button", { name: /enviar denúncia/i }));

    await waitFor(() => expect(rede.authFetch).toHaveBeenCalledTimes(1));
    expect(corpoEnviado().payload).toEqual({
      conversationId: "c-2",
      reason: "mensagem ofensiva",
    });
  });

  it("falha de rede não vira confirmação falsa", async () => {
    const user = userEvent.setup();
    rede.authFetch.mockResolvedValue(new Response("{}", { status: 400 }));
    render(<ReportConversationButton conversationId="c-3" />);

    await user.click(screen.getByRole("button", { name: /denunciar conversa/i }));
    await user.click(screen.getByRole("button", { name: /enviar denúncia/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/não foi possível registrar/i);
    expect(screen.queryByText(/denúncia registrada/i)).not.toBeInTheDocument();
  });

  it("cancelar fecha o painel sem enviar nada", async () => {
    const user = userEvent.setup();
    render(<ReportConversationButton conversationId="c-4" />);

    await user.click(screen.getByRole("button", { name: /denunciar conversa/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(rede.authFetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /denunciar conversa/i })).toBeInTheDocument();
  });
});

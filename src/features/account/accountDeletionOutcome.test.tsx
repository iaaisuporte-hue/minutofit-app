import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Exclusão de conta no cliente (Spec 040): os desfechos que o servidor passou a ter.
 * 200 = excluída · 202 = a cobrança recorrente ainda está sendo encerrada, a conta CONTINUA ·
 * 409 = uma regra do servidor impede (dono de academia, contratos de alunos) · 4xx comum = erro.
 */

const resposta = vi.hoisted(() => ({ atual: null as null | { status: number; body: unknown } }));

vi.mock("../../services/apiClient", () => ({
  authFetch: async () => new Response(JSON.stringify(resposta.atual!.body), { status: resposta.atual!.status }),
}));
vi.mock("../../lib/externalLink", () => ({ handleExternal: vi.fn() }));

const { deleteMyAccount, AccountDeletionBlockedError } = await import("../../services/accountApi");
const { AccountDataSection } = await import("./AccountDataSection");

const responder = (status: number, body: unknown) => {
  resposta.atual = { status, body };
};

beforeEach(() => {
  responder(200, { success: true, status: "completed" });
});

describe("deleteMyAccount — contrato com o servidor", () => {
  const pedido = { confirmation: "EXCLUIR" };

  it("200 → concluída", async () => {
    await expect(deleteMyAccount(pedido)).resolves.toEqual({ status: "completed" });
  });

  it("202 → pendente: a conta NÃO foi excluída, e o cliente recebe a mensagem do servidor", async () => {
    responder(202, { success: true, status: "pending_cancellation", subscriptionsPending: 1, message: "Estamos encerrando a sua cobrança." });
    await expect(deleteMyAccount(pedido)).resolves.toEqual({
      status: "pending_cancellation",
      message: "Estamos encerrando a sua cobrança.",
      subscriptionsPending: 1,
    });
  });

  it("202 stalled → distingue do pendente (a equipe assumiu)", async () => {
    responder(202, { success: true, status: "stalled", subscriptionsPending: 1, message: "Nossa equipe foi acionada." });
    await expect(deleteMyAccount(pedido)).resolves.toMatchObject({ status: "stalled" });
  });

  it("409 com código → AccountDeletionBlockedError com a mensagem pronta para a tela", async () => {
    responder(409, { success: false, error: "academy_owner_transfer_required", code: "academy_owner_transfer_required", message: "Você é o único responsável por uma academia ativa." });
    const erro = await deleteMyAccount(pedido).catch((e) => e);
    expect(erro).toBeInstanceOf(AccountDeletionBlockedError);
    expect(erro.code).toBe("academy_owner_transfer_required");
    expect(erro.message).toMatch(/único responsável/);
  });

  it("senha errada continua sendo o erro de sempre (compatível com o contrato antigo)", async () => {
    responder(401, { success: false, error: "invalid_password" });
    await expect(deleteMyAccount(pedido)).rejects.toThrow("invalid_password");
  });
});

describe("AccountDataSection — o que a tela faz em cada desfecho", () => {
  async function confirmarExclusao(aoExcluir: () => void) {
    render(<AccountDataSection onDeleted={aoExcluir} />);
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    fireEvent.change(screen.getByLabelText(/para confirmar/i), { target: { value: "EXCLUIR" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
  }

  it("concluída → encerra a sessão", async () => {
    const aoExcluir = vi.fn();
    await confirmarExclusao(aoExcluir);
    await waitFor(() => expect(aoExcluir).toHaveBeenCalledTimes(1));
  });

  it("pendente → NÃO diz que excluiu: mostra o aviso, mantém a sessão até a pessoa confirmar, e só então sai", async () => {
    responder(202, { success: true, status: "pending_cancellation", subscriptionsPending: 1, message: "Estamos encerrando a sua cobrança recorrente. A conta será excluída em até 24 horas." });
    const aoExcluir = vi.fn();
    await confirmarExclusao(aoExcluir);

    expect(await screen.findByRole("status")).toHaveTextContent(/até 24 horas/);
    expect(aoExcluir).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Excluir conta" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /entendi, sair/i }));
    expect(aoExcluir).toHaveBeenCalledTimes(1);
  });

  it("barrada pelo servidor → mostra a orientação do servidor e NÃO encerra a sessão", async () => {
    responder(409, { success: false, error: "client_contracts_active", code: "client_contracts_active", message: "Você tem contratos ativos com alunos. Encerre cada contrato em Minha rede antes de excluir a conta." });
    const aoExcluir = vi.fn();
    await confirmarExclusao(aoExcluir);

    expect(await screen.findByRole("alert")).toHaveTextContent(/encerre cada contrato em minha rede/i);
    expect(aoExcluir).not.toHaveBeenCalled();
  });

  it("senha incorreta → mensagem curta de sempre", async () => {
    responder(401, { success: false, error: "invalid_password" });
    await confirmarExclusao(vi.fn());
    expect(await screen.findByRole("alert")).toHaveTextContent("Senha incorreta.");
  });
});

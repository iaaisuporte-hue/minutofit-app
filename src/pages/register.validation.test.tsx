import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// A página só precisa do contrato do contexto de auth; nenhuma chamada de rede
// acontece nestes testes (nada chega a ser enviado).
vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    register: vi.fn(),
    loginWithOAuth: vi.fn(),
  }),
}));

vi.mock("../auth/GoogleSignInButton", () => ({
  GoogleSignInButton: () => <div data-testid="google-btn" />,
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => <div data-testid="turnstile" />,
}));

const { default: RegisterPage } = await import("./register");

const renderPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );

// Regressão: o cadastro abria com os 6 campos em vermelho e 4 mensagens de erro
// antes de qualquer digitação — os `errors` eram calculados do estado inicial
// vazio e renderizados direto. A primeira coisa que um visitante novo via na
// única porta de cadastro do produto era a lista do que já tinha feito de errado
// (auditoria de design, 12/ago/2026).
describe("cadastro — quando os erros aparecem", () => {
  it("não acusa nada antes de o usuário responder", () => {
    const { container } = renderPage();

    expect(container.querySelectorAll(".field-error")).toHaveLength(0);
    expect(container.querySelectorAll(".input-invalid")).toHaveLength(0);
  });

  it("o botão de enviar nasce habilitado — botão morto não explica o porquê", () => {
    renderPage();

    expect(screen.getByRole("button", { name: /criar conta e continuar/i })).toBeEnabled();
  });

  it("acusa só o campo que o usuário deixou, ao sair dele", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByLabelText("Nome completo"));
    await user.tab();

    expect(screen.getByText("Informe seu nome completo.")).toBeInTheDocument();
    expect(container.querySelectorAll(".field-error")).toHaveLength(1);
  });

  it("revela tudo e diz o que fazer quando o envio é tentado vazio", async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.click(screen.getByRole("button", { name: /criar conta e continuar/i }));

    expect(container.querySelectorAll(".field-error").length).toBeGreaterThan(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Revise os campos destacados");
  });
});

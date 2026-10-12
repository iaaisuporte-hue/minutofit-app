import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Apple Sign-In fica pronto para quando o app chegar à App Store (guideline
 * 4.8: quem oferece login social de terceiro precisa oferecer o da Apple, com
 * a mesma proeminência) — mas não está wireado em nenhuma tela hoje (app só
 * no Android por enquanto). Estes testes cobrem só o componente, no caminho
 * web (o único executável sem device — o fluxo nativo em
 * `appleNativeAuth.ts` só roda no aparelho).
 */

const { AppleSignInButton } = await import("./AppleSignInButton");

type AppleResponse = {
  authorization?: { id_token?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};

function mockarAppleId(resposta: AppleResponse | Error) {
  const init = vi.fn();
  const signIn = vi.fn(async () => {
    if (resposta instanceof Error) throw resposta;
    return resposta;
  });
  (window as unknown as { AppleID: unknown }).AppleID = { auth: { init, signIn } };
  return { init, signIn };
}

beforeEach(() => {
  vi.stubEnv("VITE_APPLE_CLIENT_ID", "com.s2core.web");
});

afterEach(() => {
  delete (window as unknown as { AppleID?: unknown }).AppleID;
  vi.unstubAllEnvs();
});

describe("AppleSignInButton — caminho web", () => {
  it("renderiza o botão", () => {
    mockarAppleId({ authorization: { id_token: "tok" } });
    render(<AppleSignInButton onCredential={vi.fn()} />);

    expect(screen.getByRole("button", { name: /continuar com a apple/i })).toBeInTheDocument();
  });

  it("usa o rótulo de cadastro quando pedido", () => {
    mockarAppleId({ authorization: { id_token: "tok" } });
    render(<AppleSignInButton onCredential={vi.fn()} text="signup_with" />);

    expect(screen.getByRole("button", { name: /cadastrar com a apple/i })).toBeInTheDocument();
  });

  it("some na web quando não há Services ID configurado", () => {
    vi.stubEnv("VITE_APPLE_CLIENT_ID", "");
    const { container } = render(<AppleSignInButton onCredential={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("entrega o identityToken e o perfil da primeira autorização", async () => {
    const user = userEvent.setup();
    mockarAppleId({
      authorization: { id_token: "id-token-apple" },
      user: { email: "ana@privaterelay.appleid.com", name: { firstName: "Ana", lastName: "Lima" } },
    });
    const onCredential = vi.fn();
    render(<AppleSignInButton onCredential={onCredential} />);

    await user.click(screen.getByRole("button", { name: /continuar com a apple/i }));

    await waitFor(() =>
      expect(onCredential).toHaveBeenCalledWith("id-token-apple", {
        name: "Ana Lima",
        email: "ana@privaterelay.appleid.com",
      }),
    );
  });

  it("cancelamento não vira erro na tela", async () => {
    const user = userEvent.setup();
    mockarAppleId({});
    const onCredential = vi.fn();
    render(<AppleSignInButton onCredential={onCredential} />);

    await user.click(screen.getByRole("button", { name: /continuar com a apple/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /continuar com a apple/i })).toBeEnabled(),
    );
    expect(onCredential).not.toHaveBeenCalled();
    expect(screen.queryByText(/não foi possível entrar com a apple/i)).not.toBeInTheDocument();
  });
});

// A tela de login não oferece mais Apple nem Google (ambos removidos — app só
// no Android por enquanto, religar quando fizer sentido). O componente em si
// continua coberto pelos testes acima.

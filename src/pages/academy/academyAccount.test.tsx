import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Exclusão de conta pelo app para a equipe da academia (Apple 5.1.1(v)).
 * Antes, só aluno e profissional tinham a seção — quem entrava pelo convite da
 * academia criava conta pelo app e não conseguia excluí-la por ele.
 */

const conta = vi.hoisted(() => ({
  deleteMyAccount: vi.fn(async () => undefined),
  exportMyData: vi.fn(async () => undefined),
}));
const sessao = vi.hoisted(() => ({
  logout: vi.fn(),
  accessProfile: null as string | null,
  academies: [] as Array<{ id: number; slug: string; displayName: string; roleSlug: string; roleLabel: string; status: string }>,
}));

vi.mock("../../services/accountApi", () => conta);
vi.mock("../../auth/AuthContext", () => ({
  useAuth: () => ({
    email: "equipe@academia.com",
    logout: sessao.logout,
    academies: sessao.academies,
    accessProfile: sessao.accessProfile,
  }),
}));

const { default: AcademyAccountPage } = await import("./AcademyAccountPage");
const { AccountDataSection } = await import("../../features/account/AccountDataSection");
const { OwnerAwareAccountDataSection } = await import("../../features/account/OwnerAwareAccountDataSection");

function academia(roleSlug: string) {
  return { id: 1, slug: "forca", displayName: "Academia Força", roleSlug, roleLabel: roleSlug, status: "active" };
}

function abrirExclusao() {
  fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
}

beforeEach(() => {
  conta.deleteMyAccount.mockClear();
  sessao.logout.mockClear();
  sessao.academies = [];
  sessao.accessProfile = null;
});

describe("Minha conta — equipe da academia", () => {
  it("recepção exclui a própria conta, avisada de que a academia continua", async () => {
    sessao.academies = [academia("academy_reception")];
    render(<MemoryRouter><AcademyAccountPage /></MemoryRouter>);

    abrirExclusao();
    expect(screen.getByText(/só a sua conta pessoal/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Senha/i), { target: { value: "s3nha" } });
    fireEvent.change(screen.getByLabelText(/para confirmar/i), { target: { value: "EXCLUIR" } });
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));

    await waitFor(() =>
      expect(conta.deleteMyAccount).toHaveBeenCalledWith({ confirmation: "EXCLUIR", password: "s3nha" }),
    );
    expect(sessao.logout).toHaveBeenCalled();
  });

  it("o dono inicia o pedido, mas não exclui sozinho a conta que sustenta a academia", () => {
    sessao.academies = [academia("academy_owner")];
    render(<MemoryRouter><AcademyAccountPage /></MemoryRouter>);

    abrirExclusao();
    expect(screen.getByText("Academia Força")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /s2core\.contato@gmail\.com/ })).toHaveAttribute(
      "href",
      expect.stringMatching(/^mailto:s2core\.contato@gmail\.com/),
    );
    expect(screen.queryByLabelText(/para confirmar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir conta" })).not.toBeInTheDocument();
    expect(conta.deleteMyAccount).not.toHaveBeenCalled();
  });

  it("dono de uma academia e recepção de outra continua bloqueado", () => {
    sessao.academies = [academia("academy_reception"), { ...academia("academy_owner"), id: 2, displayName: "Unidade Centro" }];
    render(<MemoryRouter><AcademyAccountPage /></MemoryRouter>);
    abrirExclusao();
    expect(screen.getByText("Unidade Centro")).toBeInTheDocument();
    expect(screen.queryByLabelText(/para confirmar/i)).not.toBeInTheDocument();
  });
});

describe("AccountDataSection sem as props novas (aluno, personal, nutri)", () => {
  it("segue com o formulário de sempre e sem a nota da academia", () => {
    render(<AccountDataSection onDeleted={() => {}} />);
    abrirExclusao();
    expect(screen.getByLabelText(/para confirmar/i)).toBeInTheDocument();
    expect(screen.queryByText(/só a sua conta pessoal/i)).not.toBeInTheDocument();
  });
});

describe("trava do dono nas outras portas (perfil de aluno e de profissional)", () => {
  it("dono que também é aluno não exclui pelo perfil comum", () => {
    sessao.academies = [academia("academy_owner")];
    render(<MemoryRouter><OwnerAwareAccountDataSection onDeleted={() => {}} /></MemoryRouter>);
    abrirExclusao();
    expect(screen.getByText("Academia Força")).toBeInTheDocument();
    expect(screen.queryByLabelText(/para confirmar/i)).not.toBeInTheDocument();
  });

  it("login sem a lista de academias (OAuth): o perfil de acesso de dono basta", () => {
    sessao.accessProfile = "academy_owner";
    render(<MemoryRouter><OwnerAwareAccountDataSection onDeleted={() => {}} /></MemoryRouter>);
    abrirExclusao();
    expect(screen.getByText(/responsável por uma academia/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/para confirmar/i)).not.toBeInTheDocument();
  });

  it("quem não é dono segue com o formulário de sempre", () => {
    sessao.academies = [academia("academy_personal")];
    render(<MemoryRouter><OwnerAwareAccountDataSection onDeleted={() => {}} /></MemoryRouter>);
    abrirExclusao();
    expect(screen.getByLabelText(/para confirmar/i)).toBeInTheDocument();
  });
});

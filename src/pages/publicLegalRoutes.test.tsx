/**
 * Rotas legais públicas — regressão do ISSUE-002 (/qa, ago/2026).
 *
 * `/excluir-conta` é exigida pela política de exclusão de dados do Google Play
 * como URL PÚBLICA: alcançável sem instalar o app e sem login. Em produção ela
 * não existia na SPA (que é quem responde por `www.s2core.com.br`) e o usuário
 * caía no `/login` — enquanto `/termos` e `/privacidade`, ao lado, funcionavam.
 *
 * O teste que existia (`store-readiness.test.ts`, no backend) afirmava que o
 * ARQUIVO existe no repositório do site Next. Ele passava, e a página seguia
 * inalcançável: verificava o artefato, não o resultado. Este aqui verifica a
 * ROTA — que é o que a loja abre.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import DeleteAccountInfoPage from "./DeleteAccountInfoPage";
import TermsOfUsePage from "./TermsOfUsePage";
import PrivacyPolicyPage from "./PrivacyPolicyPage";

/** Espelha a declaração real em App.tsx, sem arrastar o app inteiro. */
function LegalRoutes({ at }: { at: string }) {
  return (
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/privacidade" element={<PrivacyPolicyPage />} />
        <Route path="/termos" element={<TermsOfUsePage />} />
        <Route path="/excluir-conta" element={<DeleteAccountInfoPage />} />
        <Route path="*" element={<div>REDIRECIONADO PARA LOGIN</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("rotas legais públicas", () => {
  it("/excluir-conta abre sem login — é o que o Google Play exige", () => {
    render(<LegalRoutes at="/excluir-conta" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Excluir sua conta/i);
    expect(screen.queryByText("REDIRECIONADO PARA LOGIN")).not.toBeInTheDocument();
  });

  it("as três rotas legais respondem, nenhuma cai no catch-all", () => {
    for (const rota of ["/termos", "/privacidade", "/excluir-conta"]) {
      const { unmount } = render(<LegalRoutes at={rota} />);
      expect(screen.queryByText("REDIRECIONADO PARA LOGIN")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("explica os dois caminhos de exclusão: pelo app e por e-mail", () => {
    // A loja recusa a página se ela não disser COMO pedir a exclusão.
    render(<LegalRoutes at="/excluir-conta" />);
    expect(screen.getByText(/Pelo aplicativo/i)).toBeInTheDocument();
    expect(screen.getByText(/Por solicitação direta/i)).toBeInTheDocument();
    expect(screen.getAllByText(/s2core\.contato@gmail\.com/i).length).toBeGreaterThan(0);
  });

  it("diz o que é apagado e o que é mantido — a loja cobra os dois", () => {
    render(<LegalRoutes at="/excluir-conta" />);
    expect(screen.getByText(/O que é apagado/i)).toBeInTheDocument();
    expect(screen.getByText(/O que é mantido/i)).toBeInTheDocument();
    expect(screen.getByText(/30 dias/i)).toBeInTheDocument();
  });
});

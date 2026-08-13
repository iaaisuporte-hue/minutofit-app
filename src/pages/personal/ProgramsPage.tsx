import { Suspense, lazy, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import WorkoutLibraryPage from "./WorkoutLibraryPage";
import "../../features/performance/challenges.css";

const PersonalChallengesPanel = lazy(() => import("./challenges/PersonalChallengesPanel"));

/**
 * Destino "Programas" — host de abas (Spec 034, C2).
 *
 * A arquitetura da área do personal é **4 destinos + 1 ícone**, e funcionalidade
 * nova vira aba interna de um destino existente, nunca um item de menu novo.
 * Desafios pertence aqui: é o que o personal PROPÕE à turma, ao lado dos
 * protocolos que ele prescreve.
 *
 * A aba vive na URL (`?tab=`), como na Evolução do aluno: deep link, F5 e o
 * voltar do Android preservam onde a pessoa estava.
 */
export const PROGRAM_TABS = [
  { id: "protocolos", label: "Protocolos" },
  { id: "desafios", label: "Desafios" },
] as const;

export type ProgramTabId = (typeof PROGRAM_TABS)[number]["id"];

const DEFAULT_TAB: ProgramTabId = "protocolos";

function isValidTab(value: string | null): value is ProgramTabId {
  return value != null && PROGRAM_TABS.some((t) => t.id === value);
}

export default function ProgramsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get("tab");
  const active: ProgramTabId = isValidTab(raw) ? raw : DEFAULT_TAB;

  const selectTab = useCallback(
    (id: ProgramTabId) => {
      // `replace` para não empilhar uma entrada de histórico por toque.
      const next = new URLSearchParams(searchParams);
      if (id === DEFAULT_TAB) next.delete("tab");
      else next.set("tab", id);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      {/* Botões comuns com `aria-current`, e não `role="tab"`: o padrão ARIA
          de abas exige `aria-controls`, `aria-labelledby` e navegação por
          setas. Implementá-lo pela metade é pior que não usá-lo — aqui as
          "abas" são links de URL com duas opções. */}
      <nav className="ch-tabs" aria-label="Programas">
        {PROGRAM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={active === tab.id ? "page" : undefined}
            className={`ch-tab${active === tab.id ? " is-active" : ""}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div>
        {active === "desafios" ? (
          <Suspense fallback={<p className="ch-card-hint">Carregando…</p>}>
            <PersonalChallengesPanel />
          </Suspense>
        ) : (
          <WorkoutLibraryPage />
        )}
      </div>
    </div>
  );
}

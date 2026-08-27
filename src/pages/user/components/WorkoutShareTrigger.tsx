import { useState } from "react";
import { ShareWorkoutModal } from "./ShareWorkoutModal";
import type { SessionShareData } from "../lib/sessionShareData";
import type { WorkoutShareExercise, WorkoutShareStats } from "../lib/shareWorkoutImage";

/**
 * ⚠️ FUNCIONALIDADE MADURA — compartilhamento social de treino.
 * Aquisição orgânica + prova social + engajamento (ver docs/MATURE_FEATURES.md).
 * NÃO remover sem decisão documentada. Coberto por testes de regressão
 * (WorkoutShareTrigger.test.tsx). O botão pode mudar de lugar, mas não some.
 *
 * Botão único e reutilizável que abre o preview/share. Sempre visível — o
 * fallback (baixar/copiar) cobre desktop e devices sem Web Share, então NÃO
 * gatear por capacidade de share nativo aqui.
 */
type Variant = "primary" | "ghost";

interface Props {
  /** Foco do treino exibido em destaque no card (ex.: "Peito + Tríceps"). */
  focus: string;
  /** Nome do dia (ex.: "Treino B"). */
  dayName?: string;
  /** Estatísticas seguras opcionais (duração/séries/volume/sequência). */
  stats?: WorkoutShareStats | null;
  /** Exercícios executados — mini tabela "Exercícios executados" no card. */
  exercises?: WorkoutShareExercise[] | null;
  /**
   * Busca o treino no servidor ao abrir, em vez de usar as props acima.
   *
   * Quem chama a partir de uma tela de PLANO não sabe o que foi executado — a
   * pessoa pode ter feito treino livre, ou metade da ficha. Nesses pontos a
   * arte precisa vir da sessão gravada, não da prescrição.
   */
  resolveShareData?: () => Promise<SessionShareData | null>;
  variant?: Variant;
  label?: string;
}

export function WorkoutShareTrigger({ focus, dayName, stats, exercises, resolveShareData, variant = "ghost", label = "Compartilhar treino" }: Props) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<SessionShareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onOpen() {
    if (loading) return;
    if (!resolveShareData) {
      setOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await resolveShareData();
      if (!data) {
        setError("Não encontrei o treino de hoje para compartilhar.");
        return;
      }
      setResolved(data);
      setOpen(true);
    } catch {
      setError("Não consegui abrir o treino. Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  function onClose() {
    setOpen(false);
    setResolved(null);
  }

  const base: React.CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  };
  const style: React.CSSProperties =
    variant === "primary"
      ? { ...base, border: "none", background: "var(--action-primary)", color: "var(--color-cta-text, #fff)" }
      : { ...base, border: "1px solid var(--color-border)", background: "transparent", color: "var(--color-text)" };

  return (
    <>
      <button type="button" onClick={() => void onOpen()} style={style} data-testid="workout-share-trigger" disabled={loading}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        {loading ? "Abrindo…" : label}
      </button>
      {error ? (
        <div role="status" style={{ marginTop: 6, fontSize: 12, color: "var(--color-danger)" }}>{error}</div>
      ) : null}
      {open ? (
        <ShareWorkoutModal
          focus={resolved?.focus ?? focus}
          dayName={resolved?.dayName ?? dayName}
          stats={resolved?.stats ?? stats}
          exercises={resolved?.exercises ?? exercises}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}

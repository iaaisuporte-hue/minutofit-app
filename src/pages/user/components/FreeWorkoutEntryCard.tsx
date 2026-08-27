import { Link } from "react-router-dom";
import { useFeatureFlags } from "../../../auth/FeatureFlagsContext";
import { COLORS } from "../../../styles/colors";
import { loadFreeDraft } from "../workoutSession/sessionDraft";

// Porta de entrada do treino livre. Renderiza nada sem a flag `free_workout` —
// a flag é o kill-switch do recurso.
//
// Quando há treino aberto o card vira "Retomar" e vai direto para a sessão: quem
// parou no meio não deveria passar de novo pela montagem para achar o próprio
// treino. O rascunho é lido na renderização (localStorage, síncrono) porque ele
// só muda por ação em outra rota.
export function FreeWorkoutEntryCard() {
  const { hasFeature } = useFeatureFlags();
  if (!hasFeature("free_workout")) return null;

  const draft = loadFreeDraft();
  const resuming = !!draft?.exercises.length;
  const count = draft?.exercises.length ?? 0;

  return (
    <Link
      to={resuming ? "/app/user/treino-livre/sessao" : "/app/user/treino-livre"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${resuming ? COLORS.primaryBorder : COLORS.border}`,
        borderRadius: 12,
        background: resuming ? COLORS.primarySoft : COLORS.card,
        padding: "12px 14px",
        color: COLORS.text,
        textDecoration: "none",
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--color-surface)",
          color: COLORS.primary,
        }}
        aria-hidden
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4v16M18 4v16M1 9h5M18 9h5M1 15h5M18 15h5" />
        </svg>
      </span>

      <div style={{ minWidth: 0, flex: "1 1 0" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {resuming ? "Retomar treino livre" : "Treino livre"}
        </div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
          {resuming
            ? `Você tem um treino em andamento com ${count} ${count === 1 ? "exercício" : "exercícios"}.`
            : "Monte o treino de hoje na hora e registre carga e repetições."}
        </div>
      </div>

      <span style={{ flexShrink: 0, color: COLORS.primary, fontWeight: 700, fontSize: 13 }}>→</span>
    </Link>
  );
}

export default FreeWorkoutEntryCard;

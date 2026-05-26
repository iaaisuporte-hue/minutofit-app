import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";
import MinutoFitLogo from "../components/MinutoFitLogo";
import { IncomingRequestsPanel } from "../features/team";

export default function NutriApp() {
  const auth = useAuth();

  return (
    <AppShell
      sidebar={
        <>
          <div style={{ padding: "8px 4px 16px" }}>
            <MinutoFitLogo width={148} />
            <div className="shellSubtitle" style={{ marginTop: 8 }}>Nutrição</div>
          </div>

          <div className="navStack">
            <div className="navLink navLinkActive">Pacientes</div>
            <div className="navLink">Planos alimentares</div>
            <div className="navLink">Avaliações</div>
            <div className="navLink">Mensagens</div>
          </div>

          <div style={{ flex: 1 }} />

          <div className="sidebar-footer">
            <button type="button" onClick={auth.logout} className="logoutButton">
              Sair da conta
            </button>
          </div>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "-0.02em" }}>
            Área do Nutricionista
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, margin: "6px 0 0" }}>
            Pacientes, planos alimentares e avaliações.
          </p>
        </div>
        <IncomingRequestsPanel role="nutri" />

        <div
          className="card cardPad"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            border: "1px dashed var(--color-border)",
            background: "var(--color-surface-subtle)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-subtle)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Área em construção
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--color-text)" }}>
            Plataforma de acompanhamento nutricional contínuo
          </div>
          <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
            O painel completo de pacientes, planos alimentares, metas e adesão entra em breve, integrado a treino, energia e rotina do aluno. Por enquanto, as solicitações de vínculo recebidas aparecem acima.
          </div>
        </div>
      </div>
    </AppShell>
  );
}

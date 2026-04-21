import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";

export default function NutriApp() {
  const auth = useAuth();

  return (
    <AppShell
      sidebar={
        <>
          <div style={{ padding: "8px 4px 16px" }}>
            <div className="shellTitle">MinutoFit</div>
            <div className="shellSubtitle">Nutrição</div>
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { title: "Pacientes ativos", value: "24" },
            { title: "Planos em revisão", value: "8" },
            { title: "Retornos da semana", value: "12" },
          ].map((item) => (
            <div key={item.title} className="card cardPad">
              <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#1F2937" }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

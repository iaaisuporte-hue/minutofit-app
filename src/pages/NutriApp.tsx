import { useAuth } from "../auth/AuthContext";
import AppShell from "../layout/AppShell";

export default function NutriApp() {
  const auth = useAuth();

  return (
    <AppShell
      sidebar={
        <>
          <div className="heroPanel" style={{ padding: 18 }}>
            <div className="shellTitle">Painel da Nutrição</div>
            <div className="shellSubtitle" style={{ marginTop: 8 }}>
              Acompanhamento alimentar e evolução clínica com a nova identidade do produto.
            </div>
          </div>

          <div className="navStack">
            <div className="navLink navLinkActive">Pacientes</div>
            <div className="navLink">Planos alimentares</div>
            <div className="navLink">Avaliações</div>
            <div className="navLink">Mensagens</div>
          </div>

          <div style={{ flex: 1 }} />

          <button onClick={auth.logout} className="logoutButton">
            Sair
          </button>
        </>
      }
    >
      <div className="pageSurface pageSurfacePad" style={{ display: "grid", gap: 14 }}>
        <div className="shellTitle">Área do Nutricionista</div>
        <div className="shellSubtitle">
          Pacientes, planos alimentares e avaliações já com o novo sistema visual aplicado.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {[
            { title: "Pacientes ativos", value: "24" },
            { title: "Planos em revisão", value: "8" },
            { title: "Retornos da semana", value: "12" },
          ].map((item) => (
            <div key={item.title} className="card cardPad">
              <div className="small">{item.title}</div>
              <div style={{ marginTop: 10, fontSize: 34, fontWeight: 1000 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

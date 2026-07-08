import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAdminUserById, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

export default function AdminNutriDetailsPage() {
  const { nutriId } = useParams();
  const [nutri, setNutri] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nutriId) { setLoading(false); return; }
    fetchAdminUserById(nutriId)
      .then((data) => setNutri(data))
      .catch(() => setNutri(null))
      .finally(() => setLoading(false));
  }, [nutriId]);

  if (loading) {
    return <div style={{ padding: 32, color: COLORS.muted }}>Carregando…</div>;
  }

  if (!nutri) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Nutricionista não encontrado</div>
        <Link to="/app/admin/nutris" style={{ color: "#7B9919" }}>
          Voltar para nutris
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to="/app/admin/nutris" style={{ color: "#7B9919", textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
          ← Voltar para nutris
        </Link>
        <div style={{ fontSize: 30, fontWeight: 700 }}>{nutri.name ?? "—"}</div>
        <div style={{ color: COLORS.muted }}>{nutri.email}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Papel", value: nutri.role },
          { label: "Perfil completo", value: nutri.profile_completed ? "Sim" : "Não" },
          { label: "Plano", value: nutri.subscription_tier ?? "—" },
          { label: "Cadastro", value: new Date(nutri.created_at).toLocaleDateString("pt-BR") },
          { label: "ID", value: String(nutri.id) },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>Pacientes vinculados</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
          Vínculo nutri–paciente disponível em breve via painel de gestão de atribuições.
        </div>
      </div>
    </div>
  );
}

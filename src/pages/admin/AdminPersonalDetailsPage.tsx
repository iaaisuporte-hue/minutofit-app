import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchAdminUserById, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

export default function AdminPersonalDetailsPage() {
  const { personalId } = useParams();
  const [personal, setPersonal] = useState<AdminUserRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personalId) { setLoading(false); return; }
    fetchAdminUserById(personalId)
      .then((data) => setPersonal(data))
      .catch(() => setPersonal(null))
      .finally(() => setLoading(false));
  }, [personalId]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: COLORS.muted }}>Carregando…</div>
    );
  }

  if (!personal) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Personal não encontrado</div>
        <Link to="/app/admin/personals" style={{ color: "#22C55E" }}>
          Voltar para personals
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
        <Link to="/app/admin/personals" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
          ← Voltar para personals
        </Link>
        <div style={{ fontSize: 30, fontWeight: 700 }}>{personal.name ?? "—"}</div>
        <div style={{ color: COLORS.muted }}>{personal.email}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {[
          { label: "Papel", value: personal.role },
          { label: "Perfil completo", value: personal.profile_completed ? "Sim" : "Não" },
          { label: "Plano", value: personal.subscription_tier ?? "—" },
          { label: "Cadastro", value: new Date(personal.created_at).toLocaleDateString("pt-BR") },
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
        <div style={{ fontSize: 18, fontWeight: 700 }}>Alunos vinculados</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
          Vínculo personal–aluno disponível em breve via painel de gestão de atribuições.
        </div>
      </div>
    </div>
  );
}

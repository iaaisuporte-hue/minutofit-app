import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

export default function AdminNutrisPage() {
  const auth = useAuth();
  const [nutris, setNutris] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminUsers({ role: "nutri", limit: 50 })
      .then((data) => setNutris(data?.users ?? []))
      .catch(() => setNutris([]))
      .finally(() => setLoading(false));
  }, []);

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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>Nutris</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>
              Área para acompanhar disponibilidade, carteira ativa e foco clínico de cada profissional de nutrição.
            </div>
          </div>

          {auth.hasPermission("admin.professionals.create") ? (
            <Link
              to="/app/admin/nutris/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "#22C55E",
                color: "#FFFFFF",
                fontWeight: 700,
                textDecoration: "none",
                width: "fit-content",
              }}
            >
              Cadastrar nutri
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading && (
          <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>Carregando…</div>
        )}
        {!loading && nutris.length === 0 && (
          <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>
            Nenhum nutri cadastrado ainda.
          </div>
        )}
        {nutris.map((nutri) => (
          <div
            key={nutri.id}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{nutri.name ?? "—"}</div>
                <div style={{ color: COLORS.muted }}>{nutri.email}</div>
              </div>
              <div
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  border: "1px solid rgba(34,197,94,.28)",
                  background: "rgba(34,197,94,.14)",
                  color: "#22C55E",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                ativo
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {[
                { label: "Papel", value: nutri.role },
                { label: "Plano", value: nutri.subscription_tier ?? "—" },
                { label: "Cadastro", value: new Date(nutri.created_at).toLocaleDateString("pt-BR") },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                    padding: 12,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
                  <div style={{ fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

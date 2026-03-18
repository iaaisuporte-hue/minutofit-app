import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { adminPersonals } from "./adminData";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
};

export default function AdminPersonalsPage() {
  const auth = useAuth();
  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ fontSize: 28, fontWeight: 1000 }}>Personals</div>
            <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 780 }}>
              Painel para acompanhar capacidade operacional, carteira ativa e especialidade de cada profissional.
            </div>
          </div>

          {auth.hasPermission("admin.professionals.create") ? (
            <Link
              to="/app/admin/personals/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                color: "#082014",
                fontWeight: 1000,
                textDecoration: "none",
                width: "fit-content",
              }}
            >
              Cadastrar personal
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {adminPersonals.map((personal) => (
          <div
            key={personal.id}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 18,
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 1000 }}>{personal.name}</div>
                <div style={{ color: COLORS.muted }}>{personal.email}</div>
              </div>
              <div
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  border: `1px solid ${personal.status === "ativo" ? "rgba(29,185,84,.28)" : "rgba(255,255,255,.14)"}`,
                  background: personal.status === "ativo" ? "rgba(29,185,84,.14)" : "rgba(255,255,255,.06)",
                  color: personal.status === "ativo" ? "#7CFF6B" : "rgba(255,255,255,.78)",
                  fontWeight: 900,
                  fontSize: 12,
                }}
              >
                {personal.status}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
              {[
                { label: "Especialidade", value: personal.specialty },
                { label: "Alunos ativos", value: String(personal.activeClients) },
                { label: "Papel", value: personal.role },
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
                  <div style={{ fontWeight: 900 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <Link
              to={`/app/admin/personals/${personal.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                color: "#082014",
                fontWeight: 1000,
                textDecoration: "none",
                width: "fit-content",
              }}
            >
              Ver detalhe do personal
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

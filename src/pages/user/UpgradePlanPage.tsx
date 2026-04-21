import { Link } from "react-router-dom";
import { COLORS } from "../../styles/colors";

export default function UpgradePlanPage() {
  return (
    <div style={{ display: "grid", gap: 14, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 16,
          background: COLORS.panel,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/app/user/treinos"
          style={{
            textDecoration: "none",
            color: COLORS.text,
            fontWeight: 700,
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,.12)",
          }}
        >
          ← Voltar
        </Link>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 0.2 }}>Produto atual</div>
          <div style={{ color: COLORS.muted, fontSize: 12, fontWeight: 600 }}>Plano único ativo</div>
        </div>
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.freeBorder}`,
          borderRadius: 16,
          padding: 16,
          background: COLORS.freeSoft,
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700 }}>Plano Free</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.5 }}>
          Neste momento, o produto está operando em plano único. Todos os usuários usam o mesmo pacote de recursos.
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, color: COLORS.text, lineHeight: 1.6 }}>
          <li>Treinos do dia e treinos em casa</li>
          <li>Biblioteca de treinos e perfil</li>
          <li>Configurações da conta</li>
        </ul>
      </div>

      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: 14,
          background: COLORS.panel,
          color: COLORS.muted,
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        Planos Pro e Premium permanecem no backend apenas para compatibilidade administrativa e histórico.
      </div>
    </div>
  );
}
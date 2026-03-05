import React from "react";
import { Link } from "react-router-dom";

type Props = {
  onLogout: () => void;
};

const COLORS = {
  bg: "#0F0F0F",
  panel: "#171717",
  panel2: "#141414",
  border: "rgba(255,255,255,.10)",
  border2: "rgba(255,255,255,.08)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  muted2: "rgba(255,255,255,.55)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.16)",
  orangeBorder: "rgba(255,106,0,.35)",
};

function Card({
  title,
  subtitle,
  children,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: accent ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
        borderRadius: 16,
        background: accent
          ? `linear-gradient(180deg, ${COLORS.orangeSoft}, rgba(255,255,255,0) 55%), ${COLORS.panel}`
          : COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        overflow: "hidden",
        color: COLORS.text,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${COLORS.border2}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>{title}</div>
          {subtitle ? (
            <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.35 }}>{subtitle}</div>
          ) : null}
        </div>

        {accent ? (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 999,
              border: `1px solid ${COLORS.orangeBorder}`,
              background: COLORS.orangeSoft,
              fontWeight: 1000,
              fontSize: 12,
            }}
          >
            👤 CONTA
          </div>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function ActionLink({
  to,
  icon,
  label,
  variant = "ghost",
}: {
  to: string;
  icon: string;
  label: string;
  variant?: "ghost" | "accent";
}) {
  const isAccent = variant === "accent";

  return (
    <Link
      to={to}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: isAccent ? `1px solid ${COLORS.orangeBorder}` : `1px solid ${COLORS.border}`,
        background: isAccent ? COLORS.orange : "transparent",
        color: isAccent ? COLORS.bg : COLORS.text,
        textDecoration: "none",
        fontWeight: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        boxShadow: isAccent ? "0 10px 24px rgba(0,0,0,.35)" : "none",
      }}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void;
  icon: string;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: danger ? "1px solid rgba(239,68,68,.35)" : `1px solid ${COLORS.border}`,
        background: danger ? "rgba(239,68,68,.12)" : "transparent",
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border2}`,
        background: COLORS.panel2,
      }}
    >
      <div style={{ color: COLORS.muted2, fontSize: 12, fontWeight: 900 }}>{label}</div>
      <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 1000 }}>{value}</div>
    </div>
  );
}

export default function UserProfilePage({ onLogout }: Props) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Card
        title="Perfil"
        subtitle="Seu hub de conta, preferências e atalhos."
        accent
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 0.2 }}>Aluno</div>
            <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
              Ajuste suas informações e mantenha seus treinos cada vez mais personalizados.
            </div>
          </div>

          {/* ✅ “Resumo” visual (mock por enquanto) */}
          <div style={{ display: "grid", gap: 10 }}>
            <InfoRow label="Plano" value="BÁSICO" />
            <InfoRow label="Onboarding" value="EM ANDAMENTO" />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
            <ActionLink to="/app/user/settings" icon="⚙️" label="Configurações" variant="ghost" />
            <ActionLink to="/app/user/upgrade" icon="⭐" label="Evoluir plano" variant="accent" />
            <ActionButton onClick={onLogout} icon="🚪" label="Sair" danger />
          </div>

          {/* ✅ Micro-copy de branding */}
          <div style={{ marginTop: 6, color: COLORS.muted2, fontSize: 12, lineHeight: 1.35 }}>
            Treine com consistência. O resto a gente ajusta com você. 🧡
          </div>
        </div>
      </Card>

      <Card
        title="Preferências"
        subtitle="Próxima fase (vamos transformar isso em configurações reais)."
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              border: `1px solid ${COLORS.border2}`,
              background: COLORS.panel2,
              borderRadius: 16,
              padding: 12,
              color: COLORS.muted,
              fontSize: 13,
              lineHeight: 1.45,
            }}
          >
            • Objetivo (emagrecer / hipertrofia / condicionamento) <br />
            • Nível (iniciante / intermediário / avançado) <br />
            • Duração preferida <br />
            • Equipamentos disponíveis <br />
            • Notificações e lembretes
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 16,
              border: `1px dashed ${COLORS.border}`,
              color: COLORS.muted2,
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            Dica: quando isso estiver ativo, o app vai sugerir treinos mais “certeiros” e reduzir erros
            de recomendação.
          </div>
        </div>
      </Card>
    </div>
  );
}
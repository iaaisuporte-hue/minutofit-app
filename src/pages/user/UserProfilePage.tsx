import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type Props = {
  onLogout: () => void;
};

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
  dangerSoft: "rgba(239,68,68,.12)",
  dangerBorder: "rgba(239,68,68,.35)",
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {eyebrow ? (
        <div
          style={{
            display: "inline-flex",
            width: "fit-content",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: COLORS.highlightSoft,
            color: "#7CFF6B",
            padding: "8px 12px",
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div style={{ fontSize: 30, fontWeight: 1000, color: COLORS.text }}>{title}</div>
      {subtitle ? <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>{subtitle}</div> : null}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panelSoft,
        alignItems: "center",
      }}
    >
      <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>
        {label}
      </div>
      <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 900, textAlign: "right" }}>{value}</div>
    </div>
  );
}

function ActionLink({
  to,
  label,
  icon,
  accent,
}: {
  to: string;
  label: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: accent ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
        background: accent ? "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)" : "transparent",
        color: accent ? "#0A130D" : COLORS.text,
        textDecoration: "none",
        fontWeight: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function ActionButton({
  onClick,
  label,
  icon,
}: {
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${COLORS.dangerBorder}`,
        background: COLORS.dangerSoft,
        color: COLORS.text,
        cursor: "pointer",
        fontWeight: 1000,
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function maskCpf(cpf?: string) {
  const digits = (cpf || "").replace(/\D/g, "");
  if (digits.length !== 11) return cpf || "Nao informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskPhone(phone?: string) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone || "Nao informado";
}

function normalizePlanLabel(plan?: string) {
  const value = (plan || "basic").toLowerCase();
  if (value === "black") return "Black";
  if (value === "gold") return "Gold";
  if (value === "silver") return "Silver";
  return "Basico";
}

export default function UserProfilePage({ onLogout }: Props) {
  const { user, email, profileCompleted } = useAuth();

  const accountSummary = useMemo(
    () => ({
      name: user?.name || "Aluno",
      accountEmail: user?.email || email || "Nao informado",
      cpf: maskCpf(user?.cpf),
      phone: maskPhone(user?.phone),
      plan: normalizePlanLabel(user?.subscriptionTier),
      profileStatus: profileCompleted ? "Completo" : "Pendente",
      fitnessGoal: user?.fitnessGoal || "Nao definido",
      experienceLevel: user?.experienceLevel || "Nao definido",
      height: user?.heightCm ? `${user.heightCm} cm` : "Nao informado",
      weight: user?.weightKg ? `${user.weightKg} kg` : "Nao informado",
      dietaryRestrictions: user?.dietaryRestrictions || "Nenhuma informada",
    }),
    [
      email,
      profileCompleted,
      user?.cpf,
      user?.dietaryRestrictions,
      user?.email,
      user?.experienceLevel,
      user?.fitnessGoal,
      user?.heightCm,
      user?.name,
      user?.phone,
      user?.subscriptionTier,
      user?.weightKg,
    ]
  );

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ background: COLORS.panelDeep, borderColor: COLORS.borderStrong }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SectionTitle
            eyebrow="Minha conta"
            title={accountSummary.name}
            subtitle="Aqui ficam seus dados principais de conta, assinatura e perfil fitness. A ideia é concentrar o que realmente define sua experiência no app."
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div
              style={{
                borderRadius: 999,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                padding: "10px 12px",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Plano {accountSummary.plan}
            </div>
            <div
              style={{
                borderRadius: 999,
                border: `1px solid ${profileCompleted ? COLORS.borderStrong : COLORS.border}`,
                background: profileCompleted ? COLORS.primarySoft : COLORS.panelSoft,
                padding: "10px 12px",
                color: COLORS.text,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              Perfil {accountSummary.profileStatus}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, .85fr)", gap: 16 }}>
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 1000, color: COLORS.text }}>Dados da conta</div>
              <div style={{ display: "grid", gap: 10 }}>
                <DataRow label="Nome" value={accountSummary.name} />
                <DataRow label="E-mail" value={accountSummary.accountEmail} />
                <DataRow label="CPF" value={accountSummary.cpf} />
                <DataRow label="Telefone" value={accountSummary.phone} />
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 1000, color: COLORS.text }}>Perfil fitness</div>
              <div style={{ display: "grid", gap: 10 }}>
                <DataRow label="Objetivo" value={accountSummary.fitnessGoal} />
                <DataRow label="Nivel" value={accountSummary.experienceLevel} />
                <DataRow label="Altura" value={accountSummary.height} />
                <DataRow label="Peso" value={accountSummary.weight} />
                <DataRow label="Restricoes alimentares" value={accountSummary.dietaryRestrictions} />
              </div>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gap: 16, alignSelf: "start" }}>
          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 1000, color: COLORS.text }}>Assinatura e status</div>
              <div style={{ display: "grid", gap: 10 }}>
                <DataRow label="Plano atual" value={accountSummary.plan} />
                <DataRow label="Perfil concluido" value={accountSummary.profileStatus} />
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ fontSize: 20, fontWeight: 1000, color: COLORS.text }}>Acoes da conta</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <ActionLink to="/app/user/settings" label="Configuracoes" icon="⚙️" />
                <ActionLink to="/app/user/upgrade" label="Evoluir plano" icon="⭐" accent />
                {!profileCompleted ? (
                  <ActionLink to="/profile-completion" label="Completar perfil" icon="🧾" />
                ) : null}
                <ActionButton onClick={onLogout} label="Sair" icon="🚪" />
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 1000, color: COLORS.text }}>Leitura do produto</div>
              <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                Essa tela agora funciona como um centro de conta de verdade. Configuracoes continuam sendo o lugar para edicao detalhada, mas aqui o usuario enxerga rapidamente quem ele é no sistema, em que plano está e o quanto o perfil já está pronto para alimentar as recomendacoes.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

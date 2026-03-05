import React, { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

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
  danger: "rgba(239,68,68,1)",
  dangerSoft: "rgba(239,68,68,.12)",
  dangerBorder: "rgba(239,68,68,.35)",
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
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 1000, letterSpacing: 0.2 }}>{title}</div>
        {subtitle ? (
          <div style={{ color: COLORS.muted2, fontSize: 12, lineHeight: 1.35 }}>{subtitle}</div>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 900, fontSize: 13 }}>{label}</div>
        {hint ? <div style={{ color: COLORS.muted2, fontSize: 12 }}>{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.panel2,
        color: COLORS.text,
        outline: "none",
        fontWeight: 800,
        letterSpacing: 0.2,
      }}
    />
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        border: isPrimary
          ? `1px solid ${COLORS.orangeBorder}`
          : isDanger
          ? `1px solid ${COLORS.dangerBorder}`
          : `1px solid ${COLORS.border}`,
        background: isPrimary ? COLORS.orange : isDanger ? COLORS.dangerSoft : "transparent",
        color: isPrimary ? COLORS.bg : COLORS.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 1000,
        boxShadow: isPrimary ? "0 10px 24px rgba(0,0,0,.35)" : "none",
        opacity: disabled ? 0.7 : 1,
        width: "fit-content",
      }}
    >
      {children}
    </button>
  );
}

function Note({ children, accent }: { children: React.ReactNode; accent?: "orange" | "danger" }) {
  const isOrange = accent === "orange";
  const isDanger = accent === "danger";

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 14,
        padding: 12,
        border: isOrange
          ? `1px solid ${COLORS.orangeBorder}`
          : isDanger
          ? `1px solid ${COLORS.dangerBorder}`
          : `1px solid ${COLORS.border2}`,
        background: isOrange ? COLORS.orangeSoft : isDanger ? COLORS.dangerSoft : COLORS.panel2,
        color: COLORS.muted,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

export default function AccountSettingsPage() {
  const { email: authEmail } = useAuth();

  const initialEmail = useMemo(() => authEmail ?? "aluno@email.com", [authEmail]);

  const [name, setName] = useState("Aluno");
  const [email, setEmail] = useState(initialEmail);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  function saveProfile() {
    if (!name.trim()) return alert("Informe seu nome.");
    if (!email.trim() || !email.includes("@")) return alert("Informe um e-mail válido.");
    alert("Configuração salva (placeholder). Próxima fase: integrar API com segurança.");
  }

  function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return alert("Preencha todos os campos de senha.");
    }
    if (newPassword.length < 8) return alert("A nova senha deve ter pelo menos 8 caracteres.");
    if (newPassword !== confirmNewPassword) return alert("Confirmação de senha não confere.");

    alert(
      "Alteração de senha (placeholder). Para ativar de verdade, precisamos do backend (hash + validação + rate limit)."
    );

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  }

  return (
    <div style={{ maxWidth: 860, display: "grid", gap: 14, color: COLORS.text }}>
      <Card
        title="Configurações da conta"
        subtitle="Atualize seus dados e preferências com segurança."
        accent
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 16, letterSpacing: 0.2 }}>Treinaí</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.35 }}>
            A gente mantém o visual limpo e o controle na sua mão. Ajuste seus dados e siga treinando.
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gap: 14 }}>
        <Card title="Dados do cadastro" subtitle="Nome e e-mail (placeholder no MVP).">
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Nome" hint="Como você quer ser chamado">
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
              />
            </Field>

            <Field label="E-mail" hint="Usado no login">
              <TextInput
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seuemail@dominio.com"
                autoComplete="email"
                inputMode="email"
              />
            </Field>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={saveProfile} variant="primary">
                ✅ Salvar dados
              </Button>

              <Button
                onClick={() => {
                  setName("Aluno");
                  setEmail(initialEmail);
                }}
                variant="ghost"
              >
                ↩️ Restaurar
              </Button>
            </div>

            <Note accent="orange">
              Segurança: a plataforma <b>nunca</b> exibe senhas e não salva senha em texto no navegador.
              Alterações reais devem ser feitas via API segura.
            </Note>
          </div>
        </Card>

        <Card title="Alterar senha" subtitle="Placeholder (ativa de verdade com backend).">
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="Senha atual">
              <TextInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>

            <Field label="Nova senha" hint="Mínimo 8 caracteres">
              <TextInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </Field>

            <Field label="Confirmar nova senha">
              <TextInput
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </Field>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button onClick={changePassword} variant="primary">
                🔐 Solicitar alteração
              </Button>

              <Button
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                }}
                variant="ghost"
              >
                Limpar campos
              </Button>
            </div>

            <Note>
              Nenhuma senha é armazenada no front. A troca real exige backend (hash/validação + rate limit).
            </Note>
          </div>
        </Card>
      </div>
    </div>
  );
}
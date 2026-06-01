import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatCpf, formatPhone } from "../../utils/validators";
import StudentCompliancePanel from "./studentCompliance/StudentCompliancePanel";
import { COLORS } from "../../styles/colors";
import { useToast } from "../../components/Toast";
import { API_URL } from "../../services/apiBase";
import { authFetch } from "../../services/apiClient";
import "./accountSettingsPage.css";
import {
  settingsItemRevealVariants,
  settingsPageStaggerVariants,
  settingsSectionRevealVariants,
  settingsSubtleHover,
  settingsSubtleTap,
  useSettingsMotionSafe,
} from "./accountSettingsMotion";

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
        border: `1px solid ${accent ? COLORS.primaryBorder : COLORS.border}`,
        borderRadius: "var(--radius-card)",
        background: accent
          ? `linear-gradient(180deg, ${COLORS.primarySoft} 0%, transparent 55%), ${COLORS.panel}`
          : COLORS.panel,
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        color: COLORS.text,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid var(--color-border-subtle, ${COLORS.border})`,
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{title}</div>
        {subtitle ? (
          <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.35 }}>{subtitle}</div>
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
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        {hint ? <div style={{ color: COLORS.mutedSoft, fontSize: 12 }}>{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { readOnly, ...rest } = props;
  return (
    <input
      {...rest}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: readOnly ? COLORS.panelSoft : COLORS.panelDeep,
        color: readOnly ? COLORS.muted : COLORS.text,
        outline: "none",
        fontWeight: 600,
        letterSpacing: 0.2,
        cursor: readOnly ? "default" : "text",
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
  const cls =
    variant === "primary" ? "btn btn-primary" :
    variant === "danger"  ? "btn btn-danger"  :
                            "btn btn-ghost";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cls}
      style={{ opacity: disabled ? 0.7 : 1, cursor: disabled ? "not-allowed" : "pointer", minHeight: 44 }}
    >
      {children}
    </button>
  );
}

function Note({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: "accent" | "danger";
}) {
  const isAccent = accent === "accent";
  const isDanger = accent === "danger";

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 14,
        padding: 12,
        border: `1px solid ${isAccent ? COLORS.primaryBorder : isDanger ? COLORS.dangerBorder : COLORS.border}`,
        background: isAccent ? COLORS.primarySoft : isDanger ? COLORS.dangerSoft : COLORS.panelDeep,
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
  const { user, accessProfile, getUser } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion } = useSettingsMotionSafe({ isMobile });
  const isLimitedProfile = accessProfile === "clientes_sb";
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfMasked, setCpfMasked] = useState("—");

  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;
    setName(user.name?.trim() || "");
    setEmail(user.email || "");
    setPhone(user.phone ? formatPhone(user.phone) : "");
    setCpfMasked(user.cpf ? formatCpf(user.cpf) : "—");
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const focusCompliance = params.get("focus") === "compliance";
    const hasComplianceHash = location.hash === "#compliance";
    if (!focusCompliance && !hasComplianceHash) return;
    let attempts = 0;
    const maxAttempts = 8;
    const timer = window.setInterval(() => {
      const target = document.getElementById("compliance");
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        window.clearInterval(timer);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [location.hash, location.search]);

  async function refreshFromServer() {
    const latest = await getUser();
    if (latest) {
      setName(latest.name?.trim() || "");
      setEmail(latest.email || "");
      setPhone(latest.phone ? formatPhone(latest.phone) : "");
      setCpfMasked(latest.cpf ? formatCpf(latest.cpf) : "—");
    }
  }

  async function saveProfile() {
    if (!name.trim()) { toast.error("Informe seu nome."); return; }
    setSavingProfile(true);
    try {
      const res = await authFetch(`${API_URL}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || "Falha ao salvar dados.");
      }
      await refreshFromServer();
      toast.success("Dados salvos com sucesso.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <motion.div
      className="account-settings-root"
      variants={settingsPageStaggerVariants}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
      style={{
        maxWidth: "min(860px, 100%)",
        width: "100%",
        minWidth: 0,
        display: "grid",
        gap: 14,
        color: COLORS.text,
        boxSizing: "border-box",
      }}
    >
      {isLimitedProfile ? (
        <motion.div className="account-settings-section" variants={settingsSectionRevealVariants}>
          <Note accent="accent">
            <b>Plano clientes SB:</b> o app mantém o foco em Hoje e Treinos em casa. Aqui você acompanha e ajusta seus dados básicos
            de contato quando a API de atualização estiver ativa.
          </Note>
        </motion.div>
      ) : null}

      {user?.role === "user" ? (
        <motion.div
          className="account-settings-section"
          variants={settingsSectionRevealVariants}
          style={{ display: "grid", gap: 10, minWidth: 0 }}
        >
          <motion.div
            variants={settingsItemRevealVariants}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView={shouldReduceMotion ? undefined : "show"}
            viewport={{ once: true, amount: 0.12 }}
            style={{ display: "grid", gap: 8 }}
          >
            <div style={{ fontWeight: 600, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: COLORS.mutedSoft }}>
              Saúde &amp; compliance
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                background: COLORS.panelDeep,
                overflow: "hidden",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <motion.div
                initial={shouldReduceMotion ? false : { scaleX: 0 }}
                animate={{ scaleX: user.studentComplianceComplete ? 1 : 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
                style={{
                  height: "100%",
                  borderRadius: 999,
                  transformOrigin: "left center",
                  background: "var(--gradient-primary)",
                  boxShadow: user.studentComplianceComplete ? `0 0 18px ${COLORS.primary}55` : undefined,
                }}
              />
            </div>
            <div style={{ color: COLORS.mutedSoft, fontSize: 12, lineHeight: 1.35 }}>
              {user.studentComplianceComplete ? "Cadastro de compliance concluído." : "Complete triagem e PAR-Q para liberar o uso completo."}
            </div>
          </motion.div>

          <motion.div
            variants={settingsItemRevealVariants}
            initial={shouldReduceMotion ? false : "hidden"}
            whileInView={shouldReduceMotion ? undefined : "show"}
            viewport={{ once: true, amount: 0.08 }}
            style={{ minWidth: 0 }}
          >
            {/* Formulário de compliance renderizado direto, SEM card interativo
                (tilt/whileTap/preserve-3d capturavam o toque do bloco inteiro no
                mobile, deixando botões/checkboxes/assinatura não-clicáveis). O
                painel já tem borda, fundo e padding próprios. */}
            <StudentCompliancePanel />
          </motion.div>
        </motion.div>
      ) : null}

      <motion.div className="account-settings-section" variants={settingsSectionRevealVariants} style={{ display: "grid", gap: 14 }}>
        <motion.div
          variants={settingsItemRevealVariants}
          initial={shouldReduceMotion ? false : "hidden"}
          whileInView={shouldReduceMotion ? undefined : "show"}
          viewport={{ once: true, amount: 0.12 }}
        >
          <motion.div
            className="account-settings-card-shell"
            whileHover={shouldReduceMotion ? undefined : { scale: 1.006, transition: { duration: 0.24 } }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.994 }}
          >
            <Card title="Dados e contato" subtitle="Preenchidos a partir do seu usuário autenticado (backend / sessão).">
              <div style={{ display: "grid", gap: 12 }}>
                <Field label="Nome" hint="Como você quer ser chamado">
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                  />
                </Field>

                <Field label="E-mail" hint="Identificador de login — não alterar aqui">
                  <TextInput value={email} readOnly placeholder="seuemail@dominio.com" autoComplete="email" />
                </Field>

                <Field label="Telefone" hint="WhatsApp ou celular para contato">
                  <TextInput
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </Field>

                <Field label="CPF" hint="Cadastro — somente leitura">
                  <TextInput value={cpfMasked} readOnly placeholder="—" autoComplete="off" />
                </Field>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <motion.div
                    className="account-settings-primary-cta"
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button onClick={() => void saveProfile()} variant="primary" disabled={savingProfile}>
                      {savingProfile ? "Salvando..." : "Salvar dados"}
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button onClick={() => void refreshFromServer()} variant="ghost">
                      Atualizar da sessão
                    </Button>
                  </motion.div>
                </div>

              </div>
            </Card>
          </motion.div>
        </motion.div>

      </motion.div>
    </motion.div>
  );
}

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import InteractiveSurfaceCard from "../../components/InteractiveSurfaceCard";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatCpf, formatPhone, getStrongPasswordError } from "../../utils/validators";
import StudentCompliancePanel from "./studentCompliance/StudentCompliancePanel";
import { useNeonTheme, type NeonTheme } from "../../theme/minutofitNeonTheme";
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
  neon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: boolean;
  neon: NeonTheme;
}) {
  return (
    <div
      style={{
        border: accent ? `1px solid ${neon.accentBorder}` : `1px solid ${neon.border}`,
        borderRadius: 16,
        background: accent
          ? `linear-gradient(180deg, ${neon.accentSoft}, rgba(255,255,255,0) 55%), ${neon.panel}`
          : neon.panel,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
        overflow: "hidden",
        color: neon.text,
      }}
    >
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${neon.border2}`,
          display: "grid",
          gap: 4,
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{title}</div>
        {subtitle ? (
          <div style={{ color: neon.muted2, fontSize: 12, lineHeight: 1.35 }}>{subtitle}</div>
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
  neon,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  neon: NeonTheme;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
        {hint ? <div style={{ color: neon.muted2, fontSize: 12 }}>{hint}</div> : null}
      </div>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { neon: NeonTheme }) {
  const { readOnly, neon, ...rest } = props;
  return (
    <input
      {...rest}
      readOnly={readOnly}
      style={{
        width: "100%",
        padding: "12px 12px",
        borderRadius: 14,
        border: `1px solid ${neon.border}`,
        background: readOnly ? "#FAFAFA" : neon.panel2,
        color: readOnly ? neon.muted : neon.text,
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
  neon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  neon: NeonTheme;
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
          ? `1px solid ${neon.accentBorder}`
          : isDanger
            ? `1px solid ${neon.dangerBorder}`
            : `1px solid ${neon.border}`,
        background: isPrimary ? neon.ctaGradient : isDanger ? neon.dangerSoft : "transparent",
        color: isPrimary ? neon.ctaText : neon.text,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        boxShadow: isPrimary ? "0 10px 24px rgba(0,0,0,.35)" : "none",
        opacity: disabled ? 0.7 : 1,
        width: "fit-content",
        minHeight: 44,
      }}
    >
      {children}
    </button>
  );
}

function Note({
  children,
  accent,
  neon,
}: {
  children: React.ReactNode;
  accent?: "accent" | "danger";
  neon: NeonTheme;
}) {
  const isAccent = accent === "accent";
  const isDanger = accent === "danger";

  return (
    <div
      style={{
        marginTop: 4,
        borderRadius: 14,
        padding: 12,
        border: isAccent
          ? `1px solid ${neon.accentBorder}`
          : isDanger
            ? `1px solid ${neon.dangerBorder}`
            : `1px solid ${neon.border2}`,
        background: isAccent ? neon.accentSoft : isDanger ? neon.dangerSoft : neon.panel2,
        color: neon.muted,
        fontSize: 13,
        lineHeight: 1.4,
      }}
    >
      {children}
    </div>
  );
}

export default function AccountSettingsPage() {
  const neon = useNeonTheme();
  const { user, accessProfile, getUser } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile(720);
  const { shouldReduceMotion, shouldUseTilt } = useSettingsMotionSafe({ isMobile });
  const isLimitedProfile = accessProfile === "clientes_sb";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfMasked, setCpfMasked] = useState("—");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

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

  function saveProfile() {
    if (!name.trim()) return alert("Informe seu nome.");
    if (!phone.trim()) return alert("Informe um telefone para contato.");
    alert(
      "Salvamento no servidor ainda será conectado à API. Por enquanto seus dados exibidos vêm da sessão atual; use “Atualizar da sessão” após mudanças feitas em outro lugar.",
    );
  }

  function changePassword() {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return alert("Preencha todos os campos de senha.");
    }
    const pwErr = getStrongPasswordError(newPassword);
    if (pwErr) return alert(pwErr);
    if (newPassword !== confirmNewPassword) return alert("Confirmação de senha não confere.");

    alert(
      "Alteração de senha (placeholder). Para ativar de verdade, precisamos do backend (hash + validação + rate limit).",
    );

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
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
        color: neon.text,
        boxSizing: "border-box",
      }}
    >
      {isLimitedProfile ? (
        <motion.div className="account-settings-section" variants={settingsSectionRevealVariants}>
          <Note accent="accent" neon={neon}>
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
            <div style={{ fontWeight: 600, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: neon.muted2 }}>
              Saúde &amp; compliance
            </div>
            <div
              style={{
                height: 5,
                borderRadius: 999,
                background: "#F9FAFB",
                overflow: "hidden",
                border: `1px solid ${neon.border2}`,
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
                  background: neon.ctaGradient,
                  boxShadow: user.studentComplianceComplete ? `0 0 18px ${neon.primary}55` : undefined,
                }}
              />
            </div>
            <div style={{ color: neon.muted2, fontSize: 12, lineHeight: 1.35 }}>
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
            <InteractiveSurfaceCard
              enableTilt={shouldUseTilt}
              whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
              whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
              style={{
                borderRadius: 16,
                padding: 0,
                background: "transparent",
                boxShadow: "none",
                overflow: "visible",
              }}
            >
              <StudentCompliancePanel />
            </InteractiveSurfaceCard>
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
            <Card neon={neon} title="Dados e contato" subtitle="Preenchidos a partir do seu usuário autenticado (backend / sessão).">
              <div style={{ display: "grid", gap: 12 }}>
                <Field neon={neon} label="Nome" hint="Como você quer ser chamado">
                  <TextInput
                    neon={neon}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                  />
                </Field>

                <Field neon={neon} label="E-mail" hint="Identificador de login — não alterar aqui">
                  <TextInput neon={neon} value={email} readOnly placeholder="seuemail@dominio.com" autoComplete="email" />
                </Field>

                <Field neon={neon} label="Telefone" hint="WhatsApp ou celular para contato">
                  <TextInput
                    neon={neon}
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    inputMode="tel"
                  />
                </Field>

                <Field neon={neon} label="CPF" hint="Cadastro — somente leitura">
                  <TextInput neon={neon} value={cpfMasked} readOnly placeholder="—" autoComplete="off" />
                </Field>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <motion.div
                    className="account-settings-primary-cta"
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            boxShadow: [
                              "0 10px 24px rgba(0,0,0,.35)",
                              "0 12px 28px rgba(34,197,94,.28)",
                              "0 10px 24px rgba(0,0,0,.35)",
                            ],
                          }
                    }
                    transition={shouldReduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button neon={neon} onClick={saveProfile} variant="primary">
                      Salvar dados (quando API estiver ativa)
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button neon={neon} onClick={() => void refreshFromServer()} variant="ghost">
                      Atualizar da sessão
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button
                      neon={neon}
                      onClick={() => {
                        if (!user) return;
                        setName(user.name?.trim() || "");
                        setEmail(user.email || "");
                        setPhone(user.phone ? formatPhone(user.phone) : "");
                        setCpfMasked(user.cpf ? formatCpf(user.cpf) : "—");
                      }}
                      variant="ghost"
                    >
                      Restaurar da sessão
                    </Button>
                  </motion.div>
                </div>

                <Note accent="accent" neon={neon}>
                  Segurança: a plataforma <b>nunca</b> exibe senha em texto. E-mail e CPF seguem as regras do cadastro; a
                  persistência de nome e telefone dependerá do endpoint seguro no backend.
                </Note>
              </div>
            </Card>
          </motion.div>
        </motion.div>

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
            <Card neon={neon} title="Alterar senha" subtitle="Placeholder (ativa de verdade com backend).">
              <div style={{ display: "grid", gap: 12 }}>
                <Field neon={neon} label="Senha atual">
                  <TextInput
                    neon={neon}
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </Field>

                <Field neon={neon} label="Nova senha" hint="Mínimo 8 caracteres">
                  <TextInput
                    neon={neon}
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </Field>

                <Field neon={neon} label="Confirmar nova senha">
                  <TextInput
                    neon={neon}
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </Field>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <motion.div
                    className="account-settings-primary-cta"
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    animate={
                      shouldReduceMotion
                        ? undefined
                        : {
                            boxShadow: [
                              "0 10px 24px rgba(0,0,0,.35)",
                              "0 12px 28px rgba(34,197,94,.28)",
                              "0 10px 24px rgba(0,0,0,.35)",
                            ],
                          }
                    }
                    transition={shouldReduceMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button neon={neon} onClick={changePassword} variant="primary">
                      🔐 Solicitar alteração
                    </Button>
                  </motion.div>

                  <motion.div
                    whileHover={shouldReduceMotion ? undefined : settingsSubtleHover}
                    whileTap={shouldReduceMotion ? undefined : settingsSubtleTap}
                    style={{ width: "fit-content", borderRadius: 14 }}
                  >
                    <Button
                      neon={neon}
                      onClick={() => {
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmNewPassword("");
                      }}
                      variant="ghost"
                    >
                      Limpar campos
                    </Button>
                  </motion.div>
                </div>

                <Note neon={neon}>
                  Nenhuma senha é armazenada no front. A troca real exige backend (hash/validação + rate limit).
                </Note>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import {
  formatCpf,
  formatPhone,
  isValidCpf,
  isValidEmail,
  isValidPhone,
  normalizeCpf,
  normalizePhone,
  getStrongPasswordError,
} from "../utils/validators";
import { LoginFuturisticExperience, TiltGlassFeatureCard } from "./login/LoginFuturisticExperience";
import MinutoFitLogo from "../components/MinutoFitLogo";

const COLORS = {
  panel: "rgba(18, 26, 21, 0.94)",
  border: "rgba(124,255,107,.14)",
  borderStrong: "rgba(29,185,84,.32)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  primary: "#1DB954",
  primaryDeep: "#0F3D2E",
  highlight: "#7CFF6B",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
  danger: "#FF7A7A",
};

type Mode = "login" | "register";

type RegisterForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

function nextPathByRole(role: Role) {
  switch (role) {
    case "user":
      return "/app/user/today";
    case "personal":
      return "/app/personal";
    case "nutri":
      return "/app/nutri";
    case "admin":
      return "/app/admin";
    default:
      return "/login";
  }
}

function fieldStyle(disabled: boolean, invalid = false) {
  return {
    background: "rgba(8,14,11,.78)",
    color: COLORS.text,
    border: `1px solid ${invalid ? "rgba(255,122,122,.55)" : COLORS.border}`,
    borderRadius: 16,
    padding: "14px 14px",
    outline: "none",
    opacity: disabled ? 0.7 : 1,
    width: "100%",
    boxSizing: "border-box" as const,
  };
}

const initialRegisterState: RegisterForm = {
  name: "",
  cpf: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const turnstileSiteKey =
  typeof import.meta.env.VITE_TURNSTILE_SITE_KEY === "string"
    ? import.meta.env.VITE_TURNSTILE_SITE_KEY.trim() || undefined
    : undefined;

export default function LoginPage() {
  const nav = useNavigate();
  const { login, register, isAuthenticated, role } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerForm, setRegisterForm] = useState<RegisterForm>(initialRegisterState);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && role) {
      nav(nextPathByRole(role), { replace: true });
    }
  }, [isAuthenticated, role, nav]);

  useEffect(() => {
    if (mode !== "register") {
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    }
  }, [mode]);

  const registerErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!registerForm.name.trim()) errors.name = "Informe seu nome completo.";
    if (!registerForm.email.trim()) errors.email = "Informe seu email.";
    else if (!isValidEmail(registerForm.email)) errors.email = "Informe um email válido.";

    if (!registerForm.cpf.trim()) errors.cpf = "Informe seu CPF.";
    else if (!isValidCpf(registerForm.cpf)) errors.cpf = "CPF inválido.";

    if (!registerForm.phone.trim()) errors.phone = "Informe seu telefone.";
    else if (!isValidPhone(registerForm.phone)) errors.phone = "Telefone inválido.";

    if (!registerForm.password) errors.password = "Crie uma senha.";
    else {
      const pwErr = getStrongPasswordError(registerForm.password);
      if (pwErr) errors.password = pwErr;
    }

    if (!registerForm.confirmPassword) errors.confirmPassword = "Confirme sua senha.";
    else if (registerForm.confirmPassword !== registerForm.password) errors.confirmPassword = "As senhas não coincidem.";

    if (turnstileSiteKey && !(captchaToken ?? "").trim()) {
      errors.captcha = "Complete a verificação anti-robô abaixo.";
    }

    return errors;
  }, [registerForm, captchaToken]);

  const isRegisterValid = Object.keys(registerErrors).length === 0;

  function updateRegisterField<K extends keyof RegisterForm>(field: K, value: RegisterForm[K]) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  async function onLoginSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const res = await login(email, password);
    if (!res.ok) {
      setError(res.message);
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    nav(nextPathByRole(res.role), { replace: true });
  }

  async function onRegisterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!isRegisterValid) {
      setError("Revise os campos destacados antes de continuar.");
      return;
    }

    setIsLoading(true);
    const result = await register({
      name: registerForm.name.trim(),
      cpf: normalizeCpf(registerForm.cpf),
      phone: normalizePhone(registerForm.phone),
      email: registerForm.email.trim().toLowerCase(),
      password: registerForm.password,
      captchaToken: captchaToken ?? undefined,
    });

    if (!result.ok) {
      setError(result.message);
      setIsLoading(false);
      turnstileRef.current?.reset();
      setCaptchaToken(null);
      return;
    }

    setIsLoading(false);
    nav("/profile-completion", { replace: true });
  }

  const heroVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.05 },
    },
  };

  const heroItem = {
    hidden: { opacity: 0, y: 24 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 28 },
    },
  };

  return (
    <LoginFuturisticExperience
      hero={
        <>
          <motion.div variants={heroVariants} initial="hidden" animate="show" style={{ display: "grid", gap: 28 }}>
            <motion.div variants={heroItem}>
              <MinutoFitLogo width={236} style={{ maxWidth: "100%" }} />
            </motion.div>

            <motion.div variants={heroItem}>
              <motion.div
                className="login-future-neon-badge"
                animate={{ scale: [1, 1.03, 1], opacity: [0.88, 1, 0.88] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  borderRadius: 999,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.highlightSoft,
                  color: COLORS.highlight,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Ecossistema fitness digital
              </motion.div>
            </motion.div>

            <motion.div variants={heroItem} className="authHeroTitle login-future-title-glow">
              Entre no futuro do seu treino.
            </motion.div>

            <motion.div variants={heroItem} className="authHeroText">
              Uma experiência viva, responsiva e energética — da primeira tela ao seu plano. Cadastro rápido com senha
              forte e CAPTCHA; triagem de saúde, onboarding de treino e PAR-Q você completa em Configurações após entrar.
            </motion.div>

            <motion.div variants={heroItem} style={{ display: "grid", gap: 14, maxWidth: 580 }}>
              {[
                "Cadastro enxuto: só dados de identificação e segurança na primeira tela.",
                "CPF único e validado para reduzir fraude e duplicidade.",
                "Saúde, preferências de treino e PAR-Q com assinatura digital ficam em Minha conta / Configurações.",
              ].map((item) => (
                <TiltGlassFeatureCard key={item}>
                  <div style={{ color: COLORS.text, fontSize: 15, lineHeight: 1.55 }}>
                    <span style={{ color: COLORS.highlight, fontWeight: 900, marginRight: 10 }}>●</span>
                    {item}
                  </div>
                </TiltGlassFeatureCard>
              ))}
            </motion.div>
          </motion.div>
        </>
      }
      card={
        <>
          <div className="authTabs">
            {[
              { key: "login" as const, label: "Entrar" },
              { key: "register" as const, label: "Criar conta" },
            ].map((tab) => {
              const active = mode === tab.key;
              return (
                <motion.button
                  key={tab.key}
                  type="button"
                  layout
                  whileHover={{ scale: 1.02, boxShadow: "0 0 24px rgba(124,255,107,0.15)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setMode(tab.key);
                    setError(null);
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
                    background: active ? COLORS.primarySoft : "rgba(255,255,255,.03)",
                    color: active ? COLORS.highlight : COLORS.muted,
                    padding: "12px 14px",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </motion.button>
              );
            })}
          </div>

          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 999,
                background: COLORS.primarySoft,
                color: COLORS.highlight,
                padding: "7px 12px",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              {mode === "login" ? "Acesso MinutoFit" : "Criar conta"}
            </div>
            <div style={{ marginTop: 16, fontSize: 30, fontWeight: 900, letterSpacing: 0.2 }}>
              {mode === "login" ? "Entrar" : "Criar conta"}
            </div>
            <div style={{ color: COLORS.muted, marginTop: 8 }}>
              {mode === "login"
                ? "Acesse com email e senha. O login social fica oculto por enquanto para evitar fluxos incompletos."
                : "Depois de criar a conta você completa o perfil físico e, em seguida, a triagem obrigatória em Configurações (saúde, treino e PAR-Q)."}
            </div>
          </div>

          {error ? (
            <div
              style={{
                background: "rgba(255,122,122,.1)",
                border: `1px solid rgba(255,122,122,.35)`,
                padding: 12,
                borderRadius: 16,
                marginBottom: 14,
                color: COLORS.text,
              }}
            >
              {error}
            </div>
          ) : null}

          {mode === "login" ? (
            <form onSubmit={onLoginSubmit} className="authForm">
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ex: usuario@exemplo.com"
                  autoComplete="email"
                  disabled={isLoading}
                  style={fieldStyle(isLoading)}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ color: COLORS.muted, fontSize: 13 }}>Senha</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••"
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  style={fieldStyle(isLoading)}
                />
              </label>

              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={isLoading ? undefined : { scale: 1.02, boxShadow: "0 0 32px rgba(124,255,107,0.35)" }}
                whileTap={isLoading ? undefined : { scale: 0.98 }}
                style={{
                  marginTop: 6,
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.highlight} 100%)`,
                  color: "#082014",
                  border: `1px solid ${COLORS.borderStrong}`,
                  borderRadius: 16,
                  padding: "14px 14px",
                  fontWeight: 800,
                  cursor: isLoading ? "not-allowed" : "pointer",
                  opacity: isLoading ? 0.7 : 1,
                  boxShadow: "0 14px 28px rgba(29,185,84,.22)",
                }}
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={onRegisterSubmit} className="authForm authFormScrollable">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Identificação e contato</div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Nome completo</span>
                  <input
                    value={registerForm.name}
                    onChange={(event) => updateRegisterField("name", event.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    disabled={isLoading}
                    style={fieldStyle(isLoading, Boolean(registerErrors.name))}
                  />
                  {registerErrors.name ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.name}</span> : null}
                </label>

                <div className="authTwoCol">
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>CPF</span>
                    <input
                      value={registerForm.cpf}
                      onChange={(event) => updateRegisterField("cpf", formatCpf(event.target.value))}
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      disabled={isLoading}
                      style={fieldStyle(isLoading, Boolean(registerErrors.cpf))}
                    />
                    {registerErrors.cpf ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.cpf}</span> : null}
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Telefone</span>
                    <input
                      value={registerForm.phone}
                      onChange={(event) => updateRegisterField("phone", formatPhone(event.target.value))}
                      placeholder="(85) 99999-9999"
                      autoComplete="tel"
                      disabled={isLoading}
                      style={fieldStyle(isLoading, Boolean(registerErrors.phone))}
                    />
                    {registerErrors.phone ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.phone}</span> : null}
                  </label>
                </div>

                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13 }}>Email</span>
                  <input
                    value={registerForm.email}
                    onChange={(event) => updateRegisterField("email", event.target.value)}
                    placeholder="ex: usuario@exemplo.com"
                    autoComplete="email"
                    disabled={isLoading}
                    style={fieldStyle(isLoading, Boolean(registerErrors.email))}
                  />
                  {registerErrors.email ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.email}</span> : null}
                </label>

                <div className="authTwoCol">
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Senha</span>
                    <input
                      value={registerForm.password}
                      onChange={(event) => updateRegisterField("password", event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      disabled={isLoading}
                      style={fieldStyle(isLoading, Boolean(registerErrors.password))}
                    />
                    {registerErrors.password ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.password}</span> : null}
                  </label>

                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Confirmar senha</span>
                    <input
                      value={registerForm.confirmPassword}
                      onChange={(event) => updateRegisterField("confirmPassword", event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      disabled={isLoading}
                      style={fieldStyle(isLoading, Boolean(registerErrors.confirmPassword))}
                    />
                    {registerErrors.confirmPassword ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.confirmPassword}</span> : null}
                  </label>
                </div>
                <p style={{ color: COLORS.mutedSoft, fontSize: 12, margin: 0, lineHeight: 1.45 }}>
                  A senha deve ter no mínimo 8 caracteres, incluir 1 letra maiúscula e 1 símbolo (por exemplo ! @ # $ %).
                </p>
                <p style={{ color: COLORS.muted, fontSize: 12, margin: "10px 0 0", lineHeight: 1.45 }}>
                  Triagem de saúde, preferências de treino e PAR-Q com assinatura ficam em{" "}
                  <b style={{ color: COLORS.text }}>Configurações</b> após o login (obrigatório para uso completo).
                </p>
              </div>

              {turnstileSiteKey ? (
                <div style={{ display: "grid", gap: 8, marginTop: 4 }}>
                  <span style={{ color: COLORS.muted, fontSize: 13, fontWeight: 800 }}>Verificação anti-robô</span>
                  <Turnstile
                    ref={turnstileRef}
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken(null)}
                    options={{ theme: "dark" }}
                  />
                  {registerErrors.captcha ? (
                    <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.captcha}</span>
                  ) : null}
                </div>
              ) : import.meta.env.DEV ? (
                <p style={{ color: COLORS.mutedSoft, fontSize: 12, margin: "8px 0 0", lineHeight: 1.45 }}>
                  Desenvolvimento: sem <code style={{ color: COLORS.muted }}>VITE_TURNSTILE_SITE_KEY</code>. No backend use{" "}
                  <code style={{ color: COLORS.muted }}>SKIP_CAPTCHA=true</code> ou configure Turnstile em produção.
                </p>
              ) : null}

              <motion.button
                type="submit"
                disabled={isLoading || !isRegisterValid}
                whileHover={
                  isLoading || !isRegisterValid ? undefined : { scale: 1.02, boxShadow: "0 0 32px rgba(124,255,107,0.35)" }
                }
                whileTap={isLoading || !isRegisterValid ? undefined : { scale: 0.98 }}
                style={{
                  marginTop: 6,
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.highlight} 100%)`,
                  color: "#082014",
                  border: `1px solid ${COLORS.borderStrong}`,
                  borderRadius: 16,
                  padding: "14px 14px",
                  fontWeight: 800,
                  cursor: isLoading || !isRegisterValid ? "not-allowed" : "pointer",
                  opacity: isLoading || !isRegisterValid ? 0.65 : 1,
                  boxShadow: "0 14px 28px rgba(29,185,84,.22)",
                }}
              >
                {isLoading ? "Criando conta..." : "Criar conta e continuar"}
              </motion.button>
            </form>
          )}
        </>
      }
    />
  );
}

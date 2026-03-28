import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../auth/AuthContext";
import {
  buildRecommendation,
  saveAnswers,
  saveRecommendation,
  setOnboardingDone,
  type OnboardingAnswers,
} from "./user/onboarding/onboardingStorage";
import {
  formatCpf,
  formatPhone,
  isValidCpf,
  isValidEmail,
  isValidPhone,
  normalizeCpf,
  normalizePhone,
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

type HealthField =
  | "sem_historico_hipertensao"
  | "sem_historico_cardiaco"
  | "sem_restricao_medica_exercicio"
  | "apto_para_atividade_fisica"
  | "aceita_responsabilidade_informacoes";

type RegisterOnboardingForm = {
  trainingPlace: OnboardingAnswers["trainingPlace"] | "";
  timePerDay: OnboardingAnswers["timePerDay"] | "";
  injuries: OnboardingAnswers["injuries"];
  surgeryRecent: OnboardingAnswers["surgeryRecent"] | "";
  frequentPain: OnboardingAnswers["frequentPain"] | "";
  daysPerWeek: OnboardingAnswers["daysPerWeek"] | 0;
  bestTime: OnboardingAnswers["bestTime"] | "";
  intensityPref: OnboardingAnswers["intensityPref"] | "";
  equipmentPref: OnboardingAnswers["equipmentPref"] | "";
  wantsCloseFollow: OnboardingAnswers["wantsCloseFollow"] | "";
};

type RegisterForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  healthFlags: Record<HealthField, boolean>;
  onboarding: RegisterOnboardingForm;
};

function nextPathByRole(role: Role) {
  switch (role) {
    case "user":
      return "/app/user";
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

function pillStyle(active: boolean, disabled: boolean) {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
    background: active ? COLORS.primarySoft : "rgba(255,255,255,.03)",
    color: COLORS.text,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    fontWeight: 900,
  };
}

const initialRegisterState: RegisterForm = {
  name: "",
  cpf: "",
  phone: "",
  email: "",
  password: "",
  confirmPassword: "",
  healthFlags: {
    sem_historico_hipertensao: false,
    sem_historico_cardiaco: false,
    sem_restricao_medica_exercicio: false,
    apto_para_atividade_fisica: false,
    aceita_responsabilidade_informacoes: false,
  },
  onboarding: {
    trainingPlace: "",
    timePerDay: "",
    injuries: [],
    surgeryRecent: "",
    frequentPain: "",
    daysPerWeek: 0,
    bestTime: "",
    intensityPref: "",
    equipmentPref: "",
    wantsCloseFollow: "",
  },
};

const injuryOptions: Array<{
  value: OnboardingAnswers["injuries"][number];
  label: string;
}> = [
  { value: "none", label: "Nenhuma" },
  { value: "joelho", label: "Joelho" },
  { value: "ombro", label: "Ombro" },
  { value: "lombar", label: "Lombar" },
  { value: "tornozelo", label: "Tornozelo" },
  { value: "outra", label: "Outra" },
];

function SelectGroup<T extends string | number>({
  value,
  options,
  disabled,
  onSelect,
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  disabled: boolean;
  onSelect: (value: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option.value)}
          style={pillStyle(value === option.value, disabled)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function LoginPage() {
  const nav = useNavigate();
  const { login, register, isAuthenticated, role } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
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
    else if (registerForm.password.length < 6) errors.password = "A senha precisa ter pelo menos 6 caracteres.";

    if (!registerForm.confirmPassword) errors.confirmPassword = "Confirme sua senha.";
    else if (registerForm.confirmPassword !== registerForm.password) errors.confirmPassword = "As senhas não coincidem.";

    if (!registerForm.healthFlags.sem_historico_hipertensao) {
      errors.sem_historico_hipertensao = "Confirme sua condição atual para seguir.";
    }
    if (!registerForm.healthFlags.sem_historico_cardiaco) {
      errors.sem_historico_cardiaco = "Confirme sua condição atual para seguir.";
    }
    if (!registerForm.healthFlags.sem_restricao_medica_exercicio) {
      errors.sem_restricao_medica_exercicio = "Confirme sua condição atual para seguir.";
    }
    if (!registerForm.healthFlags.apto_para_atividade_fisica) {
      errors.apto_para_atividade_fisica = "Você precisa confirmar que está apto para iniciar atividades físicas.";
    }
    if (!registerForm.healthFlags.aceita_responsabilidade_informacoes) {
      errors.aceita_responsabilidade_informacoes = "Você precisa aceitar a declaração final.";
    }

    if (!registerForm.onboarding.trainingPlace) errors.trainingPlace = "Escolha onde você treina.";
    if (!registerForm.onboarding.timePerDay) errors.timePerDay = "Escolha quanto tempo você tem por dia.";
    if (!registerForm.onboarding.daysPerWeek) errors.daysPerWeek = "Escolha sua frequência semanal.";
    if (!registerForm.onboarding.bestTime) errors.bestTime = "Escolha o melhor horário.";
    if (!registerForm.onboarding.equipmentPref) errors.equipmentPref = "Escolha a preferência de equipamento.";
    if (!registerForm.onboarding.intensityPref) errors.intensityPref = "Escolha a intensidade preferida.";
    if (!registerForm.onboarding.wantsCloseFollow) errors.wantsCloseFollow = "Defina se quer acompanhamento mais próximo.";
    if (!registerForm.onboarding.surgeryRecent) errors.surgeryRecent = "Informe se houve cirurgia recente.";
    if (!registerForm.onboarding.frequentPain) errors.frequentPain = "Informe como está sua relação com dor ao treinar.";
    if (!registerForm.onboarding.injuries.length) errors.injuries = "Escolha ao menos uma opção.";

    return errors;
  }, [registerForm]);

  const isRegisterValid = Object.keys(registerErrors).length === 0;

  function updateRegisterField<K extends keyof RegisterForm>(field: K, value: RegisterForm[K]) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
  }

  function updateHealthFlag(field: HealthField, value: boolean) {
    setRegisterForm((current) => ({
      ...current,
      healthFlags: {
        ...current.healthFlags,
        [field]: value,
      },
    }));
  }

  function updateOnboardingField<K extends keyof RegisterOnboardingForm>(field: K, value: RegisterOnboardingForm[K]) {
    setRegisterForm((current) => ({
      ...current,
      onboarding: {
        ...current.onboarding,
        [field]: value,
      },
    }));
  }

  function toggleInjury(injury: OnboardingAnswers["injuries"][number]) {
    setRegisterForm((current) => {
      const selected = current.onboarding.injuries;
      let next: OnboardingAnswers["injuries"];

      if (injury === "none") {
        next = ["none"];
      } else {
        const withoutNone = selected.filter((item) => item !== "none");
        next = withoutNone.includes(injury)
          ? (withoutNone.filter((item) => item !== injury) as OnboardingAnswers["injuries"])
          : ([...withoutNone, injury] as OnboardingAnswers["injuries"]);
      }

      return {
        ...current,
        onboarding: {
          ...current.onboarding,
          injuries: next.length ? next : [],
        },
      };
    });
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
      healthFlags: registerForm.healthFlags,
    });

    if (!result.ok) {
      setError(result.message);
      setIsLoading(false);
      return;
    }

    const onboardingAnswers: OnboardingAnswers = {
      trainingPlace: registerForm.onboarding.trainingPlace as OnboardingAnswers["trainingPlace"],
      timePerDay: registerForm.onboarding.timePerDay as OnboardingAnswers["timePerDay"],
      injuries: registerForm.onboarding.injuries as OnboardingAnswers["injuries"],
      surgeryRecent: registerForm.onboarding.surgeryRecent as OnboardingAnswers["surgeryRecent"],
      frequentPain: registerForm.onboarding.frequentPain as OnboardingAnswers["frequentPain"],
      daysPerWeek: registerForm.onboarding.daysPerWeek as OnboardingAnswers["daysPerWeek"],
      bestTime: registerForm.onboarding.bestTime as OnboardingAnswers["bestTime"],
      intensityPref: registerForm.onboarding.intensityPref as OnboardingAnswers["intensityPref"],
      equipmentPref: registerForm.onboarding.equipmentPref as OnboardingAnswers["equipmentPref"],
      wantsCloseFollow: registerForm.onboarding.wantsCloseFollow as OnboardingAnswers["wantsCloseFollow"],
    };

    saveAnswers(onboardingAnswers, result.id);
    saveRecommendation(buildRecommendation(onboardingAnswers), result.id);
    setOnboardingDone(result.id);

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
              Uma experiência viva, responsiva e energética — da primeira tela ao seu plano. Cadastro completo, dados
              seguros e contexto de treino desde o primeiro acesso.
            </motion.div>

            <motion.div variants={heroItem} style={{ display: "grid", gap: 14, maxWidth: 580 }}>
              {[
                "Cadastro completo em uma única etapa, sem jogar o onboarding para depois.",
                "CPF único e validado para reduzir fraude e duplicidade.",
                "Rotina, intensidade e limitações práticas entram desde o primeiro acesso.",
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
              {mode === "login" ? "Acesso MinutoFit" : "Cadastro + onboarding"}
            </div>
            <div style={{ marginTop: 16, fontSize: 30, fontWeight: 900, letterSpacing: 0.2 }}>
              {mode === "login" ? "Entrar" : "Criar conta"}
            </div>
            <div style={{ color: COLORS.muted, marginTop: 8 }}>
              {mode === "login"
                ? "Acesse com email e senha. O login social fica oculto por enquanto para evitar fluxos incompletos."
                : "Crie sua conta e já defina o contexto da sua rotina de treino. Depois disso, faltará apenas completar seu perfil físico."}
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
              </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>Saúde inicial</div>
                <div
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${COLORS.border}`,
                    background: "rgba(255,255,255,.03)",
                    padding: "16px 16px 6px",
                  }}
                >
                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                    Essas confirmações ajudam a iniciar o app com mais responsabilidade. Se alguma delas não refletir sua situação atual, o ideal é buscar orientação médica antes de continuar.
                  </div>

                  {[
                    ["sem_historico_hipertensao", "Sem histórico de hipertensão."],
                    ["sem_historico_cardiaco", "Sem histórico cardíaco relevante."],
                    ["sem_restricao_medica_exercicio", "Sem restrição médica atual para exercícios."],
                    ["apto_para_atividade_fisica", "Declaro que estou apto para iniciar atividade física."],
                    ["aceita_responsabilidade_informacoes", "Confirmo que as informações prestadas são verdadeiras e de minha responsabilidade."],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1fr",
                        gap: 10,
                        alignItems: "start",
                        marginBottom: 12,
                        color: COLORS.text,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={registerForm.healthFlags[key as HealthField]}
                        onChange={(event) => updateHealthFlag(key as HealthField, event.target.checked)}
                        disabled={isLoading}
                        style={{ marginTop: 3 }}
                      />
                      <span>
                        <div>{label}</div>
                        {registerErrors[key] ? <div style={{ color: COLORS.danger, fontSize: 12, marginTop: 4 }}>{registerErrors[key]}</div> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>Onboarding obrigatório de treino</div>
                <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Antes do primeiro acesso, já definimos o contexto da sua rotina. Isso evita uma segunda tela obrigatória depois.
                </div>

                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Onde você treina?</span>
                    <SelectGroup
                      value={registerForm.onboarding.trainingPlace}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("trainingPlace", value)}
                      options={[
                        { value: "home", label: "Em casa" },
                        { value: "gym", label: "Academia" },
                        { value: "both", label: "Ambos" },
                      ]}
                    />
                    {registerErrors.trainingPlace ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.trainingPlace}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Tempo disponível por dia</span>
                    <SelectGroup
                      value={registerForm.onboarding.timePerDay}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("timePerDay", value)}
                      options={[
                        { value: "10-15", label: "10-15 min" },
                        { value: "20-30", label: "20-30 min" },
                        { value: "30-45", label: "30-45 min" },
                        { value: "60+", label: "60+ min" },
                      ]}
                    />
                    {registerErrors.timePerDay ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.timePerDay}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Dias por semana</span>
                    <SelectGroup
                      value={registerForm.onboarding.daysPerWeek}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("daysPerWeek", value)}
                      options={[
                        { value: 2, label: "2x" },
                        { value: 3, label: "3x" },
                        { value: 4, label: "4x" },
                        { value: 5, label: "5x" },
                        { value: 6, label: "6x" },
                      ]}
                    />
                    {registerErrors.daysPerWeek ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.daysPerWeek}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Melhor horário</span>
                    <SelectGroup
                      value={registerForm.onboarding.bestTime}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("bestTime", value)}
                      options={[
                        { value: "morning", label: "Manhã" },
                        { value: "afternoon", label: "Tarde" },
                        { value: "night", label: "Noite" },
                        { value: "variable", label: "Variável" },
                      ]}
                    />
                    {registerErrors.bestTime ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.bestTime}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Equipamentos preferidos</span>
                    <SelectGroup
                      value={registerForm.onboarding.equipmentPref}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("equipmentPref", value)}
                      options={[
                        { value: "weights", label: "Com peso" },
                        { value: "no_weights", label: "Sem peso" },
                        { value: "both", label: "Tanto faz" },
                      ]}
                    />
                    {registerErrors.equipmentPref ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.equipmentPref}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Intensidade preferida</span>
                    <SelectGroup
                      value={registerForm.onboarding.intensityPref}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("intensityPref", value)}
                      options={[
                        { value: "progressive", label: "Progressiva" },
                        { value: "intense", label: "Intensa" },
                        { value: "any", label: "Tanto faz" },
                      ]}
                    />
                    {registerErrors.intensityPref ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.intensityPref}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Quer acompanhamento mais próximo?</span>
                    <SelectGroup
                      value={registerForm.onboarding.wantsCloseFollow}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("wantsCloseFollow", value)}
                      options={[
                        { value: "yes", label: "Sim" },
                        { value: "no", label: "Não" },
                      ]}
                    />
                    {registerErrors.wantsCloseFollow ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.wantsCloseFollow}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Lesões atuais</span>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {injuryOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          disabled={isLoading}
                          onClick={() => toggleInjury(option.value)}
                          style={pillStyle(registerForm.onboarding.injuries.includes(option.value), isLoading)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {registerErrors.injuries ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.injuries}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Cirurgia recente</span>
                    <SelectGroup
                      value={registerForm.onboarding.surgeryRecent}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("surgeryRecent", value)}
                      options={[
                        { value: "yes", label: "Sim" },
                        { value: "no", label: "Não" },
                      ]}
                    />
                    {registerErrors.surgeryRecent ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.surgeryRecent}</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={{ color: COLORS.muted, fontSize: 13 }}>Dor frequente ao treinar</span>
                    <SelectGroup
                      value={registerForm.onboarding.frequentPain}
                      disabled={isLoading}
                      onSelect={(value) => updateOnboardingField("frequentPain", value)}
                      options={[
                        { value: "no", label: "Não" },
                        { value: "sometimes", label: "Às vezes" },
                        { value: "often", label: "Com frequência" },
                      ]}
                    />
                    {registerErrors.frequentPain ? <span style={{ color: COLORS.danger, fontSize: 12 }}>{registerErrors.frequentPain}</span> : null}
                  </div>
                </div>
              </div>

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

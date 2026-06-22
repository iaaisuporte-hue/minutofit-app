import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth, type Role } from "../auth/AuthContext";
import { GoogleSignInButton } from "../auth/GoogleSignInButton";
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
import CoreFitLogo from "../components/CoreFitLogo";

type RegisterForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialState: RegisterForm = {
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

function appPathForRole(role: Role): string {
  switch (role) {
    case "personal": return "/app/personal";
    case "nutri":    return "/app/nutri";
    case "admin":    return "/app/admin";
    default:         return "/app/user/today";
  }
}

export default function RegisterPage() {
  const nav = useNavigate();
  const { register, loginWithOAuth } = useAuth();
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const [form, setForm]             = useState<RegisterForm>(initialState);
  const [captchaToken, setCaptcha]  = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    if (!form.name.trim())         e.name  = "Informe seu nome completo.";
    if (!form.email.trim())        e.email = "Informe seu email.";
    else if (!isValidEmail(form.email)) e.email = "Informe um email válido.";

    if (!form.cpf.trim())          e.cpf   = "Informe seu CPF.";
    else if (!isValidCpf(form.cpf))     e.cpf   = "CPF inválido.";

    if (!form.phone.trim())        e.phone = "Informe seu telefone.";
    else if (!isValidPhone(form.phone)) e.phone = "Telefone inválido.";

    if (!form.password)            e.password = "Crie uma senha.";
    else {
      const pwErr = getStrongPasswordError(form.password);
      if (pwErr) e.password = pwErr;
    }

    if (!form.confirmPassword)          e.confirmPassword = "Confirme sua senha.";
    else if (form.confirmPassword !== form.password) e.confirmPassword = "As senhas não coincidem.";

    if (turnstileSiteKey && !(captchaToken ?? "").trim()) {
      e.captcha = "Complete a verificação anti-robô abaixo.";
    }

    return e;
  }, [form, captchaToken]);

  const isValid = Object.keys(errors).length === 0;

  function update<K extends keyof RegisterForm>(field: K, value: RegisterForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEmailAlreadyRegistered(false);

    if (!isValid) {
      setError("Revise os campos destacados antes de continuar.");
      return;
    }

    setIsLoading(true);
    const result = await register({
      name:         form.name.trim(),
      cpf:          normalizeCpf(form.cpf),
      phone:        normalizePhone(form.phone),
      email:        form.email.trim().toLowerCase(),
      password:     form.password,
      captchaToken: captchaToken ?? undefined,
    });

      if (!result.ok) {
        const msg = String(result.message || "").toLowerCase();
        const emailTaken =
          result.code === "EMAIL_ALREADY_REGISTERED" ||
          (msg.includes("email") && (msg.includes("ja cadastrado") || msg.includes("já cadastrado")));
        const cpfTaken =
          result.code === "CPF_ALREADY_REGISTERED" ||
          (msg.includes("cpf") && (msg.includes("ja cadastrado") || msg.includes("já cadastrado")));
        if (emailTaken) {
          setEmailAlreadyRegistered(true);
        } else if (cpfTaken) {
          setError("Este CPF já possui conta no CoreFit. Faça login ou use outro CPF.");
        } else {
          setError(result.message);
        }
      setIsLoading(false);
      turnstileRef.current?.reset();
      setCaptcha(null);
      return;
    }

    setIsLoading(false);
    nav("/profile-completion", { replace: true });
  }

  async function onGoogleCredential(idToken: string) {
    setError(null);
    setIsLoading(true);
    const res = await loginWithOAuth("google", idToken);
    if (!res.ok) {
      setError(res.message || "Falha no cadastro com Google.");
      setIsLoading(false);
      return;
    }
    setIsLoading(false);
    nav(res.requiresProfileCompletion ? "/profile-completion" : appPathForRole(res.role), {
      replace: true,
    });
  }

  return (
    <main className="auth-page">
      <form
        className="auth-card"
        style={{ maxWidth: 480 }}
        onSubmit={onSubmit}
        noValidate
      >
        <div className="auth-logo">
          <CoreFitLogo width={140} />
        </div>

        <h1 className="auth-title">Criar conta</h1>
        <p className="auth-subtitle">
          Após criar a conta você completa o perfil físico e a triagem obrigatória em Configurações.
        </p>

        <GoogleSignInButton onCredential={onGoogleCredential} text="signup_with" />
        <div className="auth-divider"><span>ou preencha seus dados</span></div>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {emailAlreadyRegistered && (
          <div className="auth-error" role="alert" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span>Este email já tem conta no CoreFit.</span>
            <Link to="/login" className="btn btn-sm btn-primary" style={{ alignSelf: "flex-start" }}>
              Fazer login
            </Link>
          </div>
        )}

        {/* Identificação */}
        <div className="field">
          <label className="label" htmlFor="reg-name">Nome completo</label>
          <input
            id="reg-name"
            className={`input${errors.name ? " input-invalid" : ""}`}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            disabled={isLoading}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </div>

        <div className="auth-two-col">
          <div className="field">
            <label className="label" htmlFor="reg-cpf">CPF</label>
            <input
              id="reg-cpf"
              className={`input${errors.cpf ? " input-invalid" : ""}`}
              value={form.cpf}
              onChange={(e) => update("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              autoComplete="off"
              disabled={isLoading}
            />
            {errors.cpf && <span className="field-error">{errors.cpf}</span>}
          </div>

          <div className="field">
            <label className="label" htmlFor="reg-phone">Telefone</label>
            <input
              id="reg-phone"
              className={`input${errors.phone ? " input-invalid" : ""}`}
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              placeholder="(85) 99999-9999"
              autoComplete="tel"
              disabled={isLoading}
            />
            {errors.phone && <span className="field-error">{errors.phone}</span>}
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            className={`input${errors.email ? " input-invalid" : ""}`}
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="ex: usuario@exemplo.com"
            autoComplete="email"
            disabled={isLoading}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        {/* Senha */}
        <div className="auth-two-col">
          <div className="field">
            <label className="label" htmlFor="reg-password">Senha</label>
            <input
              id="reg-password"
              className={`input${errors.password ? " input-invalid" : ""}`}
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <div className="field">
            <label className="label" htmlFor="reg-confirm">Confirmar senha</label>
            <input
              id="reg-confirm"
              className={`input${errors.confirmPassword ? " input-invalid" : ""}`}
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
          </div>
        </div>

        <p className="field-hint">
          A senha deve ter no mínimo 8 caracteres, 1 letra maiúscula e 1 símbolo (ex: ! @ # $ %).
        </p>

        {/* CAPTCHA */}
        {turnstileSiteKey ? (
          <div className="field">
            <span className="label">Verificação anti-robô</span>
            <Turnstile
              ref={turnstileRef}
              siteKey={turnstileSiteKey}
              onSuccess={(token) => setCaptcha(token)}
              onExpire={() => setCaptcha(null)}
              options={{ theme: "light" }}
            />
            {errors.captcha && <span className="field-error">{errors.captcha}</span>}
          </div>
        ) : import.meta.env.DEV ? (
          <p className="field-hint">
            Desenvolvimento: sem <code>VITE_TURNSTILE_SITE_KEY</code>. Configure Turnstile para produção.
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={isLoading || !isValid}
          aria-busy={isLoading}
        >
          {isLoading ? "Criando conta…" : "Criar conta e continuar"}
        </button>

        <div className="auth-links">
          <Link to="/login">Já tenho conta — entrar</Link>
          <Link to="/privacidade">Privacidade e cookies</Link>
        </div>
      </form>
    </main>
  );
}

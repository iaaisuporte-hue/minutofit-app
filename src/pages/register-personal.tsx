import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useAuth } from "../auth/AuthContext";
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

type RegisterPersonalForm = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  registryCode: string;
  password: string;
  confirmPassword: string;
};

const initialState: RegisterPersonalForm = {
  name: "",
  cpf: "",
  phone: "",
  email: "",
  registryCode: "",
  password: "",
  confirmPassword: "",
};

const turnstileSiteKey =
  typeof import.meta.env.VITE_TURNSTILE_SITE_KEY === "string"
    ? import.meta.env.VITE_TURNSTILE_SITE_KEY.trim() || undefined
    : undefined;

export default function RegisterPersonalPage() {
  const nav = useNavigate();
  const { registerPersonal } = useAuth();
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const [form, setForm] = useState<RegisterPersonalForm>(initialState);
  const [captchaToken, setCaptcha] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

    if (!acceptedTerms) {
      e.terms = "É necessário aceitar os Termos de Uso e a Política de Privacidade.";
    }

    return e;
  }, [form, captchaToken, acceptedTerms]);

  const isValid = Object.keys(errors).length === 0;

  function update<K extends keyof RegisterPersonalForm>(field: K, value: RegisterPersonalForm[K]) {
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
    const result = await registerPersonal({
      name:         form.name.trim(),
      cpf:          normalizeCpf(form.cpf),
      phone:        normalizePhone(form.phone),
      email:        form.email.trim().toLowerCase(),
      password:     form.password,
      registryCode: form.registryCode.trim() || undefined,
      captchaToken: captchaToken ?? undefined,
      acceptedTerms,
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
        setError("Este CPF já possui conta no S2Core. Faça login ou use outro CPF.");
      } else {
        setError(result.message);
      }
      setIsLoading(false);
      turnstileRef.current?.reset();
      setCaptcha(null);
      return;
    }

    setIsLoading(false);
    nav("/app/personal", { replace: true });
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
          <CoreFitLogo width={96} />
        </div>

        <h1 className="auth-title">Criar conta de personal</h1>
        <p className="auth-subtitle">
          Comece grátis com até 3 alunos. Faça upgrade quando sua carteira crescer.
        </p>

        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}

        {emailAlreadyRegistered && (
          <div className="auth-error" role="alert" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span>Este email já tem conta no S2Core.</span>
            <Link to="/login" className="btn btn-sm btn-primary" style={{ alignSelf: "flex-start" }}>
              Fazer login
            </Link>
          </div>
        )}

        <div className="field">
          <label className="label" htmlFor="rp-name">Nome completo</label>
          <input
            id="rp-name"
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
            <label className="label" htmlFor="rp-cpf">CPF</label>
            <input
              id="rp-cpf"
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
            <label className="label" htmlFor="rp-phone">Telefone</label>
            <input
              id="rp-phone"
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
          <label className="label" htmlFor="rp-email">Email</label>
          <input
            id="rp-email"
            className={`input${errors.email ? " input-invalid" : ""}`}
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="ex: voce@exemplo.com"
            autoComplete="email"
            disabled={isLoading}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="field">
          <label className="label" htmlFor="rp-registry">CREF (opcional)</label>
          <input
            id="rp-registry"
            className="input"
            value={form.registryCode}
            onChange={(e) => update("registryCode", e.target.value)}
            placeholder="ex: 012345-G/CE"
            autoComplete="off"
            maxLength={40}
            disabled={isLoading}
          />
          <span className="field-hint">
            Fica visível no seu perfil para os alunos. Você pode preencher depois.
          </span>
        </div>

        <div className="auth-two-col">
          <div className="field">
            <label className="label" htmlFor="rp-password">Senha</label>
            <input
              id="rp-password"
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
            <label className="label" htmlFor="rp-confirm">Confirmar senha</label>
            <input
              id="rp-confirm"
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

        {/* Aceite de Termos + Privacidade (LGPD art. 8º) — obrigatório */}
        <div className="field">
          <label
            style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={isLoading}
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <span style={{ color: "var(--color-text)" }}>
              Li e aceito os{" "}
              <Link to="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link>{" "}
              e a{" "}
              <Link to="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.
            </span>
          </label>
          {errors.terms && <span className="field-error">{errors.terms}</span>}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={isLoading || !isValid}
          aria-busy={isLoading}
        >
          {isLoading ? "Criando conta…" : "Criar conta grátis"}
        </button>

        <div className="auth-links">
          <Link to="/login">Já tenho conta — entrar</Link>
          <Link to="/register">Sou aluno — criar conta</Link>
        </div>
      </form>
    </main>
  );
}

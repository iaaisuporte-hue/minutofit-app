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
  getBirthDateError,
} from "../utils/validators";
import S2CoreLogo from "../components/S2CoreLogo";

type RegisterPersonalForm = {
  name: string;
  cpf: string;
  phone: string;
  birthDate: string;
  email: string;
  registryCode: string;
  password: string;
  confirmPassword: string;
};

const initialState: RegisterPersonalForm = {
  name: "",
  cpf: "",
  phone: "",
  birthDate: "",
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

  // Mesma regra do cadastro de aluno: erro só depois que a pessoa respondeu.
  // Ver `register.tsx` e o teste de regressão em `register.validation.test.tsx`.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const markTouched = (field: string) =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};

    if (!form.name.trim())         e.name  = "Informe seu nome completo.";
    if (!form.email.trim())        e.email = "Informe seu email.";
    else if (!isValidEmail(form.email)) e.email = "Informe um email válido.";

    if (!form.cpf.trim())          e.cpf   = "Informe seu CPF.";
    else if (!isValidCpf(form.cpf))     e.cpf   = "CPF inválido.";

    if (!form.phone.trim())        e.phone = "Informe seu telefone.";
    else if (!isValidPhone(form.phone)) e.phone = "Telefone inválido.";

    const birthErr = getBirthDateError(form.birthDate);
    if (birthErr) e.birthDate = birthErr;

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

  /** Erro de um campo só aparece depois que ele foi tocado ou depois do envio. */
  const shownError = (field: string): string | undefined =>
    touched[field] || submitAttempted ? errors[field] : undefined;

  function update<K extends keyof RegisterPersonalForm>(field: K, value: RegisterPersonalForm[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setEmailAlreadyRegistered(false);

    setSubmitAttempted(true);

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
      birthDate:    form.birthDate,
    });

    if (!result.ok) {
      const msg = String(result.message || "").toLowerCase();
      const emailTaken =
        result.code === "EMAIL_ALREADY_REGISTERED" ||
        (msg.includes("email") && (msg.includes("ja cadastrado") || msg.includes("já cadastrado")));
      // Ver register.tsx: conflito de CPF/telefone volta genérico do backend
      // (REGISTRATION_CONFLICT) para não confirmar existência de conta.
      if (emailTaken) {
        setEmailAlreadyRegistered(true);
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
          <S2CoreLogo width={96} />
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
            onBlur={() => markTouched("name")}
            className={`input${shownError("name") ? " input-invalid" : ""}`}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
            disabled={isLoading}
          />
          {shownError("name") && <span className="field-error">{shownError("name")}</span>}
        </div>

        <div className="auth-two-col">
          <div className="field">
            <label className="label" htmlFor="rp-cpf">CPF</label>
            <input
              id="rp-cpf"
            onBlur={() => markTouched("cpf")}
              className={`input${shownError("cpf") ? " input-invalid" : ""}`}
              value={form.cpf}
              onChange={(e) => update("cpf", formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              autoComplete="off"
              disabled={isLoading}
            />
            {shownError("cpf") && <span className="field-error">{shownError("cpf")}</span>}
          </div>

          <div className="field">
            <label className="label" htmlFor="rp-phone">Telefone</label>
            <input
              id="rp-phone"
            onBlur={() => markTouched("phone")}
              className={`input${shownError("phone") ? " input-invalid" : ""}`}
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              placeholder="(85) 99999-9999"
              autoComplete="tel"
              disabled={isLoading}
            />
            {shownError("phone") && <span className="field-error">{shownError("phone")}</span>}
          </div>
        </div>

        {/* 18+ — mesma regra do cadastro de aluno. */}
        <div className="field">
          <label className="label" htmlFor="rp-birth">Data de nascimento</label>
          <input
            id="rp-birth"
            onBlur={() => markTouched("birthDate")}
            type="date"
            className={`input${shownError("birthDate") ? " input-invalid" : ""}`}
            value={form.birthDate}
            onChange={(e) => update("birthDate", e.target.value)}
            autoComplete="bday"
            disabled={isLoading}
          />
          {shownError("birthDate") ? (
            <span className="field-error">{shownError("birthDate")}</span>
          ) : (
            <span className="field-hint">É necessário ter 18 anos ou mais.</span>
          )}
        </div>

        <div className="field">
          <label className="label" htmlFor="rp-email">Email</label>
          <input
            id="rp-email"
            onBlur={() => markTouched("email")}
            className={`input${shownError("email") ? " input-invalid" : ""}`}
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="ex: voce@exemplo.com"
            autoComplete="email"
            disabled={isLoading}
          />
          {shownError("email") && <span className="field-error">{shownError("email")}</span>}
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
            onBlur={() => markTouched("password")}
              className={`input${shownError("password") ? " input-invalid" : ""}`}
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            {shownError("password") && <span className="field-error">{shownError("password")}</span>}
          </div>

          <div className="field">
            <label className="label" htmlFor="rp-confirm">Confirmar senha</label>
            <input
              id="rp-confirm"
            onBlur={() => markTouched("confirmPassword")}
              className={`input${shownError("confirmPassword") ? " input-invalid" : ""}`}
              type="password"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              autoComplete="new-password"
              disabled={isLoading}
            />
            {shownError("confirmPassword") && <span className="field-error">{shownError("confirmPassword")}</span>}
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
            {submitAttempted && errors.captcha && <span className="field-error">{errors.captcha}</span>}
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
          {submitAttempted && errors.terms && <span className="field-error">{errors.terms}</span>}
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-block"
          /* Ver `register.tsx`: botão morto não explica por que está morto. */
          disabled={isLoading}
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

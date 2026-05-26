import { useState } from "react";
import { Link } from "react-router-dom";
import { createAdminProfessional } from "../../services/adminApi";

// ── Masks ─────────────────────────────────────────────────────────
function maskCpf(v: string): string {
  return v
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})/, "$1-$2")
    .substring(0, 14);
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "");
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2").substring(0, 14);
  }
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2").substring(0, 15);
}

// ── Sub-components ────────────────────────────────────────────────
type FieldProps = {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

function FormField({ id, label, required, error, hint, children }: FieldProps) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label}
        {required && (
          <span style={{ color: "var(--color-danger)", marginLeft: 2 }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
      {hint && !error && <span className="field-hint">{hint}</span>}
    </div>
  );
}

type SectionCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <div className="card card-pad" style={{ display: "grid", gap: "var(--space-5)" }}>
      <div
        style={{
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--color-border-subtle)",
        }}
      >
        <div
          style={{
            fontWeight: "var(--font-semibold)",
            fontSize: "var(--text-lg)",
            color: "var(--color-text)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: "var(--color-text-muted)",
            fontSize: "var(--text-sm)",
            marginTop: "var(--space-1)",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoIcon({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────
type Props = { role: "personal" | "nutri" };

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  specialty: string;
  crefOrCrn: string;
  bio: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

// ── Main component ────────────────────────────────────────────────
export default function AdminProfessionalCreatePage({ role }: Props) {
  const isPersonal = role === "personal";
  const backTo = isPersonal ? "/app/admin/personals" : "/app/admin/nutris";
  const roleLabel = isPersonal ? "personal trainer" : "nutricionista";
  const registryLabel = isPersonal ? "CREF" : "CRN";

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    specialty: "",
    crefOrCrn: "",
    bio: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: number;
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function update(key: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Nome obrigatório.";
    if (!form.email.trim()) {
      next.email = "E-mail obrigatório.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "E-mail inválido.";
    }
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits && cpfDigits.length !== 11) next.cpf = "CPF deve ter 11 dígitos.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const result = await createAdminProfessional({
        name: form.name.trim(),
        email: form.email.trim(),
        role,
        phone: form.phone.trim() || undefined,
        cpf: form.cpf.replace(/\D/g, "") || undefined,
        registry: form.crefOrCrn.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      setCreated(result);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Falha ao cadastrar profissional.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // ── Success state ─────────────────────────────────────────────
  if (created) {
    return (
      <div
        style={{ display: "grid", gap: "var(--space-4)", maxWidth: 600 }}
        aria-live="polite"
      >
        <div
          className="card card-pad"
          style={{
            borderColor: "var(--color-success-border)",
            background: "var(--color-success-soft)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-pill)",
                background: "var(--color-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontWeight: "var(--font-bold)",
                  fontSize: "var(--text-xl)",
                  color: "var(--color-text)",
                }}
              >
                {roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)} cadastrado
              </div>
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--text-sm)",
                  marginTop: 2,
                }}
              >
                {created.name} já pode acessar a plataforma.
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad" style={{ display: "grid", gap: "var(--space-4)" }}>
          <div>
            <div
              style={{
                fontWeight: "var(--font-semibold)",
                fontSize: "var(--text-lg)",
                color: "var(--color-text)",
              }}
            >
              Credenciais de acesso
            </div>
            <div
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--text-sm)",
                marginTop: "var(--space-1)",
                lineHeight: 1.5,
              }}
            >
              Compartilhe por canal seguro (ex: mensagem direta). A senha temporária é
              exibida apenas nesta sessão.
            </div>
          </div>

          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface-raised)",
              }}
            >
              <div
                style={{
                  color: "var(--color-text-subtle)",
                  fontSize: "var(--text-xs)",
                  marginBottom: 2,
                }}
              >
                E-mail
              </div>
              <div
                style={{
                  fontWeight: "var(--font-semibold)",
                  fontSize: "var(--text-base)",
                }}
              >
                {created.email}
              </div>
            </div>

            <div
              style={{
                padding: "var(--space-3) var(--space-4)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-success-border)",
                background: "var(--color-success-soft)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <div>
                <div
                  style={{
                    color: "var(--color-text-subtle)",
                    fontSize: "var(--text-xs)",
                    marginBottom: 2,
                  }}
                >
                  Senha temporária
                </div>
                <div
                  style={{
                    fontWeight: "var(--font-bold)",
                    fontSize: "var(--text-xl)",
                    letterSpacing: 2,
                    color: "var(--color-text)",
                    fontFamily: "monospace",
                  }}
                >
                  {created.tempPassword}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyPassword()}
                className={`btn ${copied ? "btn-primary" : "btn-ghost"}`}
                style={{ whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {copied ? "Copiado" : "Copiar senha"}
              </button>
            </div>
          </div>

          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-warn-border)",
              background: "var(--color-warn-soft)",
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "flex-start",
            }}
            role="alert"
          >
            <InfoIcon color="var(--color-warn-text)" />
            <span
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-warn-text)",
                lineHeight: 1.5,
              }}
            >
              Esta senha não será exibida novamente. O profissional deverá alterá-la no
              primeiro acesso.
            </span>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Link to={`${backTo}/${created.id}`} className="btn btn-primary">
              Ver perfil
            </Link>
            <Link to={backTo} className="btn btn-ghost">
              Voltar para a lista
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────
  return (
    <div style={{ display: "grid", gap: "var(--space-5)", maxWidth: 760 }}>

      {/* Header */}
      <div>
        <Link
          to={backTo}
          style={{
            color: "var(--color-primary)",
            textDecoration: "none",
            fontWeight: "var(--font-medium)",
            fontSize: "var(--text-sm)",
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1)",
            marginBottom: "var(--space-3)",
          }}
        >
          ← Voltar
        </Link>
        <h1
          style={{
            fontSize: "var(--text-3xl)",
            fontWeight: "var(--font-bold)",
            color: "var(--color-text)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Cadastrar {roleLabel}
        </h1>
        <p
          style={{
            color: "var(--color-text-muted)",
            marginTop: "var(--space-2)",
            marginBottom: 0,
            fontSize: "var(--text-base)",
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          {isPersonal
            ? "Cadastre um personal trainer para gerenciar fichas, acompanhar alunos e monitorar evolução na plataforma."
            : "Cadastre um profissional para acompanhar alunos, planos nutricionais e evolução metabólica dentro da plataforma."}
        </p>
      </div>

      {/* Temp-password notice */}
      <div
        style={{
          padding: "var(--space-3) var(--space-4)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-info-border)",
          background: "var(--color-info-soft)",
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start",
        }}
      >
        <InfoIcon color="var(--color-info-text)" />
        <div>
          <div
            style={{
              fontWeight: "var(--font-semibold)",
              fontSize: "var(--text-sm)",
              color: "var(--color-info-text)",
            }}
          >
            Acesso por senha temporária
          </div>
          <div
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--color-text-muted)",
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            Após o cadastro, uma senha temporária será gerada e exibida{" "}
            <strong>uma única vez</strong>. O profissional deverá alterá-la no primeiro
            acesso.
          </div>
        </div>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        style={{ display: "grid", gap: "var(--space-4)" }}
        aria-label={`Formulário de cadastro de ${roleLabel}`}
      >
        {/* Section 1 — Dados pessoais */}
        <SectionCard
          title="Dados pessoais"
          description="Identificação e contato do profissional."
        >
          <div className="form-grid form-grid--2col">
            <FormField id="name" label="Nome completo" required error={errors.name}>
              <input
                id="name"
                className={`input${errors.name ? " input-invalid" : ""}`}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Ex: Ana Costa"
                autoComplete="off"
                aria-required="true"
                aria-describedby={errors.name ? "name-error" : undefined}
              />
            </FormField>

            <FormField
              id="email"
              label="E-mail profissional"
              required
              error={errors.email}
              hint="Será o login na plataforma."
            >
              <input
                id="email"
                type="email"
                className={`input${errors.email ? " input-invalid" : ""}`}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="profissional@exemplo.com"
                autoComplete="off"
                aria-required="true"
              />
            </FormField>

            <FormField
              id="phone"
              label="Telefone / WhatsApp"
              error={errors.phone}
              hint="Formato: (00) 00000-0000"
            >
              <input
                id="phone"
                type="tel"
                className="input"
                value={form.phone}
                onChange={(e) => update("phone", maskPhone(e.target.value))}
                placeholder="(85) 99999-9999"
                inputMode="numeric"
              />
            </FormField>

            <FormField id="cpf" label="CPF" error={errors.cpf}>
              <input
                id="cpf"
                className={`input${errors.cpf ? " input-invalid" : ""}`}
                value={form.cpf}
                onChange={(e) => update("cpf", maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </FormField>
          </div>
        </SectionCard>

        {/* Section 2 — Dados profissionais */}
        <SectionCard
          title="Dados profissionais"
          description={`Registro ${registryLabel}, especialidade e perfil de atuação.`}
        >
          <div className="form-grid form-grid--2col">
            <FormField
              id="registry"
              label={registryLabel}
              hint={`Número do conselho profissional (${registryLabel}).`}
            >
              <input
                id="registry"
                className="input"
                value={form.crefOrCrn}
                onChange={(e) => update("crefOrCrn", e.target.value)}
                placeholder={isPersonal ? "000000-G/UF" : "CRN0-000000"}
              />
            </FormField>

            <FormField id="specialty" label="Especialidade principal">
              <input
                id="specialty"
                className="input"
                value={form.specialty}
                onChange={(e) => update("specialty", e.target.value)}
                placeholder={
                  isPersonal
                    ? "Hipertrofia, corrida, funcional..."
                    : "Esportiva, clínica, metabólica..."
                }
              />
            </FormField>
          </div>

          <FormField
            id="bio"
            label="Bio profissional"
            hint="Resumo do foco e tipo de atendimento. Visível para alunos vinculados."
          >
            <textarea
              id="bio"
              className="input"
              value={form.bio}
              onChange={(e) => update("bio", e.target.value)}
              placeholder="Descreva brevemente o perfil de atuação, abordagem e área de foco deste profissional."
              style={{ minHeight: 96, resize: "vertical" }}
            />
          </FormField>
        </SectionCard>

        {/* Server error */}
        {serverError && (
          <div
            style={{
              padding: "var(--space-3) var(--space-4)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--color-danger-border)",
              background: "var(--color-danger-soft)",
              fontSize: "var(--text-sm)",
              color: "var(--color-danger-text)",
            }}
            role="alert"
          >
            {serverError}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            aria-busy={submitting}
          >
            {submitting ? "Cadastrando..." : `Cadastrar ${roleLabel}`}
          </button>
          <Link to={backTo} className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

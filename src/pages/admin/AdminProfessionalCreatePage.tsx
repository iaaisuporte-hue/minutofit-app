import { useState } from "react";
import { Link } from "react-router-dom";
import { createAdminProfessional } from "../../services/adminApi";
import { COLORS } from "../../styles/colors";

type Props = {
  role: "personal" | "nutri";
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontWeight: 600, color: "rgba(255,255,255,.86)", fontSize: 13 }}>{label}</span>
      {children}
    </label>
  );
}

function baseInputStyle(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 16,
    border: `1px solid ${COLORS.border}`,
    background: "rgba(8,14,11,.78)",
    color: COLORS.text,
    outline: "none",
    width: "100%",
  };
}

export default function AdminProfessionalCreatePage({ role }: Props) {
  const isPersonal = role === "personal";
  const backTo = isPersonal ? "/app/admin/personals" : "/app/admin/nutris";

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    specialty: "",
    crefOrCrn: "",
    bio: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    id: number;
    name: string;
    email: string;
    tempPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Informe o nome do profissional."); return; }
    if (!form.email.trim()) { setError("Informe o e-mail profissional."); return; }

    setSubmitting(true);
    try {
      const result = await createAdminProfessional({
        name: form.name.trim(),
        email: form.email.trim(),
        role,
        phone: form.phone.trim() || undefined,
        cpf: form.cpf.trim() || undefined,
        registry: form.crefOrCrn.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        bio: form.bio.trim() || undefined,
      });
      setCreated(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar profissional.");
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
      setCopied(false);
    }
  }

  if (created) {
    return (
      <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
        <div
          style={{
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 20,
            background: COLORS.panelDeep,
            padding: 18,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700 }}>Profissional cadastrado</div>
          <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
            {created.name} foi cadastrado como <b>{isPersonal ? "personal trainer" : "nutricionista"}</b> na plataforma.
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 20,
            background: COLORS.panel,
            padding: 18,
            display: "grid",
            gap: 14,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 18 }}>Credenciais de acesso</div>
          <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
            Compartilhe as credenciais abaixo com o profissional por canal seguro. A senha temporária é exibida apenas nesta sessão.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12 }}>E-mail</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{created.email}</div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid rgba(34,197,94,.3)`,
                background: "rgba(34,197,94,.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div>
                <div style={{ color: COLORS.muted, fontSize: 12 }}>Senha temporária</div>
                <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: 2, marginTop: 2 }}>
                  {created.tempPassword}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void copyPassword()}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: copied ? "#22C55E" : COLORS.panelSoft,
                  color: copied ? "#FFFFFF" : COLORS.text,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "background 0.2s, color 0.2s",
                  whiteSpace: "nowrap",
                }}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
            <Link
              to={`${backTo}/${created.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.borderStrong}`,
                background: "#22C55E",
                color: "#FFFFFF",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Ver perfil do profissional
            </Link>
            <Link
              to={backTo}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 14px",
                borderRadius: 14,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: COLORS.text,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Voltar para a lista
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to={backTo} style={{ color: COLORS.lime, textDecoration: "none", fontWeight: 600, width: "fit-content", fontSize: 14 }}>
          ← Voltar
        </Link>
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          Cadastrar {isPersonal ? "personal" : "nutri"}
        </div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 820 }}>
          Uma senha temporária será gerada e exibida uma única vez após o cadastro.
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          padding: 18,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Nome completo *">
            <input value={form.name} onChange={(e) => update("name", e.target.value)} style={baseInputStyle()} placeholder="Nome do profissional" required />
          </Field>
          <Field label="E-mail profissional *">
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} style={baseInputStyle()} placeholder="profissional@exemplo.com" required />
          </Field>
          <Field label="Telefone">
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} style={baseInputStyle()} placeholder="(85) 99999-9999" />
          </Field>
          <Field label="CPF">
            <input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} style={baseInputStyle()} placeholder="000.000.000-00" />
          </Field>
          <Field label={isPersonal ? "CREF" : "CRN"}>
            <input
              value={form.crefOrCrn}
              onChange={(e) => update("crefOrCrn", e.target.value)}
              style={baseInputStyle()}
              placeholder={isPersonal ? "Número do CREF" : "Número do CRN"}
            />
          </Field>
          <Field label="Especialidade principal">
            <input
              value={form.specialty}
              onChange={(e) => update("specialty", e.target.value)}
              style={baseInputStyle()}
              placeholder={isPersonal ? "Hipertrofia, corrida, funcional..." : "Nutrição esportiva, clínica, metabólica..."}
            />
          </Field>
        </div>

        <Field label="Bio operacional">
          <textarea
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            style={{ ...baseInputStyle(), minHeight: 100, resize: "vertical" }}
            placeholder="Resumo curto do foco e tipo de atendimento do profissional."
          />
        </Field>

        {error && (
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${COLORS.redBorder}`,
              background: COLORS.redSoft,
              padding: 14,
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: submitting ? COLORS.panelSoft : "#22C55E",
              color: submitting ? COLORS.muted : "#FFFFFF",
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </button>
          <Link
            to={backTo}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              color: COLORS.text,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

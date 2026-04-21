import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
      <span style={{ fontWeight: 600, color: "rgba(255,255,255,.86)" }}>{label}</span>
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
  const navigate = useNavigate();
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
    status: "ativo",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    alert(
      `${isPersonal ? "Personal" : "Nutri"} preparado para cadastro. Nesta etapa a tela já está pronta e o próximo passo é ligar o formulário ao backend administrativo.`
    );
    navigate(backTo);
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <Link to={backTo} style={{ color: COLORS.lime, textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
          ← Voltar
        </Link>
        <div style={{ fontSize: 30, fontWeight: 700 }}>
          Cadastrar {isPersonal ? "personal" : "nutri"}
        </div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 820 }}>
          Esta rota foi separada da listagem para o admin conseguir preencher os dados com calma, sem misturar cadastro e operação do dia a dia.
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panel,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
          padding: 18,
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Field label="Nome completo">
            <input value={form.name} onChange={(e) => update("name", e.target.value)} style={baseInputStyle()} placeholder="Nome do profissional" />
          </Field>
          <Field label="E-mail profissional">
            <input value={form.email} onChange={(e) => update("email", e.target.value)} style={baseInputStyle()} placeholder="profissional@minutofit.app" />
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
          <Field label="Status inicial">
            <select value={form.status} onChange={(e) => update("status", e.target.value)} style={baseInputStyle()}>
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
            </select>
          </Field>
        </div>

        <Field label="Bio operacional">
          <textarea
            value={form.bio}
            onChange={(e) => update("bio", e.target.value)}
            style={{ ...baseInputStyle(), minHeight: 120, resize: "vertical" }}
            placeholder="Resumo curto para o admin entender o foco e o tipo de atendimento do profissional."
          />
        </Field>

        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.panelSoft,
            padding: 14,
            color: COLORS.muted,
            lineHeight: 1.6,
          }}
        >
          Nesta primeira versão a tela está pronta no fluxo e na UX. O próximo passo é conectar o cadastro ao backend, criar validações reais de CPF, e-mail, telefone e registro profissional.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="submit"
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: "#22C55E",
              color: "#FFFFFF",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Salvar cadastro
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

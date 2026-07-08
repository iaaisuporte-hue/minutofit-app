import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchDirectInviteInfo, acceptDirectInvite } from "../services/personalDirectInvitesApi";
import { fetchNutriDirectInviteInfo, acceptNutriDirectInvite } from "../services/nutriDirectInvitesApi";
import { setTokens } from "../services/authTokens";

type InviteType = "personal" | "nutri";

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: "var(--color-text)",
  background: "var(--color-surface)",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#64748B",
  marginBottom: 4,
};

export default function DirectInviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Detect invite type from route or query param
  const inviteType: InviteType =
    window.location.pathname.includes("convite-nutri") ||
    searchParams.get("type") === "nutri"
      ? "nutri"
      : "personal";

  const [inviteInfo, setInviteInfo] = useState<{
    professionalName: string;
    personalName: string;
    invitedName: string | null;
    invitedEmail: string | null;
    status: string;
    expired: boolean;
    type: InviteType;
  } | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // When backend returns userExists=true, show login-only form
  const [existingAccountEmail, setExistingAccountEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchInfo = inviteType === "nutri"
      ? fetchNutriDirectInviteInfo(token)
      : fetchDirectInviteInfo(token);

    fetchInfo
      .then((info) => {
        setInviteInfo({ ...info, type: inviteType } as typeof inviteInfo);
        if (info.invitedName) setName(info.invitedName);
        if (info.invitedEmail) setEmail(info.invitedEmail);
      })
      .catch((e) => setInfoError(e instanceof Error ? e.message : "Convite não encontrado."))
      .finally(() => setInfoLoading(false));
  }, [token, inviteType]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    setExistingAccountEmail(null);

    try {
      const payload = {
        email,
        password,
        name,
        cpf: cpf || undefined,
        phone: phone || undefined,
      };

      const result = inviteType === "nutri"
        ? await acceptNutriDirectInvite(token, payload)
        : await acceptDirectInvite(token, payload);

      setTokens(result.accessToken, result.refreshToken);
      navigate("/app/user/today", { replace: true });
    } catch (e: unknown) {
      const err = e as { message?: string; userExists?: boolean; email?: string };
      // Backend returns 401 with userExists=true when password is wrong for existing account
      if (err && typeof err === "object" && "userExists" in err && err.userExists) {
        setExistingAccountEmail(err.email ?? email);
        setSubmitError(
          "Esta conta já existe. Insira a senha da sua conta existente para aceitar o convite."
        );
      } else {
        setSubmitError(
          e instanceof Error ? e.message : "Não foi possível concluir o cadastro."
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: "var(--color-bg-main)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "var(--color-surface)",
    borderRadius: 20,
    padding: 36,
    maxWidth: 440,
    width: "100%",
    boxShadow: "0 4px 24px rgba(0,0,0,0.09)",
    display: "grid",
    gap: 20,
  };

  if (infoLoading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: "#64748B", fontSize: 15 }}>Carregando convite…</div>
      </div>
    );
  }

  if (infoError || !inviteInfo) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "var(--color-text)" }}>Convite inválido</div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
            {infoError || "Este link de convite não existe ou já expirou."}
          </div>
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#1E293B",
              color: "#FFFFFF",
              fontWeight: 650,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  if (inviteInfo.expired || inviteInfo.status !== "pending") {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 700, fontSize: 20, color: "var(--color-text)" }}>
            {inviteInfo.status === "accepted" ? "Convite já aceito" : "Convite expirado"}
          </div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
            {inviteInfo.status === "accepted"
              ? "Este convite já foi aceito. Faça login para acessar sua conta."
              : inviteType === "nutri"
              ? "Este link de convite expirou. Peça à sua nutricionista um novo link."
              : "Este link de convite expirou. Peça ao seu personal um novo link."}
          </div>
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#1E293B",
              color: "#FFFFFF",
              fontWeight: 650,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Ir para o login
          </button>
        </div>
      </div>
    );
  }

  const professionalLabel = inviteType === "nutri" ? "nutricionista" : "personal";
  const professionalName = inviteInfo.professionalName || inviteInfo.personalName;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", display: "grid", gap: 6 }}>
          <div
            style={{
              fontSize: 13,
              color: "#64748B",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Convite de {professionalLabel}
          </div>
          <div
            style={{ fontWeight: 750, fontSize: 22, color: "var(--color-text)", lineHeight: 1.2 }}
          >
            {professionalName} te convidou para acompanhamento{" "}
            {inviteType === "nutri" ? "nutricional" : "personal"}
          </div>

          {/* Existing account banner */}
          {existingAccountEmail ? (
            <div
              style={{
                background: "var(--color-info-soft)",
                border: "1px solid #BFDBFE",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "var(--color-info-text)",
                textAlign: "left",
                lineHeight: 1.5,
              }}
            >
              Encontramos uma conta existente para <strong>{existingAccountEmail}</strong>.
              Use a senha dessa conta para aceitar o convite.
            </div>
          ) : (
            <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>
              {existingAccountEmail
                ? "Use a senha da conta existente para aceitar o convite."
                : "Crie sua conta ou use sua conta existente para se conectar."}
            </div>
          )}
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 12 }}>
          {!existingAccountEmail && (
            <>
              <div>
                <label style={LABEL_STYLE}>Nome completo</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  style={FIELD_STYLE}
                  maxLength={255}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>E-mail</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  style={FIELD_STYLE}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>CPF</label>
                <input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  style={FIELD_STYLE}
                  maxLength={14}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Telefone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 90000-0000"
                  style={FIELD_STYLE}
                  maxLength={15}
                />
              </div>
            </>
          )}

          {existingAccountEmail && (
            <div>
              <label style={LABEL_STYLE}>E-mail da conta</label>
              <input
                value={existingAccountEmail}
                readOnly
                style={{ ...FIELD_STYLE, background: "var(--color-bg-main)", color: "#64748B" }}
              />
            </div>
          )}

          <div>
            <label style={LABEL_STYLE}>
              {existingAccountEmail ? "Senha da sua conta" : "Senha"}
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={FIELD_STYLE}
              minLength={8}
            />
          </div>

          {submitError ? (
            <div
              style={{
                color: "#DC2626",
                fontSize: 13,
                background: "var(--color-danger-soft)",
                border: "1px solid #FECACA",
                borderRadius: 8,
                padding: "8px 12px",
                lineHeight: 1.4,
              }}
            >
              {submitError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: submitting ? "#94A3B8" : "#1E293B",
              color: "#FFFFFF",
              fontWeight: 700,
              fontSize: 15,
              cursor: submitting ? "default" : "pointer",
              marginTop: 4,
            }}
          >
            {submitting
              ? "Processando…"
              : existingAccountEmail
              ? "Aceitar com conta existente"
              : "Criar conta e acessar"}
          </button>

          {existingAccountEmail && (
            <button
              type="button"
              onClick={() => {
                setExistingAccountEmail(null);
                setSubmitError(null);
                setPassword("");
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748B",
                fontSize: 13,
                textDecoration: "underline",
              }}
            >
              Usar outro e-mail
            </button>
          )}
        </form>

        <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>
          Já tem conta?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              textDecoration: "underline",
              fontSize: 12,
            }}
          >
            Faça login
          </button>
        </div>
      </div>
    </div>
  );
}

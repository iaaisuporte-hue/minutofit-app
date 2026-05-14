import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchDirectInviteInfo, acceptDirectInvite } from "../services/personalDirectInvitesApi";
import { setTokens } from "../services/authTokens";

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #E2E8F0",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: "#1E293B",
  background: "#FFFFFF",
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
  const navigate = useNavigate();

  const [inviteInfo, setInviteInfo] = useState<{
    personalName: string;
    invitedName: string | null;
    invitedEmail: string | null;
    status: string;
    expired: boolean;
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

  useEffect(() => {
    if (!token) return;
    fetchDirectInviteInfo(token)
      .then((info) => {
        setInviteInfo(info);
        if (info.invitedName) setName(info.invitedName);
        if (info.invitedEmail) setEmail(info.invitedEmail);
      })
      .catch((e) => setInfoError(e instanceof Error ? e.message : "Convite não encontrado."))
      .finally(() => setInfoLoading(false));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await acceptDirectInvite(token, {
        email,
        password,
        name,
        cpf,
        phone,
        healthFlags: {
          sem_historico_hipertensao: true,
          sem_historico_cardiaco: true,
          sem_restricao_medica_exercicio: true,
          apto_para_atividade_fisica: true,
          aceita_responsabilidade_informacoes: true,
        } as unknown as Record<string, boolean>,
      });
      setTokens(result.accessToken, result.refreshToken);
      navigate("/app/today", { replace: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Não foi possível concluir o cadastro.");
    } finally {
      setSubmitting(false);
    }
  }

  const pageStyle: React.CSSProperties = {
    minHeight: "100dvh",
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  };

  const cardStyle: React.CSSProperties = {
    background: "#FFFFFF",
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
          <div style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>Convite inválido</div>
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
          <div style={{ fontWeight: 700, fontSize: 20, color: "#1E293B" }}>
            {inviteInfo.status === "accepted" ? "Convite já aceito" : "Convite expirado"}
          </div>
          <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
            {inviteInfo.status === "accepted"
              ? "Este convite já foi aceito. Faça login para acessar sua conta."
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

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", display: "grid", gap: 6 }}>
          <div style={{ fontSize: 13, color: "#64748B", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Convite pessoal
          </div>
          <div style={{ fontWeight: 750, fontSize: 22, color: "#1E293B", lineHeight: 1.2 }}>
            {inviteInfo.personalName} te convidou para acompanhamento personal
          </div>
          <div style={{ fontSize: 14, color: "#64748B", lineHeight: 1.5 }}>
            Crie sua conta para acessar seus treinos e se conectar ao seu personal.
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 12 }}>
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
              required
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
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 90000-0000"
              style={FIELD_STYLE}
              maxLength={15}
            />
          </div>
          <div>
            <label style={LABEL_STYLE}>Senha</label>
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
            <div style={{
              color: "#DC2626",
              fontSize: 13,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              padding: "8px 12px",
              lineHeight: 1.4,
            }}>
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
            {submitting ? "Criando conta…" : "Criar conta e acessar"}
          </button>
        </form>

        <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", lineHeight: 1.5 }}>
          Já tem conta?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", textDecoration: "underline", fontSize: 12 }}
          >
            Faça login
          </button>
        </div>
      </div>
    </div>
  );
}

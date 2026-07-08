import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fetchInvitationInfo, acceptInvitation, type InvitationInfo } from "../services/academyApi";
import { setTokens } from "../services/authTokens";

export default function AcceptInvitationPage() {
  const { token }   = useParams<{ token: string }>();
  const navigate    = useNavigate();

  const [info, setInfo]       = useState<InvitationInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [name, setName]           = useState("");
  const [cpf, setCpf]             = useState("");
  const [phone, setPhone]         = useState("");
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setLoadError("Token de convite não encontrado."); setLoading(false); return; }
    fetchInvitationInfo(token)
      .then(setInfo)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!info?.userExists) {
      if (!name) { setFormError("Nome obrigatório."); return; }
      if (!password || password.length < 6) { setFormError("Senha deve ter ao menos 6 caracteres."); return; }
      if (password !== confirm) { setFormError("As senhas não coincidem."); return; }
    }

    setSaving(true);
    try {
      const result = await acceptInvitation({
        token: token!,
        password: info?.userExists ? undefined : password,
        name:     info?.userExists ? undefined : name,
        cpf:      cpf  || undefined,
        phone:    phone || undefined,
      });

      setTokens(result.accessToken, result.refreshToken);
      navigate("/app/academy/dashboard", { replace: true });
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="auth-page">
        <div style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>Verificando convite…</div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-error" role="alert">{loadError}</div>
          <Link to="/login" className="btn btn-ghost" style={{ marginTop: "var(--space-4)", display: "inline-block" }}>
            Voltar ao login
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "var(--radius-md)",
              background: "var(--action-primary)", display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              fontWeight: 700, color: "#fff", fontSize: "var(--text-xl)",
              marginBottom: "var(--space-3)",
            }}
          >
            {info!.academyName.slice(0, 2).toUpperCase()}
          </div>
          <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginBottom: "var(--space-1)" }}>
            Você foi convidado
          </h1>
          <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
            para <strong>{info!.academyName}</strong> como <strong>{info!.roleLabel}</strong>
          </p>
          <p style={{ color: "var(--color-text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>
            {info!.email}
          </p>
        </div>

        {info!.userExists ? (
          /* User already exists — ask them to log in */
          <div style={{ textAlign: "center" }}>
            <p style={{ marginBottom: "var(--space-4)", color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>
              Você já tem uma conta com esse e-mail. Entre com a sua senha para aceitar o convite.
            </p>
            {formError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{formError}</div>}
            <form onSubmit={handleAccept} noValidate>
              <button type="submit" className="btn btn-primary btn-block" disabled={saving} aria-busy={saving}>
                {saving ? "Aceitando…" : "Aceitar convite e entrar"}
              </button>
            </form>
            <p style={{ marginTop: "var(--space-3)", fontSize: "var(--text-xs)", color: "var(--color-text-tertiary)" }}>
              Não é você? <Link to="/login">Fazer login com outra conta</Link>
            </p>
          </div>
        ) : (
          /* New user — fill in name + password */
          <form onSubmit={handleAccept} noValidate>
            {formError && <div className="auth-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{formError}</div>}

            <div className="field">
              <label className="label" htmlFor="inv-name">Nome completo *</label>
              <input id="inv-name" className="input" placeholder="Seu nome" value={name}
                onChange={(e) => setName(e.target.value)} disabled={saving} />
            </div>

            <div className="field">
              <label className="label" htmlFor="inv-pass">Senha *</label>
              <input id="inv-pass" className="input" type="password" placeholder="Mínimo 6 caracteres"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={saving} />
            </div>

            <div className="field">
              <label className="label" htmlFor="inv-confirm">Confirmar senha *</label>
              <input id="inv-confirm" className="input" type="password" placeholder="Repita a senha"
                value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={saving} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              <div className="field">
                <label className="label" htmlFor="inv-cpf">CPF</label>
                <input id="inv-cpf" className="input" placeholder="000.000.000-00"
                  value={cpf} onChange={(e) => setCpf(e.target.value)} disabled={saving} />
              </div>
              <div className="field">
                <label className="label" htmlFor="inv-phone">Telefone</label>
                <input id="inv-phone" className="input" placeholder="(11) 9 0000-0000"
                  value={phone} onChange={(e) => setPhone(e.target.value)} disabled={saving} />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={saving} aria-busy={saving}
              style={{ marginTop: "var(--space-5)" }}>
              {saving ? "Criando conta…" : "Aceitar convite e criar conta"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

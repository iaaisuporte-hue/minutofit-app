import { useEffect, useRef, useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import { createNutriDirectInvite } from "../../services/nutriApi";
import { COLORS } from "../../styles/colors";

type Props = {
  open: boolean;
  onClose: () => void;
  onInviteCreated?: () => void;
};

/**
 * SPEC 037 / P2.3: fecha o fluxo de convite direto do lado do nutri — o
 * backend (`/nutri/direct-invites`) e a tela de aceite do aluno
 * (`/convite-nutri/:token`) já existiam; só faltava esta UI.
 */
export function NutriInviteDrawer({ open, onClose, onInviteCreated }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setError(null);
      setCreatedUrl(null);
      setCopied(false);
    }
  }, [open]);

  function handleClose() {
    setCreatedUrl(null);
    onClose();
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const result = await createNutriDirectInvite({
        invitedEmail: email || undefined,
        invitedName: name || undefined,
      });
      setCreatedUrl(result.inviteUrl);
      onInviteCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (urlRef.current) {
      urlRef.current.select();
      document.execCommand("copy");
    } else if (createdUrl) {
      navigator.clipboard.writeText(createdUrl).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <DrawerShell open={open} onClose={handleClose} ariaLabel="Convidar paciente">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: "var(--text-lg)", fontWeight: 700, color: COLORS.text }}>
          Convidar paciente
        </h2>
        <button type="button" className="btn btn-icon btn-ghost" onClick={handleClose} aria-label="Fechar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {!createdUrl ? (
        <div className="stack" style={{ gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, margin: 0 }}>
            Gere um link de convite. O paciente se cadastra pelo link e já aparece na sua carteira.
          </p>

          <div className="field">
            <label className="label" htmlFor="invite-name">Nome do paciente (opcional)</label>
            <input
              id="invite-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Maria Silva"
              maxLength={255}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="invite-email">E-mail do paciente (opcional)</label>
            <input
              id="invite-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="paciente@email.com"
            />
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>Cancelar</button>
            <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={() => void handleCreate()}>
              {loading ? "Gerando..." : "Gerar link"}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
          <p className="muted" style={{ fontSize: "var(--text-sm)", lineHeight: 1.5, margin: 0 }}>
            Link gerado com sucesso! Validade de 14 dias. Copie e envie ao paciente pelo canal que preferir.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <input ref={urlRef} readOnly className="input" value={createdUrl} onFocus={(e) => e.target.select()} style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={handleCopy} style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleClose}>Fechar</button>
          </div>
        </div>
      )}
    </DrawerShell>
  );
}

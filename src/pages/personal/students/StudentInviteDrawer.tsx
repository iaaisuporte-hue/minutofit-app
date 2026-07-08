import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DrawerShell } from "../../../components/overlay/DrawerShell";
import { createDirectInvite } from "../../../services/personalDirectInvitesApi";
import { COLORS } from "../../../styles/colors";

type Props = {
  open: boolean;
  onClose: () => void;
  onInviteCreated?: () => void;
};

export function StudentInviteDrawer({ open, onClose, onInviteCreated }: Props) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const inviteUrlRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInviteEmail(""); setInviteName(""); setInviteError(null); setCreatedInviteUrl(null);
    }
  }, [open]);

  function handleClose() {
    setCreatedInviteUrl(null);
    onClose();
  }

  async function handleCreateInvite() {
    setInviteLoading(true); setInviteError(null);
    try {
      const result = await createDirectInvite({
        invitedEmail: inviteEmail || undefined,
        invitedName: inviteName || undefined,
      });
      setCreatedInviteUrl(result.inviteUrl);
      onInviteCreated?.();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "Não foi possível criar o convite.");
    } finally {
      setInviteLoading(false);
    }
  }

  function copyInviteUrl() {
    if (inviteUrlRef.current) {
      inviteUrlRef.current.select();
      document.execCommand("copy");
    } else if (createdInviteUrl) {
      navigator.clipboard.writeText(createdInviteUrl).catch(() => {});
    }
  }

  return (
    <DrawerShell open={open} onClose={handleClose} ariaLabel="Convidar aluno direto">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="pp-drawer-title">Convidar aluno direto</div>
        <button type="button" className="pp-btn pp-btn--icon pp-btn--ghost" onClick={handleClose}>
          <X size={18} />
        </button>
      </div>

      {!createdInviteUrl ? (
        <>
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Gere um link de convite. O aluno se cadastra pelo link e já aparece na sua carteira — sem precisar de academia.
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                Nome do aluno (opcional)
              </label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ex: João Silva"
                className="pp-input"
                style={{ width: "100%" }}
                maxLength={255}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, display: "block", marginBottom: 4 }}>
                E-mail do aluno (opcional)
              </label>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="aluno@email.com"
                type="email"
                className="pp-input"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {inviteError ? (
            <div
              style={{
                color: COLORS.danger,
                fontSize: 13,
                background: COLORS.dangerBg,
                border: `1px solid ${COLORS.dangerBorder}`,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {inviteError}
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={handleClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-btn--sm"
              disabled={inviteLoading}
              onClick={() => void handleCreateInvite()}
            >
              {inviteLoading ? "Gerando…" : "Gerar link"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Link gerado com sucesso! Validade de 14 dias. Copie e envie ao aluno pelo canal que preferir.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inviteUrlRef}
              readOnly
              value={createdInviteUrl}
              style={{
                flex: 1,
                fontSize: 13,
                padding: "8px 10px",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: "var(--color-surface-raised)",
                color: COLORS.text,
              }}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="pp-btn pp-btn--primary pp-btn--sm"
              onClick={copyInviteUrl}
              style={{ flexShrink: 0 }}
            >
              Copiar
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="button" className="pp-btn pp-btn--quiet pp-btn--sm" onClick={handleClose}>
              Fechar
            </button>
          </div>
        </>
      )}
    </DrawerShell>
  );
}

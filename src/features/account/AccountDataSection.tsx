import { useState, type ReactNode } from "react";
import { COLORS } from "../../styles/colors";
import { exportMyData, deleteMyAccount, AccountDeletionBlockedError } from "../../services/accountApi";
import { handleExternal } from "../../lib/externalLink";

import { useOverlay } from "../../lib/overlayStack";
/**
 * Seção "Seus dados e conta" (LGPD + requisito de loja Apple 5.1.1v / Google).
 * Exportação (SAR) e exclusão self-service. `onDeleted` deve encerrar a sessão.
 *
 * - `deletionNote`: contexto extra no diálogo de confirmação (ex.: staff de
 *   academia — deixar claro que só a conta PESSOAL sai, não a organização).
 * - `deletionBlocked`: quando a exclusão self-service ainda não é segura para
 *   este titular, o botão continua visível (a exclusão é iniciada no app), mas
 *   abre a explicação e o canal de atendimento em vez do formulário.
 */
export function AccountDataSection({
  onDeleted,
  deletionNote,
  deletionBlocked,
}: {
  onDeleted: () => void;
  deletionNote?: ReactNode;
  deletionBlocked?: ReactNode;
}) {
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  // Exclusão em andamento não pode ser dispensada por voltar/Escape.
  useOverlay(() => { if (!deleting) setShowDelete(false); }, showDelete);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Exclusão aceita, mas a conta segue até o gateway confirmar o cancelamento da cobrança (Spec 040).
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setMsg(null);
    try {
      await exportMyData();
      setMsg("Seus dados foram baixados.");
    } catch {
      setMsg("Não foi possível exportar agora. Tente de novo.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const outcome = await deleteMyAccount({ confirmation: confirmText.trim(), password: password || undefined });
      if (outcome && outcome.status !== "completed") {
        // NÃO é "conta excluída": a conta continua até a cobrança ser encerrada. Diz isso, sem encerrar a sessão às cegas.
        setPendingNotice(outcome.message);
        setDeleting(false);
        return;
      }
      onDeleted(); // encerra sessão + redireciona
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setDeleteError(
        e instanceof AccountDeletionBlockedError
          ? e.message
          : code === "invalid_password"
            ? "Senha incorreta."
            : "Não foi possível excluir a conta. Tente novamente.",
      );
      setDeleting(false);
    }
  }

  const canConfirm = confirmText.trim() === "EXCLUIR" && !deleting;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: "var(--radius-card)",
        background: COLORS.panel,
        padding: "var(--space-4)",
        display: "grid",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ fontSize: "var(--text-base)", fontWeight: "var(--font-bold)", color: COLORS.text }}>
        Seus dados e conta
      </div>

      <button type="button" className="btn btn-ghost" disabled={exporting} onClick={handleExport} style={{ justifySelf: "start" }}>
        {exporting ? "Exportando…" : "Exportar meus dados"}
      </button>
      {msg && <div style={{ fontSize: "var(--text-sm)", color: COLORS.muted }}>{msg}</div>}

      <button
        type="button"
        onClick={() => { setShowDelete(true); setDeleteError(null); setPassword(""); setConfirmText(""); }}
        style={{
          justifySelf: "start",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          color: COLORS.danger,
          fontSize: "var(--text-sm)",
          fontWeight: "var(--font-semibold)",
        }}
      >
        Excluir minha conta
      </button>

      <div style={{ fontSize: "var(--text-xs)", color: COLORS.mutedSoft, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a href="https://www.s2core.com.br/privacidade" target="_blank" rel="noopener noreferrer" onClick={(e) => handleExternal(e, "https://www.s2core.com.br/privacidade")} style={{ color: COLORS.muted }}>
          Política de Privacidade
        </a>
        <a href="https://www.s2core.com.br/termos" target="_blank" rel="noopener noreferrer" onClick={(e) => handleExternal(e, "https://www.s2core.com.br/termos")} style={{ color: COLORS.muted }}>
          Termos de Uso
        </a>
      </div>

      {showDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))" }}
          onClick={(e) => e.target === e.currentTarget && !deleting && setShowDelete(false)}
        >
          <div style={{ background: COLORS.panel, borderRadius: 14, maxWidth: 420, width: "100%", maxHeight: "100%", overflowY: "auto", padding: 20, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Excluir sua conta</div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>
              Sua conta e seus dados de treino, dieta, check-ins e fotos serão <strong>excluídos permanentemente</strong>.
              Registros financeiros são anonimizados e retidos por obrigação legal. Esta ação <strong>não pode ser desfeita</strong>.
            </div>
            {pendingNotice ? (
              <>
                <div role="status" style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55 }}>{pendingNotice}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={onDeleted}>
                    Entendi, sair
                  </button>
                </div>
              </>
            ) : deletionBlocked ? (
              <>
                <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55 }}>{deletionBlocked}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowDelete(false)}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
            <>
            {deletionNote && (
              <div style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.55 }}>{deletionNote}</div>
            )}
            <label style={{ fontSize: 12, color: COLORS.muted, display: "grid", gap: 4 }}>
              Senha (só se você usa email e senha)
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panelDeep, color: COLORS.text }}
              />
            </label>
            <label style={{ fontSize: 12, color: COLORS.muted, display: "grid", gap: 4 }}>
              Digite <strong style={{ color: COLORS.text }}>EXCLUIR</strong> para confirmar
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoCapitalize="characters"
                style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.panelDeep, color: COLORS.text }}
              />
            </label>
            {deleteError && <div className="badge badge-warn" role="alert">{deleteError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setShowDelete(false)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canConfirm}
                onClick={handleDelete}
                style={{
                  padding: "9px 16px", borderRadius: 8, border: "none",
                  background: canConfirm ? COLORS.danger : COLORS.borderStrong,
                  color: "#fff", fontSize: 13, fontWeight: 700,
                  cursor: canConfirm ? "pointer" : "not-allowed",
                }}
              >
                {deleting ? "Excluindo…" : "Excluir conta"}
              </button>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

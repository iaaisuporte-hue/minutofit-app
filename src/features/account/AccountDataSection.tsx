import { useState } from "react";
import { COLORS } from "../../styles/colors";
import { exportMyData, deleteMyAccount } from "../../services/accountApi";

/**
 * Seção "Seus dados e conta" (LGPD + requisito de loja Apple 5.1.1v / Google).
 * Exportação (SAR) e exclusão self-service. `onDeleted` deve encerrar a sessão.
 */
export function AccountDataSection({ onDeleted }: { onDeleted: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      await deleteMyAccount({ confirmation: confirmText.trim(), password: password || undefined });
      onDeleted(); // encerra sessão + redireciona
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setDeleteError(
        code === "invalid_password"
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
        <a href="https://www.s2core.com.br/privacidade" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.muted }}>
          Política de Privacidade
        </a>
        <a href="https://www.s2core.com.br/termos" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.muted }}>
          Termos de Uso
        </a>
      </div>

      {showDelete && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && !deleting && setShowDelete(false)}
        >
          <div style={{ background: COLORS.panel, borderRadius: 14, maxWidth: 420, width: "100%", padding: 20, display: "grid", gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>Excluir sua conta</div>
            <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.55 }}>
              Sua conta e seus dados de treino, dieta, check-ins e fotos serão <strong>excluídos permanentemente</strong>.
              Registros financeiros são anonimizados e retidos por obrigação legal. Esta ação <strong>não pode ser desfeita</strong>.
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}

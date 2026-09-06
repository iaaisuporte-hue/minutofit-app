import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonPanelCard } from "../../components/feedback/Skeleton";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { IncomingRequestsPanel, NetworkVisibilityBanner } from "../../features/team";
import { NutriInviteDrawer } from "./NutriInviteDrawer";
import { listNutriDirectInvites, revokeNutriDirectInvite, type NutriDirectInvite } from "../../services/nutriApi";

const STATUS_LABEL: Record<NutriDirectInvite["status"], string> = {
  pending: "Aguardando",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
};

const STATUS_BADGE_CLASS: Record<NutriDirectInvite["status"], string> = {
  pending: "badge badge-info",
  accepted: "badge badge-success",
  revoked: "badge badge-neutral",
  expired: "badge badge-neutral",
};

export default function ConvitesPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [invites, setInvites] = useState<NutriDirectInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<NutriDirectInvite | null>(null);
  const [revoking, setRevoking] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listNutriDirectInvites()
      .then(setInvites)
      .catch(() => setInvites([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await revokeNutriDirectInvite(revokeTarget.id);
      load();
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  }

  const pendingCount = invites.filter((i) => i.status === "pending").length;

  return (
    <div style={{ padding: "var(--space-6) 0" }}>
      <ConfirmDialog
        open={!!revokeTarget}
        title="Revogar convite?"
        message="O link deixará de funcionar imediatamente."
        confirmLabel={revoking ? "Revogando..." : "Revogar"}
        danger
        onConfirm={() => void handleRevoke()}
        onCancel={() => setRevokeTarget(null)}
      />
      <NutriInviteDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onInviteCreated={load} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <h1 className="page-title" style={{ margin: 0 }}>Convites</h1>
        <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
          <Plus size={16} aria-hidden="true" /> Convidar paciente
        </button>
      </div>

      <section style={{ marginBottom: "var(--space-7)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
            Convites enviados
          </h2>
          {pendingCount > 0 && <span className="badge badge-info">{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>}
        </div>

        {loading ? (
          <SkeletonPanelCard />
        ) : invites.length === 0 ? (
          <EmptyState
            title="Nenhum link gerado ainda"
            description="Convide seu primeiro paciente — ele se cadastra pelo link e já aparece na sua carteira."
            action={<button type="button" className="btn btn-primary btn-sm" onClick={() => setDrawerOpen(true)}>Convidar paciente</button>}
          />
        ) : (
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {invites.map((inv) => (
              <div key={inv.id} className="card cardPad" style={{ opacity: inv.status === "pending" ? 1 : 0.65 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-3)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "var(--text-sm)", color: COLORS.text }}>
                      {inv.invited_name || "Paciente sem nome"}
                      {inv.invited_email && <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>{inv.invited_email}</span>}
                    </div>
                    <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-1)", display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                      <span className={STATUS_BADGE_CLASS[inv.status]}>{STATUS_LABEL[inv.status]}</span>
                      {inv.accepted_user_name && <span>Aceito por {inv.accepted_user_name}</span>}
                      <span>Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                    {inv.status === "pending" && (
                      <input
                        readOnly
                        className="input"
                        value={inv.inviteUrl}
                        onFocus={(e) => e.target.select()}
                        style={{ marginTop: "var(--space-2)", fontSize: "var(--text-xs)", width: "100%" }}
                      />
                    )}
                  </div>
                  {inv.status === "pending" && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevokeTarget(inv)} style={{ flexShrink: 0 }}>
                      Revogar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
          Solicitações recebidas
        </h2>
        <NetworkVisibilityBanner role="nutri" />
        <IncomingRequestsPanel role="nutri" />
      </section>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchAdminUserById,
  changeUserSubscription,
  type AdminUserRow,
} from "../../services/adminApi";
import { getPlans, type PlanItem } from "../../services/featureApi";
import { COLORS } from "../../styles/colors";

function formatDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function ChangePlanModal({
  userId,
  currentTier,
  onClose,
  onSuccess,
}: {
  userId: string;
  currentTier: string | null;
  onClose: () => void;
  onSuccess: (tierName: string) => void;
}) {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlans()
      .then((data) => setPlans(data))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    setError(null);
    try {
      await changeUserSubscription(userId, selectedId);
      const chosen = plans.find((p) => p.id === selectedId);
      onSuccess(chosen?.name ?? "Plano atualizado");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao alterar plano.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          padding: 22,
          width: "100%",
          maxWidth: 420,
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Alterar plano</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer", fontSize: 20, padding: 4 }}
          >
            ×
          </button>
        </div>

        {currentTier && (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Plano atual: <b style={{ color: COLORS.text }}>{currentTier}</b>
          </div>
        )}

        {loading ? (
          <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando planos...</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedId(plan.id)}
                style={{
                  textAlign: "left",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${selectedId === plan.id ? COLORS.borderStrong : COLORS.border}`,
                  background: selectedId === plan.id ? COLORS.primarySoft : COLORS.panelSoft,
                  color: COLORS.text,
                  cursor: "pointer",
                  fontWeight: selectedId === plan.id ? 700 : 400,
                }}
              >
                {plan.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ borderRadius: 12, border: `1px solid ${COLORS.redBorder}`, background: COLORS.redSoft, padding: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!selectedId || saving}
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.borderStrong}`,
              background: !selectedId || saving ? COLORS.panelSoft : "#22C55E",
              color: !selectedId || saving ? COLORS.muted : "#FFFFFF",
              fontWeight: 700,
              cursor: !selectedId || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Salvando..." : "Confirmar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              color: COLORS.text,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUserDetailsPage() {
  const { userId } = useParams();
  const [user, setUser] = useState<AdminUserRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showChangePlan, setShowChangePlan] = useState(false);
  const [tierName, setTierName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) { setUser(null); return; }
      setError(null);
      setUser(undefined);
      try {
        const data = await fetchAdminUserById(userId);
        if (!cancelled) setUser(data);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar.");
          setUser(null);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId]);

  if (user === undefined && !error) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Carregando aluno...</div>
        <div style={{ color: COLORS.muted }}>Buscando dados no servidor.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div
          style={{
            border: `1px solid ${COLORS.redBorder}`,
            borderRadius: 16,
            background: COLORS.redSoft,
            padding: 16,
          }}
        >
          <div style={{ fontWeight: 700 }}>{error}</div>
          <Link to="/app/admin/users" style={{ color: "#22C55E", marginTop: 8, display: "inline-block" }}>
            Voltar para alunos
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "grid", gap: 12, color: COLORS.text }}>
        <div style={{ fontSize: 24, fontWeight: 700 }}>Aluno não encontrado</div>
        <Link to="/app/admin/users" style={{ color: "#22C55E" }}>
          Voltar para alunos
        </Link>
      </div>
    );
  }

  const profileOk = user.profile_completed;
  const currentTier = tierName ?? user.subscription_tier;

  return (
    <>
      {showChangePlan && userId && (
        <ChangePlanModal
          userId={userId}
          currentTier={currentTier}
          onClose={() => setShowChangePlan(false)}
          onSuccess={(name) => {
            setTierName(name);
            setShowChangePlan(false);
          }}
        />
      )}

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
          <Link to="/app/admin/users" style={{ color: "#22C55E", textDecoration: "none", fontWeight: 600, width: "fit-content" }}>
            ← Voltar para alunos
          </Link>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{user.name || "Sem nome"}</div>
          <div style={{ color: COLORS.muted }}>{user.email}</div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {[
            { label: "Perfil", value: profileOk ? "Completo" : "Pendente" },
            { label: "Papel", value: user.role },
            { label: "Cadastro", value: formatDate(user.created_at) },
            { label: "ID", value: String(user.id) },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                background: COLORS.panel,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                padding: 16,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ color: COLORS.muted, fontSize: 12 }}>{item.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}

          {/* Plano com ação de alterar */}
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 18,
              background: COLORS.panel,
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 16,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ color: COLORS.muted, fontSize: 12 }}>Plano ativo</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{currentTier ?? "Sem assinatura"}</div>
            <button
              type="button"
              onClick={() => setShowChangePlan(true)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.panelSoft,
                color: COLORS.text,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
                width: "fit-content",
              }}
            >
              Alterar plano
            </button>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            padding: 18,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Contexto do aluno</div>
          <div
            style={{
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              padding: 14,
              lineHeight: 1.6,
              color: COLORS.muted,
            }}
          >
            {!profileOk
              ? "Perfil incompleto — o aluno pode precisar de lembrete para concluir dados essenciais."
              : currentTier
                ? "Aluno com assinatura ativa e perfil completo. Acompanhe engajamento e retenção."
                : "Sem assinatura ativa. Verifique pagamento ou use 'Alterar plano' para ajustar manualmente."}
          </div>
        </div>
      </div>
    </>
  );
}

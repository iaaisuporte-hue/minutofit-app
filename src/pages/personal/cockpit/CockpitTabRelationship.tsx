import { useState, useEffect, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { RelationshipTimeline } from "../../../features/personalRetention/RelationshipTimeline";
import { QuickActionsMenu } from "../../../features/personalRetention/QuickActionsMenu";
import {
  fetchStudentSubscription,
  fetchBillingPlans,
  subscribeStudent,
  cancelStudentSubscription,
  type StudentSubscription,
  type BillingPlan,
} from "../../../services/personalBillingApi";

type Props = {
  studentId: string;
  studentName: string;
  studentEmail?: string;
};

const STATUS_LABEL: Record<StudentSubscription["status"], string> = {
  pending: "Aguardando pagamento",
  active: "Ativa",
  paused: "Pausada",
  canceled: "Cancelada",
  expired: "Expirada",
};

const STATUS_COLOR: Record<StudentSubscription["status"], string> = {
  pending: "var(--color-warn)",
  active: "var(--color-success)",
  paused: "var(--color-warn)",
  canceled: "var(--color-text-tertiary)",
  expired: "var(--color-text-tertiary)",
};

function formatBrl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function SubscriptionSection({ studentId, studentEmail }: { studentId: string; studentEmail?: string }) {
  const [sub, setSub] = useState<StudentSubscription | null | undefined>(undefined);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [emailOverride, setEmailOverride] = useState(studentEmail ?? "");
  const [initPoint, setInitPoint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setSub(undefined);
    try {
      const [s, p] = await Promise.all([
        fetchStudentSubscription(studentId),
        fetchBillingPlans(),
      ]);
      setSub(s);
      setPlans(p.filter((x) => x.active));
    } catch {
      setSub(null);
      setPlans([]);
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubscribe() {
    if (!selectedPlan) { setError("Selecione um plano"); return; }
    if (!emailOverride) { setError("E-mail do aluno é obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await subscribeStudent(studentId, {
        planId: selectedPlan,
        studentEmail: emailOverride,
      });
      setSub(result.subscription);
      setInitPoint(result.initPoint || null);
      setShowAssign(false);
    } catch (e: any) {
      setError(e.message || "Erro ao iniciar cobrança");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!sub) return;
    setCanceling(true);
    try {
      await cancelStudentSubscription(sub.id);
      setSub(null);
      setInitPoint(null);
    } catch {
      // noop
    } finally {
      setCanceling(false);
    }
  }

  const activePlans = plans;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Cobrança
        </span>
        {sub === undefined && (
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>Carregando...</span>
        )}
      </div>

      {sub === null && !showAssign && (
        <div
          style={{
            background: "var(--color-surface-raised)",
            border: "1px dashed var(--color-border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--color-text-secondary)" }}>
            {activePlans.length === 0 ? "Crie um plano de cobrança antes de atribuir ao aluno." : "Sem assinatura ativa."}
          </span>
          {activePlans.length > 0 && (
            <button className="pp-btn pp-btn--primary pp-btn--sm" onClick={() => setShowAssign(true)}>
              Iniciar cobrança
            </button>
          )}
        </div>
      )}

      {showAssign && (
        <div
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <select
            className="pp-quick-msg-textarea"
            style={{ minHeight: "auto", height: 36 }}
            value={selectedPlan ?? ""}
            onChange={(e) => setSelectedPlan(Number(e.target.value) || null)}
          >
            <option value="">Selecionar plano</option>
            {activePlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} — {formatBrl(p.priceCents)}/{p.period === "monthly" ? "mês" : p.period}
              </option>
            ))}
          </select>
          <input
            className="pp-quick-msg-textarea"
            style={{ minHeight: "auto", height: 36 }}
            placeholder="E-mail do aluno para pagamento"
            value={emailOverride}
            onChange={(e) => setEmailOverride(e.target.value)}
          />
          {error && <p style={{ color: "var(--color-danger)", fontSize: 12, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="pp-btn pp-btn--ghost pp-btn--sm" onClick={() => setShowAssign(false)} disabled={saving}>
              Cancelar
            </button>
            <button className="pp-btn pp-btn--primary pp-btn--sm" onClick={handleSubscribe} disabled={saving}>
              {saving ? "Gerando link..." : "Gerar link de pagamento"}
            </button>
          </div>
        </div>
      )}

      {initPoint && (
        <div
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-secondary)" }}>
            Envie o link de pagamento ao aluno:
          </p>
          <a
            href={initPoint}
            target="_blank"
            rel="noopener noreferrer"
            className="pp-btn pp-btn--ghost pp-btn--sm"
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            Abrir link <ExternalLink size={12} />
          </a>
        </div>
      )}

      {sub && sub !== null && (
        <div
          style={{
            background: "var(--color-surface-raised)",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 8,
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "var(--color-text-primary)" }}>
                {formatBrl(sub.priceCents)}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: STATUS_COLOR[sub.status] }}>
                {STATUS_LABEL[sub.status]}
              </p>
              {sub.nextChargeAt && (
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-tertiary)" }}>
                  Próxima cobrança: {new Date(sub.nextChargeAt).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {sub.status === "pending" && initPoint && (
                <a
                  href={initPoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pp-btn pp-btn--ghost pp-btn--sm"
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  Link de pagamento <ExternalLink size={12} />
                </a>
              )}
              {["pending", "active", "paused"].includes(sub.status) && (
                <button
                  className="pp-btn pp-btn--ghost pp-btn--sm"
                  style={{ color: "var(--color-danger)" }}
                  onClick={handleCancel}
                  disabled={canceling}
                >
                  {canceling ? "Cancelando..." : "Cancelar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CockpitTabRelationship({ studentId, studentName, studentEmail }: Props) {
  return (
    <div style={{ padding: "4px 0" }}>
      <SubscriptionSection studentId={studentId} studentEmail={studentEmail} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          Histórico de relacionamento
        </span>
        <QuickActionsMenu
          studentId={studentId}
          studentName={studentName}
          onActionDone={() => {}}
        />
      </div>
      <RelationshipTimeline studentId={studentId} />
    </div>
  );
}

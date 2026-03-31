import { useEffect, useMemo, useState } from "react";
import { getFeatures, getPlanFeatures, getPlans, updatePlanFeatures, type FeatureItem, type PlanItem } from "../../services/featureApi";

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  lime: "#7CFF6B",
};

export default function AdminAccessProfilesPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [featuresCatalog, setFeaturesCatalog] = useState<FeatureItem[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || null, [plans, selectedPlanId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setMessage(null);
      try {
        const [plansData, featuresData] = await Promise.all([getPlans(), getFeatures()]);
        if (cancelled) return;
        setPlans(plansData);
        setFeaturesCatalog(featuresData);
        const firstPlanId = plansData[0]?.id ?? null;
        setSelectedPlanId(firstPlanId);
      } catch (error: any) {
        if (!cancelled) setMessage(error.message || "Falha ao carregar configuracoes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    const planId = selectedPlanId;
    let cancelled = false;
    async function loadPlanMatrix() {
      setLoading(true);
      setMessage(null);
      try {
        const data = await getPlanFeatures(planId);
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        data.features.forEach((item) => {
          map[item.key] = item.enabled;
        });
        setDraft(map);
      } catch (error: any) {
        if (!cancelled) setMessage(error.message || "Falha ao carregar permissões do plano.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPlanMatrix();
    return () => {
      cancelled = true;
    };
  }, [selectedPlanId]);

  function toggleFeature(key: string) {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!selectedPlanId) return;
    setSaving(true);
    setMessage(null);
    try {
      const updates = featuresCatalog.map((feature) => ({
        key: feature.key,
        enabled: Boolean(draft[feature.key]),
      }));
      await updatePlanFeatures(selectedPlanId, updates);
      setMessage("Permissões salvas com sucesso.");
    } catch (error: any) {
      setMessage(error.message || "Falha ao salvar permissões.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 1000 }}>Gerência de planos e features</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 860 }}>
          Configure quais funcionalidades ficam habilitadas em cada plano de assinatura. O frontend e o backend usam essa matriz dinamicamente.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 14, alignItems: "start" }}>
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000 }}>Planos disponíveis</div>
          {plans.map((plan) => {
            const active = selectedPlanId === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
                style={{
                  textAlign: "left",
                  padding: 14,
                  borderRadius: 16,
                  border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                  background: active ? COLORS.primarySoft : COLORS.panelSoft,
                  color: COLORS.text,
                  cursor: "pointer",
                  display: "grid",
                  gap: 6,
                }}
              >
                <div style={{ fontWeight: 1000 }}>{plan.name}</div>
                <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{plan.description}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 20,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 22, fontWeight: 1000 }}>{selectedPlan?.name || "Plano"}</div>
                  <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                    {selectedPlan?.description || "Selecione um plano para editar as features."}
                  </div>
              </div>
              <button
                type="button"
                  onClick={handleSave}
                  disabled={saving || loading || !selectedPlanId}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.border}`,
                    background: COLORS.panelSoft,
                  color: COLORS.text,
                  fontWeight: 1000,
                    cursor: "pointer",
                }}
              >
                  {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>

            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                background: COLORS.panel,
                boxShadow: "0 18px 44px rgba(0,0,0,.45)",
                padding: 18,
                display: "grid",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 1000 }}>Features do plano</div>
              <div style={{ display: "grid", gap: 10 }}>
                {featuresCatalog.map((feature) => {
                  const checked = Boolean(draft[feature.key]);
                  return (
                    <label
                      key={feature.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "22px minmax(0, 1fr)",
                        gap: 12,
                        alignItems: "start",
                        borderRadius: 16,
                        border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                        background: checked ? COLORS.primarySoft : COLORS.panelSoft,
                        padding: 14,
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={!!checked}
                        onChange={() => toggleFeature(feature.key)}
                        style={{ marginTop: 2 }}
                      />
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 1000 }}>{feature.name}</div>
                        <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                          {feature.description}
                        </div>
                        <div style={{ color: COLORS.lime, fontSize: 12, fontWeight: 900 }}>{feature.key}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panel,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              padding: 16,
              color: COLORS.muted,
              lineHeight: 1.6,
            }}
          >
            {message || "As alterações são persistidas no backend e passam a valer para toda a plataforma."}
          </div>
        </div>
      </div>
    </div>
  );
}

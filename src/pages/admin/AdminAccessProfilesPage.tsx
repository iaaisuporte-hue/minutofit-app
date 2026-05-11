import { useEffect, useMemo, useState } from "react";
import { getFeatures, getPlanFeatures, getPlans, updatePlanFeatures, type FeatureItem, type PlanItem } from "../../services/featureApi";
import { useToast } from "../../components/Toast";
import { COLORS } from "../../styles/colors";

const DOMAIN_LABELS: Record<string, string> = {
  engagement: "Engajamento",
  training: "Treino",
  nutrition: "Nutrição",
  messaging: "Mensagens",
  other: "Outros",
};

const DOMAIN_ORDER = ["engagement", "training", "nutrition", "messaging", "other"];

function getDomain(key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes("checkin") || lower.includes("gamif") || lower.includes("streak") || lower.includes("score")) return "engagement";
  if (lower.includes("workout") || lower.includes("training") || lower.includes("video") || lower.includes("lab") || lower.includes("tracker")) return "training";
  if (lower.includes("nutri") || lower.includes("diet") || lower.includes("meal") || lower.includes("food")) return "nutrition";
  if (lower.includes("chat") || lower.includes("message") || lower.includes("notif")) return "messaging";
  return "other";
}

export default function AdminAccessProfilesPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [featuresCatalog, setFeaturesCatalog] = useState<FeatureItem[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || null, [plans, selectedPlanId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [plansData, featuresData] = await Promise.all([getPlans(), getFeatures()]);
        if (cancelled) return;
        setPlans(plansData);
        setFeaturesCatalog(featuresData);
        const firstPlanId = plansData[0]?.id ?? null;
        setSelectedPlanId(firstPlanId);
      } catch (error: unknown) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Falha ao carregar configurações.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedPlanId) return;
    const planId = selectedPlanId;
    let cancelled = false;
    async function loadPlanMatrix() {
      setLoading(true);
      try {
        const data = await getPlanFeatures(planId);
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        data.features.forEach((item) => { map[item.key] = item.enabled; });
        setDraft(map);
      } catch (error: unknown) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Falha ao carregar permissões do plano.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPlanMatrix();
    return () => { cancelled = true; };
  }, [selectedPlanId]);

  function toggleFeature(key: string) {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSave() {
    if (!selectedPlanId) return;
    setSaving(true);
    try {
      const updates = featuresCatalog.map((feature) => ({
        key: feature.key,
        enabled: Boolean(draft[feature.key]),
      }));
      await updatePlanFeatures(selectedPlanId, updates);
      toast.success("Permissões salvas com sucesso.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar permissões.");
    } finally {
      setSaving(false);
    }
  }

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, FeatureItem[]> = {};
    featuresCatalog.forEach((f) => {
      const domain = getDomain(f.key);
      if (!groups[domain]) groups[domain] = [];
      groups[domain].push(f);
    });
    return groups;
  }, [featuresCatalog]);

  return (
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
        <div style={{ fontSize: 28, fontWeight: 700 }}>Planos & Features</div>
        <div style={{ color: COLORS.muted, lineHeight: 1.6, maxWidth: 860 }}>
          Configure quais funcionalidades ficam habilitadas em cada plano de assinatura. O frontend e o backend usam essa matriz dinamicamente.
        </div>
      </div>

      <div
        className="admin-plans-grid"
        style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 14, alignItems: "start" }}
      >
        <div
          style={{
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            background: COLORS.panel,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
            padding: 16,
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>Planos disponíveis</div>
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
                <div style={{ fontWeight: 700 }}>{plan.name}</div>
                {plan.description ? (
                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{plan.description}</div>
                ) : null}
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
              boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
              padding: 18,
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{selectedPlan?.name || "Plano"}</div>
                <div style={{ color: COLORS.muted, lineHeight: 1.6 }}>
                  {selectedPlan?.description || "Selecione um plano para editar as features."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || loading || !selectedPlanId}
                style={{
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${!selectedPlanId || saving ? COLORS.border : COLORS.borderStrong}`,
                  background: !selectedPlanId || saving ? COLORS.panelSoft : "#22C55E",
                  color: !selectedPlanId || saving ? COLORS.muted : "#FFFFFF",
                  fontWeight: 700,
                  cursor: !selectedPlanId || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>

          {loading && (
            <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>Carregando features...</div>
          )}

          {!loading && featuresCatalog.length > 0 && DOMAIN_ORDER.map((domain) => {
            const features = groupedFeatures[domain];
            if (!features || features.length === 0) return null;
            return (
              <div
                key={domain}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 20,
                  background: COLORS.panel,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
                  padding: 18,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 }}>
                  {DOMAIN_LABELS[domain] || domain}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {features.map((feature) => {
                    const checked = Boolean(draft[feature.key]);
                    return (
                      <label
                        key={feature.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          borderRadius: 14,
                          border: `1px solid ${checked ? COLORS.borderStrong : COLORS.border}`,
                          background: checked ? COLORS.primarySoft : COLORS.panelSoft,
                          padding: "12px 14px",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{feature.name}</div>
                          {feature.description ? (
                            <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.4 }}>{feature.description}</div>
                          ) : null}
                          <div style={{ color: "#22C55E", fontSize: 11, fontWeight: 600 }}>{feature.key}</div>
                        </div>
                        <div
                          style={{
                            flexShrink: 0,
                            width: 40,
                            height: 22,
                            borderRadius: 999,
                            background: checked ? "#22C55E" : COLORS.border,
                            position: "relative",
                            transition: "background 0.2s",
                          }}
                          onClick={() => toggleFeature(feature.key)}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 3,
                              left: checked ? 21 : 3,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#FFFFFF",
                              transition: "left 0.2s",
                            }}
                          />
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFeature(feature.key)}
                            style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!loading && featuresCatalog.length === 0 && selectedPlanId && (
            <div style={{ padding: 24, color: COLORS.muted, textAlign: "center" }}>
              Nenhuma feature disponível para configuração.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

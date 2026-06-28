import { useEffect, useMemo, useState } from "react";
import { COLORS } from "../../styles/colors";
import { Banner } from "../../components/Banner";
import {
  fetchClinicalProfile,
  fetchDietaryCatalog,
  addClinicalProfileItem,
  deleteClinicalProfileItem,
  DIETARY_KIND_LABELS,
  SEVERITY_LABELS,
  PREFERENCE_LABELS,
  type DietaryKind,
  type Severity,
  type PreferenceKind,
  type ProfileItem,
  type CatalogEntry,
  type ProfileItemPayload,
} from "../../services/nutriApi";

const KIND_ORDER: DietaryKind[] = [
  "allergy",
  "intolerance",
  "restriction",
  "preference",
  "clinical_condition",
  "medication",
];

const SEVERITY_OPTIONS: Severity[] = ["mild", "moderate", "severe"];

function severityColor(sev: Severity | null): string {
  if (sev === "severe") return "var(--color-danger)";
  if (sev === "moderate") return "var(--color-warn-text)";
  return COLORS.muted;
}

interface DraftState {
  catalogId: number | null;
  customLabel: string;
  severity: Severity | null;
  preferenceKind: PreferenceKind | null;
  notes: string;
}

const EMPTY_DRAFT: DraftState = {
  catalogId: null,
  customLabel: "",
  severity: null,
  preferenceKind: null,
  notes: "",
};

export default function ClinicalProfileTab({ patientId }: { patientId: number }) {
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [hasSevereAllergy, setHasSevereAllergy] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addingKind, setAddingKind] = useState<DietaryKind | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [profile, cat] = await Promise.all([
        fetchClinicalProfile(patientId),
        fetchDietaryCatalog(),
      ]);
      setItems(profile.items);
      setHasSevereAllergy(profile.hasSevereAllergy);
      setCatalog(cat);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o perfil");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const itemsByKind = useMemo(() => {
    const map = new Map<DietaryKind, ProfileItem[]>();
    for (const k of KIND_ORDER) map.set(k, []);
    for (const it of items) map.get(it.kind)?.push(it);
    return map;
  }, [items]);

  const catalogByKind = useMemo(() => {
    const map = new Map<DietaryKind, CatalogEntry[]>();
    for (const k of KIND_ORDER) map.set(k, []);
    for (const c of catalog) map.get(c.kind)?.push(c);
    return map;
  }, [catalog]);

  function openAdd(kind: DietaryKind) {
    setAddingKind(kind);
    setDraft(EMPTY_DRAFT);
  }

  function closeAdd() {
    setAddingKind(null);
    setDraft(EMPTY_DRAFT);
  }

  async function handleSave(kind: DietaryKind) {
    const hasCatalog = draft.catalogId != null;
    const hasCustom = draft.customLabel.trim().length > 0;
    if (hasCatalog === hasCustom) {
      setError("Selecione um item da lista ou digite em “Outro”.");
      return;
    }
    if (kind === "allergy" && !draft.severity) {
      setError("Defina a gravidade da alergia.");
      return;
    }
    if (kind === "preference" && !draft.preferenceKind) {
      setError("Escolha se o paciente gosta ou evita.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: ProfileItemPayload = {
        kind,
        catalogId: hasCatalog ? draft.catalogId : null,
        customLabel: hasCustom ? draft.customLabel.trim() : null,
        severity: kind === "allergy" || kind === "intolerance" ? draft.severity : null,
        preferenceKind: kind === "preference" ? draft.preferenceKind : null,
        notes: draft.notes.trim() || null,
      };
      await addClinicalProfileItem(patientId, payload);
      closeAdd();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item: ProfileItem) {
    try {
      await deleteClinicalProfileItem(patientId, item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (item.kind === "allergy" && item.severity === "severe") {
        setHasSevereAllergy((prev) =>
          items.some((i) => i.id !== item.id && i.kind === "allergy" && i.severity === "severe") ? prev : false,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover");
    }
  }

  if (loading) {
    return <div style={{ color: COLORS.muted, fontSize: 14, padding: "8px 0" }}>Carregando perfil…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {hasSevereAllergy && (
        <Banner
          variant="error"
          title="Alergia grave registrada"
          description="Verifique as alergias antes de prescrever qualquer alimento. Itens da dieta com risco geram alerta forte."
        />
      )}

      {error && <Banner variant="warn" description={error} onClose={() => setError(null)} />}

      <p style={{ fontSize: 13, color: COLORS.muted, margin: 0, lineHeight: 1.5 }}>
        Informações usadas para segurança alimentar e personalização. Alergia e intolerância geram alerta ao montar a
        dieta; preferências apenas sugerem substituição.
      </p>

      {KIND_ORDER.map((kind) => {
        const list = itemsByKind.get(kind) ?? [];
        const options = catalogByKind.get(kind) ?? [];
        const isAdding = addingKind === kind;
        return (
          <section
            key={kind}
            style={{
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              padding: "14px 16px",
              background: "var(--color-surface)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: list.length || isAdding ? 12 : 0 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, margin: 0 }}>
                {DIETARY_KIND_LABELS[kind]}
                {list.length > 0 && (
                  <span style={{ color: COLORS.muted, fontWeight: 500 }}> · {list.length}</span>
                )}
              </h3>
              {!isAdding && (
                <button
                  type="button"
                  onClick={() => openAdd(kind)}
                  style={{
                    background: "none",
                    border: "none",
                    color: COLORS.primary,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + Adicionar
                </button>
              )}
            </div>

            {/* Chips dos itens */}
            {list.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {list.map((item) => (
                  <span
                    key={item.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 500,
                      color: COLORS.text,
                      background: "var(--color-surface-muted, #F3F4F6)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 999,
                      padding: "4px 10px",
                    }}
                    title={item.notes ?? undefined}
                  >
                    {item.label}
                    {item.severity && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: "0.03em",
                          color: severityColor(item.severity),
                        }}
                      >
                        {SEVERITY_LABELS[item.severity]}
                      </span>
                    )}
                    {item.preferenceKind && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: COLORS.muted }}>
                        {PREFERENCE_LABELS[item.preferenceKind]}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(item)}
                      aria-label={`Remover ${item.label}`}
                      style={{
                        background: "none",
                        border: "none",
                        color: COLORS.muted,
                        cursor: "pointer",
                        fontSize: 14,
                        lineHeight: 1,
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {list.length === 0 && !isAdding && (
              <span style={{ fontSize: 13, color: COLORS.muted }}>Nada registrado.</span>
            )}

            {/* Formulário de adição */}
            {isAdding && (
              <AddForm
                kind={kind}
                options={options}
                draft={draft}
                setDraft={setDraft}
                saving={saving}
                onCancel={closeAdd}
                onSave={() => handleSave(kind)}
              />
            )}
          </section>
        );
      })}
    </div>
  );
}

function AddForm({
  kind,
  options,
  draft,
  setDraft,
  saving,
  onCancel,
  onSave,
}: {
  kind: DietaryKind;
  options: CatalogEntry[];
  draft: DraftState;
  setDraft: (d: DraftState) => void;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const chipBase: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 999,
    padding: "5px 11px",
    cursor: "pointer",
    border: "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color: COLORS.text,
  };

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Catálogo como chips selecionáveis (um por vez) */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {options.map((opt) => {
            const selected = draft.catalogId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  setDraft({ ...draft, catalogId: selected ? null : opt.id, customLabel: "" })
                }
                style={{
                  ...chipBase,
                  borderColor: selected ? COLORS.primary : "var(--color-border)",
                  color: selected ? COLORS.primary : COLORS.text,
                  fontWeight: selected ? 700 : 500,
                }}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      )}

      {/* "Outro" custom */}
      <input
        type="text"
        value={draft.customLabel}
        placeholder="Outro (digite e padronize depois)"
        onChange={(e) => setDraft({ ...draft, customLabel: e.target.value, catalogId: null })}
        maxLength={120}
        style={{
          width: "100%",
          fontSize: 14,
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: COLORS.text,
        }}
      />

      {/* Severidade (alergia obrigatória / intolerância opcional) */}
      {(kind === "allergy" || kind === "intolerance") && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>
            Gravidade{kind === "allergy" ? " *" : " (opcional)"}:
          </span>
          {SEVERITY_OPTIONS.map((sev) => {
            const selected = draft.severity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setDraft({ ...draft, severity: selected ? null : sev })}
                style={{
                  ...chipBase,
                  borderColor: selected ? severityColor(sev) : "var(--color-border)",
                  color: selected ? severityColor(sev) : COLORS.text,
                  fontWeight: selected ? 700 : 500,
                }}
              >
                {SEVERITY_LABELS[sev]}
              </button>
            );
          })}
        </div>
      )}

      {/* Preferência: gosta / evita */}
      {kind === "preference" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: COLORS.muted }}>Tipo *:</span>
          {(["like", "avoid"] as PreferenceKind[]).map((pk) => {
            const selected = draft.preferenceKind === pk;
            return (
              <button
                key={pk}
                type="button"
                onClick={() => setDraft({ ...draft, preferenceKind: selected ? null : pk })}
                style={{
                  ...chipBase,
                  borderColor: selected ? COLORS.primary : "var(--color-border)",
                  color: selected ? COLORS.primary : COLORS.text,
                  fontWeight: selected ? 700 : 500,
                }}
              >
                {PREFERENCE_LABELS[pk]}
              </button>
            );
          })}
        </div>
      )}

      {/* Observação opcional */}
      <input
        type="text"
        value={draft.notes}
        placeholder="Observação (opcional)"
        onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
        maxLength={280}
        style={{
          width: "100%",
          fontSize: 13,
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          color: COLORS.text,
        }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost btn-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { COLORS } from "../../styles/colors";
import { Banner } from "../../components/Banner";
import { ConfirmDialog } from "../../components/ConfirmDialog";
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

// SPEC 036 / §41-42: um único mapa de status — a mesma severidade não pode
// pintar cores diferentes em telas diferentes do módulo.
function severityBadgeClass(sev: Severity | null): string {
  if (sev === "severe") return "badge badge-danger";
  if (sev === "moderate") return "badge badge-warn";
  return "badge";
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
  const [pendingRemoval, setPendingRemoval] = useState<ProfileItem | null>(null);

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

  // SPEC 036 / NUTRI-30: remoção passava direto, sem confirmação — inclusive
  // para o item que dispara o banner "Alergia grave registrada". Item
  // clínico ou alergia/intolerância grave pede confirmação; o resto (uma
  // preferência, por exemplo) continua removendo direto, sem fricção onde
  // o risco de engano é baixo.
  function isHighStakes(item: ProfileItem): boolean {
    return item.kind === "clinical_condition" || item.kind === "medication" || item.severity === "severe";
  }

  function requestRemove(item: ProfileItem) {
    if (isHighStakes(item)) {
      setPendingRemoval(item);
    } else {
      void doRemove(item);
    }
  }

  async function doRemove(item: ProfileItem) {
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
    } finally {
      setPendingRemoval(null);
    }
  }

  if (loading) {
    return <p className="muted" style={{ fontSize: "var(--text-base)", padding: "var(--space-2) 0" }}>Carregando perfil…</p>;
  }

  return (
    <div className="stack">
      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remover item clínico?"
        message={
          pendingRemoval
            ? `Remover "${pendingRemoval.label}" do perfil de ${DIETARY_KIND_LABELS[pendingRemoval.kind].toLowerCase()}? A checagem de segurança alimentar deixa de considerar este item.`
            : undefined
        }
        confirmLabel="Remover"
        danger
        onConfirm={() => pendingRemoval && void doRemove(pendingRemoval)}
        onCancel={() => setPendingRemoval(null)}
      />

      {hasSevereAllergy && (
        <Banner
          variant="error"
          title="Alergia grave registrada"
          description="Verifique as alergias antes de prescrever qualquer alimento. Itens da dieta com risco geram alerta forte."
        />
      )}

      {error && <Banner variant="warn" description={error} onClose={() => setError(null)} />}

      <p className="muted" style={{ fontSize: "var(--text-sm)", margin: 0, lineHeight: 1.5 }}>
        Informações usadas para segurança alimentar e personalização. Alergia e intolerância geram alerta ao montar a
        dieta; preferências apenas sugerem substituição.
      </p>

      {KIND_ORDER.map((kind) => {
        const list = itemsByKind.get(kind) ?? [];
        const options = catalogByKind.get(kind) ?? [];
        const isAdding = addingKind === kind;
        return (
          <section key={kind} className="card cardPad">
            <div className="row" style={{ marginBottom: list.length || isAdding ? "var(--space-3)" : 0 }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, margin: 0 }}>
                {DIETARY_KIND_LABELS[kind]}
                {list.length > 0 && <span className="muted" style={{ fontWeight: 500 }}> · {list.length}</span>}
              </h3>
              {!isAdding && (
                <button type="button" onClick={() => openAdd(kind)} className="btn btn-ghost btn-sm">
                  <Plus size={14} aria-hidden="true" /> Adicionar
                </button>
              )}
            </div>

            {/* Chips dos itens */}
            {list.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {list.map((item) => (
                  <span key={item.id} className="badge" title={item.notes ?? undefined} style={{ gap: "var(--space-2)" }}>
                    {item.label}
                    {item.severity && (
                      <span className={severityBadgeClass(item.severity)} style={{ padding: "0 4px" }}>
                        {SEVERITY_LABELS[item.severity]}
                      </span>
                    )}
                    {item.preferenceKind && (
                      <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700 }}>
                        {PREFERENCE_LABELS[item.preferenceKind]}
                      </span>
                    )}
                    {/* SPEC 036: sem `hit-target-44` aqui de propósito — em
                        chips densos (8px de gap) a área invisível de 44px se
                        sobreporia ao chip vizinho. Padding real em vez de
                        alvo fantasma. */}
                    <button
                      type="button"
                      onClick={() => requestRemove(item)}
                      aria-label={`Remover ${item.label}`}
                      style={{
                        background: "none", border: "none", color: "inherit", cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: "var(--space-1)", margin: "calc(var(--space-1) * -1)", borderRadius: "50%",
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {list.length === 0 && !isAdding && (
              <span className="muted" style={{ fontSize: "var(--text-sm)" }}>Nada registrado.</span>
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
  return (
    <div className="stack" style={{ marginTop: "var(--space-2)" }}>
      {/* Catálogo como chips selecionáveis (um por vez) */}
      {options.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {options.map((opt) => {
            const selected = draft.catalogId === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDraft({ ...draft, catalogId: selected ? null : opt.id, customLabel: "" })}
                className={selected ? "badge badge-accent" : "badge"}
                style={{ cursor: "pointer", border: selected ? undefined : "1px solid var(--color-border)" }}
              >
                {opt.name}
              </button>
            );
          })}
        </div>
      )}

      {/* "Outro" custom */}
      <div className="field">
        <label className="label" htmlFor={`custom-label-${kind}`}>Outro (digite e padronize depois)</label>
        <input
          id={`custom-label-${kind}`}
          type="text"
          className="input"
          value={draft.customLabel}
          placeholder="Ex: aversão a coentro"
          onChange={(e) => setDraft({ ...draft, customLabel: e.target.value, catalogId: null })}
          maxLength={120}
        />
      </div>

      {/* Severidade (alergia obrigatória / intolerância opcional) */}
      {(kind === "allergy" || kind === "intolerance") && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>
            Gravidade{kind === "allergy" ? " *" : " (opcional)"}:
          </span>
          {SEVERITY_OPTIONS.map((sev) => {
            const selected = draft.severity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => setDraft({ ...draft, severity: selected ? null : sev })}
                className={selected ? severityBadgeClass(sev) : "badge"}
                style={{ cursor: "pointer" }}
              >
                {SEVERITY_LABELS[sev]}
              </button>
            );
          })}
        </div>
      )}

      {/* Preferência: gosta / evita */}
      {kind === "preference" && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="muted" style={{ fontSize: "var(--text-xs)" }}>Tipo *:</span>
          {(["like", "avoid"] as PreferenceKind[]).map((pk) => {
            const selected = draft.preferenceKind === pk;
            return (
              <button
                key={pk}
                type="button"
                onClick={() => setDraft({ ...draft, preferenceKind: selected ? null : pk })}
                className={selected ? "badge badge-accent" : "badge"}
                style={{ cursor: "pointer" }}
              >
                {PREFERENCE_LABELS[pk]}
              </button>
            );
          })}
        </div>
      )}

      {/* Observação opcional */}
      <div className="field">
        <label className="label" htmlFor={`notes-${kind}`}>Observação (opcional)</label>
        <input
          id={`notes-${kind}`}
          type="text"
          className="input"
          value={draft.notes}
          placeholder="Ex: relatado pelo próprio paciente em 03/09"
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          maxLength={280}
        />
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button type="button" onClick={onSave} disabled={saving} className="btn btn-primary btn-sm">
          {saving ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn btn-ghost btn-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}

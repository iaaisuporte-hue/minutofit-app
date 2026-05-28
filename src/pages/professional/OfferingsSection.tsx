import { useEffect, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  archiveOffering,
  createOffering,
  listMyOfferings,
  updateOffering,
  type OfferingPeriod,
  type ProfessionalOffering,
} from "../../services/professionalNetworkApi";

const PERIOD_LABELS: Record<OfferingPeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

interface DraftForm {
  id?: string;
  title: string;
  description: string;
  priceBrl: string;
  period: OfferingPeriod;
}

const EMPTY_DRAFT: DraftForm = {
  title: "",
  description: "",
  priceBrl: "",
  period: "monthly",
};

function formatPrice(cents: number, currency: string): string {
  const value = (cents / 100).toFixed(2).replace(".", ",");
  return `${currency === "BRL" ? "R$" : currency} ${value}`;
}

function parsePriceBrl(input: string): number | null {
  const normalized = input.trim().replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export default function OfferingsSection() {
  const [offerings, setOfferings] = useState<ProfessionalOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DraftForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    setLoading(true);
    try {
      const data = await listMyOfferings();
      setOfferings(data);
    } finally {
      setLoading(false);
    }
  }

  function startCreate() {
    setError(null);
    setEditing({ ...EMPTY_DRAFT });
  }

  function startEdit(o: ProfessionalOffering) {
    setError(null);
    setEditing({
      id: o.id,
      title: o.title,
      description: o.description ?? "",
      priceBrl: (o.priceCents / 100).toFixed(2).replace(".", ","),
      period: o.period,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    if (!editing || saving) return;
    setError(null);
    const priceCents = parsePriceBrl(editing.priceBrl);
    if (!editing.title.trim() || priceCents == null) {
      setError("Informe título e preço válido.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: editing.title.trim(),
        description: editing.description.trim() || null,
        priceCents,
        period: editing.period,
      };
      if (editing.id) {
        await updateOffering(editing.id, payload);
      } else {
        await createOffering(payload);
      }
      setEditing(null);
      await reload();
    } catch (err: unknown) {
      const e = err as { message?: string };
      if (e.message === "max_active_offerings_reached") {
        setError("Limite de 5 ofertas ativas atingido. Arquive uma antes de criar outra.");
      } else if (e.message === "cannot_edit_active_price") {
        setError("Não é possível alterar o preço com assinaturas ativas. Crie uma nova oferta.");
      } else {
        setError("Não foi possível salvar a oferta.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Arquivar esta oferta? Assinaturas existentes continuam válidas.")) return;
    try {
      await archiveOffering(id);
      await reload();
    } catch {
      setError("Não foi possível arquivar a oferta.");
    }
  }

  const activeCount = offerings.filter((o) => o.status === "active").length;
  const canCreate = activeCount < 5;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.01em" }}>
          Planos comerciais
        </h2>
        <span style={{ fontSize: 12, color: COLORS.muted }}>
          {activeCount}/5 ativos
        </span>
      </div>
      <p style={{ fontSize: 13, color: COLORS.muted, marginTop: 0, marginBottom: 16 }}>
        Ofertas pagas que aparecem no seu perfil público para alunos contratarem direto.
      </p>

      {loading ? (
        <div style={{ fontSize: 13, color: COLORS.muted }}>Carregando…</div>
      ) : (
        <>
          {offerings.length === 0 && !editing && (
            <div
              className="card cardPad"
              style={{ textAlign: "center", color: COLORS.muted, fontSize: 13 }}
            >
              Nenhum plano cadastrado ainda.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {offerings.map((o) => (
              <div
                key={o.id}
                className="card cardPad"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  opacity: o.status === "archived" ? 0.55 : 1,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text, fontSize: 14 }}>{o.title}</span>
                    {o.status === "archived" && (
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          color: COLORS.muted,
                          padding: "1px 6px",
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: 4,
                        }}
                      >
                        Arquivado
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.muted }}>
                    {formatPrice(o.priceCents, o.currency)} · {PERIOD_LABELS[o.period]}
                  </div>
                  {o.description && (
                    <div style={{ fontSize: 12, color: COLORS.mutedSoft, marginTop: 4 }}>{o.description}</div>
                  )}
                </div>
                {o.status === "active" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => startEdit(o)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => void handleArchive(o.id)}
                      style={{ color: COLORS.muted }}
                    >
                      Arquivar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {!editing && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={startCreate}
              disabled={!canCreate}
              style={{ marginTop: 12, opacity: canCreate ? 1 : 0.5 }}
              title={canCreate ? undefined : "Limite de 5 ativos atingido"}
            >
              + Novo plano comercial
            </button>
          )}

          {editing && (
            <div className="card cardPad" style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 14 }}>
                {editing.id ? "Editar plano" : "Novo plano"}
              </div>
              <div className="field">
                <label className="label" htmlFor="off-title">Título *</label>
                <input
                  id="off-title"
                  className="input"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: Acompanhamento mensal premium"
                  maxLength={120}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="off-desc">Descrição curta</label>
                <textarea
                  id="off-desc"
                  className="input"
                  rows={2}
                  maxLength={400}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="O que o aluno recebe (até 400 caracteres)"
                  style={{ resize: "vertical" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div className="field">
                  <label className="label" htmlFor="off-price">Preço (R$) *</label>
                  <input
                    id="off-price"
                    className="input"
                    inputMode="decimal"
                    value={editing.priceBrl}
                    onChange={(e) => setEditing({ ...editing, priceBrl: e.target.value })}
                    placeholder="200,00"
                  />
                </div>
                <div className="field">
                  <label className="label" htmlFor="off-period">Periodicidade</label>
                  <select
                    id="off-period"
                    className="input"
                    value={editing.period}
                    onChange={(e) => setEditing({ ...editing, period: e.target.value as OfferingPeriod })}
                  >
                    {(Object.entries(PERIOD_LABELS) as [OfferingPeriod, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              {error && (
                <div style={{ fontSize: 12, color: COLORS.danger }}>{error}</div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  style={{ opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? "Salvando…" : editing.id ? "Salvar" : "Criar plano"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

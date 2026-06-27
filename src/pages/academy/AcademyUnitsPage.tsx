import { useCallback, useEffect, useState } from "react";
import {
  fetchUnits,
  createUnit,
  updateUnit,
  setUnitStatus,
  setUnitPrimary,
  type AcademyUnit,
} from "../../services/academyApi";
import { useAuth } from "../../auth/AuthContext";

export default function AcademyUnitsPage() {
  const auth = useAuth();
  const canWrite = auth.hasPermission("academy.units.write");

  const [units, setUnits] = useState<AcademyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(true);

  // form state (create or edit)
  const [editing, setEditing] = useState<AcademyUnit | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUnits(await fetchUnits(includeInactive));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar unidades.");
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setAddress("");
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(u: AcademyUnit) {
    setEditing(u);
    setName(u.name);
    setAddress(u.address ?? "");
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateUnit(editing.id, { name, address: address || null });
      } else {
        await createUnit({ name, address: address || null });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação falhou.");
    }
  }

  return (
    <div className="page-container">
      <div className="dash-hero" style={{ marginBottom: "var(--space-5)" }}>
        <div>
          <div className="dash-hero-eyebrow">Configuração</div>
          <h1 className="dash-hero-title">Unidades</h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Filiais da academia. A unidade principal é usada como padrão; inativar não apaga histórico.
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={openCreate}>Nova unidade</button>
        )}
      </div>

      {error && <div className="banner banner-danger" style={{ marginBottom: "var(--space-4)" }}>{error}</div>}

      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "var(--text-sm)", marginBottom: "var(--space-3)" }}>
        <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
        Mostrar inativas
      </label>

      {loading ? (
        <div className="muted">Carregando…</div>
      ) : units.length === 0 ? (
        <div className="section-card">
          <div className="dash-eyebrow" style={{ marginBottom: 4 }}>Nenhuma unidade</div>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
            A academia ainda não tem unidades cadastradas. {canWrite ? 'Use "Nova unidade" para criar a primeira (ela vira a principal).' : ""}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          {units.map((u) => (
            <div key={u.id} className="section-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)", flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{u.name}</strong>
                  {u.isPrimary && <span className="badge badge-info" style={{ fontSize: 10 }}>Principal</span>}
                  <span className={u.status === "active" ? "badge badge-success" : "badge badge-warn"} style={{ fontSize: 10 }}>
                    {u.status === "active" ? "Ativa" : "Inativa"}
                  </span>
                </div>
                {u.address && <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: 2 }}>{u.address}</div>}
              </div>
              {canWrite && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => openEdit(u)}>Editar</button>
                  {!u.isPrimary && u.status === "active" && (
                    <button className="btn btn-sm btn-secondary" onClick={() => act(() => setUnitPrimary(u.id))}>Tornar principal</button>
                  )}
                  {u.status === "active" ? (
                    <button className="btn btn-sm btn-ghost" onClick={() => act(() => setUnitStatus(u.id, "inactive"))}>Inativar</button>
                  ) : (
                    <button className="btn btn-sm btn-ghost" onClick={() => act(() => setUnitStatus(u.id, "active"))}>Reativar</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <h2 className="section-card__title" style={{ marginBottom: "var(--space-4)" }}>
              {editing ? "Editar unidade" : "Nova unidade"}
            </h2>
            <label className="dash-eyebrow">Nome *</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Unidade Centro" style={{ marginBottom: "var(--space-3)" }} />
            <label className="dash-eyebrow">Endereço</label>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro…" style={{ marginBottom: "var(--space-3)" }} />
            {formError && <div style={{ color: "var(--color-danger)", fontSize: 12, marginBottom: 8 }}>{formError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || name.trim().length < 2}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

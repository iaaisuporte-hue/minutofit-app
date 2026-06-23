import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../components/Toast";
import { COLORS } from "../../styles/colors";
import {
  createAdminPlatformProtocol,
  deleteAdminPlatformProtocol,
  fetchAdminPlatformProtocols,
  updateAdminPlatformProtocol,
} from "../../services/adminApi";
import type { WorkoutProtocol } from "../../services/workoutProtocolsApi";

const DEFAULT_ITEMS_JSON = `[
  {
    "exerciseId": "e2",
    "name": "Agachamento Livre",
    "sets": "4",
    "reps": "8-10",
    "rest": "90s",
    "notes": "Exemplo — ajuste ids e cargas."
  }
]`;

export default function AdminWorkoutProtocolsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<WorkoutProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weekPreset, setWeekPreset] = useState("5");
  const [selectedGroup, setSelectedGroup] = useState<string | null>("Perna");
  const [itemsJson, setItemsJson] = useState(DEFAULT_ITEMS_JSON);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPlatformProtocols(120);
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar protocolos.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setWeekPreset("5");
    setSelectedGroup("Perna");
    setItemsJson(DEFAULT_ITEMS_JSON);
  }

  function beginEdit(p: WorkoutProtocol) {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description ?? "");
    setWeekPreset(String(p.weekPreset || "5"));
    setSelectedGroup(p.selectedGroup ?? "");
    setItemsJson(JSON.stringify(p.items, null, 2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let items: unknown[];
    try {
      items = JSON.parse(itemsJson) as unknown[];
      if (!Array.isArray(items)) throw new Error("JSON precisa ser um array.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "JSON de exercicios invalido.");
      return;
    }
    setSaving(true);
    try {
      if (editingId != null) {
        await updateAdminPlatformProtocol(editingId, {
          title: title.trim(),
          description: description.trim() || null,
          weekPreset,
          selectedGroup: selectedGroup?.trim() ? selectedGroup : null,
          items,
        });
        toast.success("Protocolo atualizado.");
      } else {
        await createAdminPlatformProtocol({
          title: title.trim(),
          description: description.trim() || null,
          weekPreset,
          selectedGroup: selectedGroup?.trim() ? selectedGroup : null,
          items,
        });
        toast.success("Protocolo criado.");
      }
      resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number, label: string) {
    if (!window.confirm(`Excluir o protocolo "${label}"? Esta acao nao pode ser desfeita.`)) return;
    try {
      await deleteAdminPlatformProtocol(id);
      toast.success("Protocolo excluido.");
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao excluir.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header>
        <h1 style={{ margin: "0 0 8px", fontSize: 22, color: COLORS.text }}>Protocolos da plataforma</h1>
        <p style={{ margin: 0, fontSize: 14, color: COLORS.muted, maxWidth: 720, lineHeight: 1.5 }}>
          Modelos S2Core visiveis a todos os personais (escopo plataforma). Itens seguem o mesmo formato da ficha:
          exerciseId, name, sets, reps, rest e campos opcionais (rpe, cadence, restPause, notes).
        </p>
      </header>

      <section
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 16,
          background: COLORS.card,
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: 16, color: COLORS.text }}>
          {editingId != null ? `Editar protocolo #${editingId}` : "Novo protocolo"}
        </h2>
        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.muted }}>
            Titulo
            <input
              required
              value={title}
              onChange={(ev) => setTitle(ev.target.value)}
              style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}
            />
          </label>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.muted }}>
            Descricao (opcional)
            <textarea
              value={description}
              onChange={(ev) => setDescription(ev.target.value)}
              rows={2}
              style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.muted }}>
              Dias / preset
              <select
                value={weekPreset}
                onChange={(ev) => setWeekPreset(ev.target.value)}
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              >
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="semana_util">semana_util</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.muted }}>
              Grupo sugerido
              <input
                value={selectedGroup ?? ""}
                onChange={(ev) => setSelectedGroup(ev.target.value || null)}
                placeholder="Perna"
                style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${COLORS.border}`, minWidth: 160 }}
              />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.muted }}>
            Itens (JSON)
            <textarea
              value={itemsJson}
              onChange={(ev) => setItemsJson(ev.target.value)}
              spellCheck={false}
              rows={10}
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
              }}
            />
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              style={{
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: COLORS.primary,
                color: "#fff",
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Salvando…" : editingId != null ? "Salvar alteracoes" : "Criar protocolo"}
            </button>
            {editingId != null ? (
              <button
                type="button"
                onClick={() => resetForm()}
                style={{
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                  background: "transparent",
                  color: COLORS.text,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar edicao
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, color: COLORS.text }}>Catalogo atual</h2>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.card,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            Atualizar
          </button>
        </div>
        {loading ? (
          <p style={{ color: COLORS.muted }}>Carregando…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: COLORS.muted }}>Nenhum protocolo de plataforma cadastrado.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  padding: 14,
                  borderRadius: 10,
                  border: `1px solid ${editingId === p.id ? COLORS.primaryBorder : COLORS.border}`,
                  background: COLORS.card,
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 240px" }}>
                  <div style={{ fontWeight: 650, color: COLORS.text }}>{p.title}</div>
                  {p.description ? (
                    <div style={{ marginTop: 6, fontSize: 13, color: COLORS.muted, lineHeight: 1.45 }}>{p.description}</div>
                  ) : null}
                  <div style={{ marginTop: 8, fontSize: 12, color: COLORS.mutedSoft }}>
                    {p.items.length} exercicios · preset {p.weekPreset}
                    {p.selectedGroup ? ` · ${p.selectedGroup}` : ""} · atualizado {new Date(p.updatedAt).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => beginEdit(p)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.border}`,
                      background: "transparent",
                      color: COLORS.text,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete(p.id, p.title)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: `1px solid ${COLORS.dangerBorder}`,
                      background: "transparent",
                      color: COLORS.danger,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

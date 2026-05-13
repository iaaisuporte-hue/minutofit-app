import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { COLORS } from "../../styles/colors";
import {
  createStudentNote,
  deleteStudentNote,
  listStudentNotes,
  STUDENT_NOTE_KINDS,
  type StudentExerciseNote,
  type StudentNoteKind,
} from "../../services/studentNotesApi";
import { fetchVideosSearch } from "../../services/videosSearchApi";
import "./personalPremium.css";

export type TechnicalNoteHighlight = {
  exerciseName: string;
  kind: string;
  count: number;
  lastNoteAt: string;
};

const KIND_LABEL: Record<StudentNoteKind, string> = {
  technique: "Técnica",
  pain: "Dor",
  load: "Carga",
  progression: "Progressão",
  cue: "Cue",
  rom: "Amplitude",
  breathing: "Respiração",
  cadence: "Cadência",
  general: "Geral",
};

const COMMON_EXERCISES: Array<{ id: string; name: string }> = [
  { id: "agachamento", name: "Agachamento livre" },
  { id: "leg-press", name: "Leg press 45°" },
  { id: "afundo", name: "Afundo / avanço" },
  { id: "stiff", name: "Levantamento terra romeno (stiff)" },
  { id: "mesa-flexora", name: "Mesa flexora" },
  { id: "extensora", name: "Cadeira extensora" },
  { id: "supino-reto", name: "Supino reto" },
  { id: "supino-inclinado", name: "Supino inclinado (halteres)" },
  { id: "crucifixo", name: "Crucifixo" },
  { id: "remada-curvada", name: "Remada curvada" },
  { id: "puxada-frontal", name: "Puxada frontal" },
  { id: "remada-baixa", name: "Remada baixa (triângulo)" },
  { id: "desenvolvimento", name: "Desenvolvimento militar" },
  { id: "elevacao-lateral", name: "Elevação lateral" },
  { id: "rosca-direta", name: "Rosca direta" },
  { id: "triceps-polia", name: "Tríceps polia alta" },
  { id: "prancha", name: "Prancha isométrica" },
  { id: "abdominal-infra", name: "Abdominal infra" },
  { id: "bike", name: "Bike ergométrica" },
  { id: "esteira", name: "Esteira (cardio)" },
];

function formatShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  studentId: string;
  highlights: TechnicalNoteHighlight[];
  onSaved: () => void;
};

export default function StudentTechnicalNotes({ studentId, highlights, onSaved }: Props) {
  const { user } = useAuth();
  const myId = user?.id != null ? Number(user.id) : null;

  const [notes, setNotes] = useState<StudentExerciseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | StudentNoteKind>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseKey, setExerciseKey] = useState<string | null>(null);
  const [kind, setKind] = useState<StudentNoteKind>("technique");
  const [noteText, setNoteText] = useState("");
  const [severity, setSeverity] = useState("");
  const [loadKg, setLoadKg] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [videoQuery, setVideoQuery] = useState("");
  const [videoHits, setVideoHits] = useState<Array<{ id: number; title: string }>>([]);
  const [videoLoading, setVideoLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listStudentNotes(studentId, {
        kind: kindFilter === "all" ? undefined : kindFilter,
        limit: 80,
      });
      setNotes(rows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar notas.");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [studentId, kindFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const q = videoQuery.trim();
    if (q.length < 2) {
      setVideoHits([]);
      return undefined;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setVideoLoading(true);
        try {
          const rows = await fetchVideosSearch({ q, limit: 8 });
          setVideoHits(rows.map((r) => ({ id: r.id, title: r.title })));
        } catch {
          setVideoHits([]);
        } finally {
          setVideoLoading(false);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [videoQuery]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!exerciseName.trim() || !noteText.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createStudentNote(studentId, {
        exerciseName: exerciseName.trim(),
        exerciseKey: exerciseKey || undefined,
        kind,
        note: noteText.trim(),
        severity:
          kind === "pain" && severity.trim()
            ? Math.min(5, Math.max(1, Number(severity)))
            : undefined,
        loadKg: loadKg.trim() ? Number(loadKg.replace(",", ".")) : undefined,
        reps: reps.trim() || undefined,
        sets: sets.trim() || undefined,
      });
      setNoteText("");
      setSeverity("");
      setLoadKg("");
      setReps("");
      setSets("");
      setShowForm(false);
      setVideoQuery("");
      await load();
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nao foi possivel salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Excluir esta nota?")) return;
    try {
      await deleteStudentNote(studentId, id);
      await load();
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nao foi possivel excluir.");
    }
  }

  function pickExercise(id: string, name: string) {
    setExerciseKey(id);
    setExerciseName(name);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {highlights.length > 0 ? (
        <div className="pp-surface">
          <div style={{ fontWeight: 650, color: COLORS.text, marginBottom: 8 }}>Padrões frequentes</div>
          <div style={{ display: "grid", gap: 8 }}>
            {highlights.map((h: TechnicalNoteHighlight, i: number) => (
              <div
                key={`${h.exerciseName}-${h.kind}-${i}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  fontSize: 13,
                  color: COLORS.muted,
                }}
              >
                <span style={{ fontWeight: 600, color: COLORS.text }}>
                  {h.exerciseName} · {KIND_LABEL[h.kind as StudentNoteKind] ?? h.kind}
                </span>
                <span>
                  {h.count}× · último {formatShort(h.lastNoteAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted }}>Filtrar:</span>
        <button
          type="button"
          className={`pp-btn pp-btn--sm ${kindFilter === "all" ? "pp-btn--primary" : "pp-btn--ghost"}`}
          onClick={() => setKindFilter("all")}
        >
          Todas
        </button>
        {STUDENT_NOTE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={`pp-btn pp-btn--sm ${kindFilter === k ? "pp-btn--primary" : "pp-btn--ghost"}`}
            onClick={() => setKindFilter(k)}
          >
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          type="button"
          className="pp-btn pp-btn--primary pp-btn--sm"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Fechar formulário" : "Adicionar nota"}
        </button>
      </div>

      {showForm ? (
        <form className="pp-surface" onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 650 }}>Nova observação técnica</div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Exercício</span>
            <input
              className="pp-input"
              list="common-exercises-tech"
              value={exerciseName}
              onChange={(e) => {
                setExerciseName(e.target.value);
                setExerciseKey(null);
              }}
              placeholder="Nome do exercício"
              required
            />
            <datalist id="common-exercises-tech">
              {COMMON_EXERCISES.map((ex) => (
                <option key={ex.id} value={ex.name} />
              ))}
            </datalist>
          </label>
          <div style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Buscar na biblioteca de vídeos</span>
            <input
              className="pp-input"
              value={videoQuery}
              onChange={(e) => setVideoQuery(e.target.value)}
              placeholder="Digite 2+ caracteres…"
            />
            {videoLoading ? <span style={{ fontSize: 12, color: COLORS.muted }}>Buscando…</span> : null}
            {videoHits.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {videoHits.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="pp-btn pp-btn--ghost pp-btn--sm"
                    onClick={() => pickExercise(`v-${v.id}`, v.title)}
                  >
                    {v.title}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Tipo</span>
            <select className="pp-select" value={kind} onChange={(e) => setKind(e.target.value as StudentNoteKind)}>
              {STUDENT_NOTE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          {kind === "pain" ? (
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Severidade (1–5)</span>
              <input
                className="pp-input"
                inputMode="numeric"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                placeholder="ex: 3"
              />
            </label>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Carga (kg)</span>
              <input className="pp-input" value={loadKg} onChange={(e) => setLoadKg(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Séries</span>
              <input className="pp-input" value={sets} onChange={(e) => setSets(e.target.value)} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, color: COLORS.muted }}>Reps</span>
              <input className="pp-input" value={reps} onChange={(e) => setReps(e.target.value)} />
            </label>
          </div>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Observação</span>
            <textarea
              className="pp-input"
              rows={4}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              required
              placeholder="Erro comum, compensação, amplitude, respiração…"
            />
          </label>
          <button type="submit" className="pp-btn pp-btn--primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar nota"}
          </button>
        </form>
      ) : null}

      {error ? (
        <div className="pp-error-state" style={{ fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando histórico…</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {notes.length === 0 ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Nenhuma nota neste filtro ainda.</div>
          ) : null}
          {notes.map((n) => (
            <div key={n.id} className="pp-surface" style={{ fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 650, color: COLORS.text }}>
                  {n.exerciseName}{" "}
                  <span className="pp-badge pp-badge--soft">{KIND_LABEL[n.kind] ?? n.kind}</span>
                </div>
                <span style={{ color: COLORS.muted }}>{formatShort(n.recordedAt)}</span>
              </div>
              <div style={{ marginTop: 8, color: COLORS.text, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                {n.note}
              </div>
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8, color: COLORS.muted }}>
                {n.loadKg != null ? <span>Carga {n.loadKg} kg</span> : null}
                {n.sets ? <span>Séries {n.sets}</span> : null}
                {n.reps ? <span>Reps {n.reps}</span> : null}
                {n.severity != null ? <span>Severidade {n.severity}</span> : null}
              </div>
              {myId != null && n.personalId === myId ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="pp-btn pp-btn--ghost pp-btn--sm"
                    onClick={() => void handleDelete(n.id)}
                  >
                    Excluir
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Meus Exercícios" — 3ª aba de Programas (D13 do harness da Sprint P1).
 *
 * Gestão da biblioteca personalizada do personal: criar, editar, arquivar e
 * restaurar. Nunca DELETE físico — arquivar é reversível e não mexe em
 * ficha/histórico existente (D10 do harness: status só filtra busca, nunca
 * resolução por id direto).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { SkeletonStudentList } from "../../../components/feedback/Skeleton";
import type { ExerciseSummary } from "../../../services/exercisesApi";
import {
  archiveMyExercise,
  DuplicateExerciseNameError,
  listMyExercises,
  restoreMyExercise,
  type PersonalExerciseStatusFilter,
} from "../../../services/personalExercisesApi";
import { trackPersonalExerciseEvent } from "./personalExerciseEvents";
import { PersonalExerciseFormModal } from "./PersonalExerciseFormModal";
import "../personalPremium.css";
import "./personalExercises.css";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_TABS: { id: PersonalExerciseStatusFilter; label: string }[] = [
  { id: "active", label: "Ativos" },
  { id: "archived", label: "Arquivados" },
  { id: "all", label: "Todos" },
];

export default function PersonalExerciseLibraryPage() {
  const [statusFilter, setStatusFilter] = useState<PersonalExerciseStatusFilter>("active");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [items, setItems] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formTarget, setFormTarget] = useState<"create" | string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseSummary | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await listMyExercises({ q: debouncedQuery || undefined, status: statusFilter, limit: 200 });
      if (requestId.current !== id) return;
      setItems(rows);
    } catch (e) {
      if (requestId.current !== id) return;
      setItems([]);
      setError(e instanceof Error ? e.message : "Não foi possível carregar seus exercícios.");
    } finally {
      if (requestId.current === id) setLoading(false);
    }
  }, [debouncedQuery, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSaved() {
    setActionError(null);
    void load();
  }

  async function confirmArchive() {
    const target = archiveTarget;
    setArchiveTarget(null);
    if (!target) return;
    setActionError(null);
    try {
      await archiveMyExercise(target.id);
      trackPersonalExerciseEvent("personal_custom_exercise_archived");
      void load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Não foi possível arquivar o exercício.");
    }
  }

  async function handleRestore(target: ExerciseSummary) {
    setActionError(null);
    try {
      await restoreMyExercise(target.id);
      void load();
    } catch (e) {
      if (e instanceof DuplicateExerciseNameError) {
        setActionError(
          `Já existe um exercício ativo chamado "${target.name}" na sua biblioteca. Renomeie um dos dois antes de restaurar.`,
        );
      } else {
        setActionError(e instanceof Error ? e.message : "Não foi possível restaurar o exercício.");
      }
    }
  }

  const hasAnyFilter = debouncedQuery.length > 0 || statusFilter !== "active";

  return (
    <div className="pp-page" style={{ maxWidth: 860 }}>
      <div className="pxl-toolbar">
        <div>
          <div className="pp-kicker">Biblioteca</div>
          <div className="pp-drawer-title" style={{ fontSize: 20 }}>Meus Exercícios</div>
        </div>
        <button type="button" className="pp-btn pp-btn--primary" onClick={() => setFormTarget("create")}>
          <Plus size={16} aria-hidden="true" />
          <span style={{ marginLeft: 6 }}>Criar exercício</span>
        </button>
      </div>

      <div className="pxl-filters">
        <input
          className="input pxl-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar nos meus exercícios…"
          aria-label="Buscar nos meus exercícios"
        />
        <div className="pxl-status-chips" role="group" aria-label="Filtrar por status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className="pxl-status-chip"
              aria-pressed={statusFilter === tab.id}
              onClick={() => setStatusFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionError ? (
        <div className="alert alert-danger" role="alert">
          <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {loading ? (
        <SkeletonStudentList rows={4} label="Carregando exercícios" />
      ) : error ? (
        <div className="alert alert-danger" role="alert">
          <AlertTriangle size={16} className="alert-icon" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        hasAnyFilter ? (
          <EmptyState
            variant="info"
            title="Nenhum exercício encontrado"
            description="Ajuste a busca ou o filtro de status."
          />
        ) : (
          <EmptyState
            variant="empty"
            title="Você ainda não criou exercícios personalizados"
            description="Crie exercícios específicos da sua metodologia e utilize-os nas fichas dos seus alunos."
            action={
              <button type="button" className="pp-btn pp-btn--primary" onClick={() => setFormTarget("create")}>
                Criar exercício
              </button>
            }
          />
        )
      ) : (
        <div className="pxl-list">
          {items.map((ex) => (
            <div key={ex.id} className="pp-student-row">
              <div className="pp-student-main">
                <div className="pp-inline">
                  <button type="button" className="pp-name" onClick={() => setFormTarget(ex.id)}>
                    {ex.name}
                  </button>
                  {ex.status === "archived" ? (
                    <span className="pp-pill pp-pill--neutral">Arquivado</span>
                  ) : null}
                </div>
                <div className="pp-meta">
                  {[ex.bodyPart, ex.equipment].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div className="pp-actions">
                <button
                  type="button"
                  className="pp-btn pp-btn--quiet pp-btn--sm"
                  onClick={() => setFormTarget(ex.id)}
                >
                  Editar
                </button>
                {ex.status === "archived" ? (
                  <button
                    type="button"
                    className="pp-btn pp-btn--sm"
                    onClick={() => void handleRestore(ex)}
                  >
                    Restaurar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="pp-btn pp-btn--quiet pp-btn--sm"
                    onClick={() => setArchiveTarget(ex)}
                  >
                    Arquivar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget != null ? (
        <PersonalExerciseFormModal
          exerciseId={formTarget === "create" ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <ConfirmDialog
        open={archiveTarget != null}
        title={archiveTarget ? `Arquivar "${archiveTarget.name}"?` : "Arquivar exercício?"}
        message="Este exercício deixará de aparecer para novas fichas. Treinos e históricos existentes não serão alterados."
        confirmLabel="Arquivar"
        cancelLabel="Cancelar"
        onConfirm={() => void confirmArchive()}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

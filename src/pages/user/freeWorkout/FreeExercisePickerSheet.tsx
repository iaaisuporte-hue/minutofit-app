import { useCallback, useEffect, useRef, useState } from "react";
import { searchExercises, type ExerciseSummary } from "../../../services/exercisesApi";
import { FREE_WORKOUT_GROUPS } from "../../../features/training/freeWorkout/catalogGroups";
import "./freeWorkout.css";

// Seletor de exercícios do treino livre. Bottom sheet porque o aluno monta o
// treino de pé, com uma mão: o conteúdo interativo fica na metade de baixo da
// tela. A folha NÃO fecha ao adicionar — montar um treino é escolher cinco ou
// seis exercícios seguidos, e reabrir a cada um custaria dois toques por
// exercício. Quem terminou fecha explicitamente.

const RESULT_LIMIT = 60;
const SEARCH_DEBOUNCE_MS = 300;
const JUST_ADDED_MS = 1400;

export interface PickedExercise {
  id: string;
  name: string;
  bodyPart: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (exercise: PickedExercise) => void;
  /** Ids já montados — evita duplicar e mostra o que já entrou. */
  selectedIds: Set<string>;
}

export function FreeExercisePickerSheet({ open, onClose, onAdd, selectedIds }: Props) {
  const [bodyPart, setBodyPart] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<ExerciseSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const requestId = useRef(0);
  const justAddedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    // `requestId` descarta resposta atrasada: trocar de chip rápido fazia a
    // lista do grupo anterior chegar depois e sobrescrever a atual.
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await searchExercises({
          bodyPart: bodyPart ?? undefined,
          q: debouncedQuery || undefined,
          limit: RESULT_LIMIT,
        });
        if (requestId.current !== id) return;
        setResults(list);
      } catch (err: unknown) {
        if (requestId.current !== id) return;
        setResults([]);
        setError(err instanceof Error ? err.message : "Não foi possível carregar os exercícios.");
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    };
    void load();
  }, [open, bodyPart, debouncedQuery, reloadTick]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => () => {
    if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
  }, []);

  const handleAdd = useCallback(
    (exercise: ExerciseSummary) => {
      onAdd({ id: exercise.id, name: exercise.name, bodyPart: exercise.bodyPart ?? null });
      setJustAddedId(exercise.id);
      if (justAddedTimer.current) clearTimeout(justAddedTimer.current);
      justAddedTimer.current = setTimeout(() => setJustAddedId(null), JUST_ADDED_MS);
    },
    [onAdd],
  );

  if (!open) return null;

  const selectedCount = selectedIds.size;
  const groupLabel = bodyPart
    ? FREE_WORKOUT_GROUPS.find((group) => group.bodyPart === bodyPart)?.label ?? bodyPart
    : null;

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fw-picker-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="drawer-panel fw-sheet">
        <div className="fw-sheet-head">
          <div>
            <h2 id="fw-picker-title" className="fw-sheet-title">Adicionar exercício</h2>
            <div className="fw-sheet-count">
              {selectedCount === 0
                ? "Toque para incluir no treino."
                : `${selectedCount} ${selectedCount === 1 ? "exercício no treino" : "exercícios no treino"}`}
            </div>
          </div>
          <button type="button" className="fw-sheet-close" onClick={onClose} aria-label="Fechar seleção">
            ✕
          </button>
        </div>

        <div className="fw-chips" role="group" aria-label="Filtrar por grupo muscular">
          <button
            type="button"
            className="fw-chip"
            aria-pressed={bodyPart === null}
            onClick={() => setBodyPart(null)}
          >
            Todos
          </button>
          {FREE_WORKOUT_GROUPS.map((group) => (
            <button
              key={group.bodyPart}
              type="button"
              className="fw-chip"
              aria-pressed={bodyPart === group.bodyPart}
              onClick={() => setBodyPart(bodyPart === group.bodyPart ? null : group.bodyPart)}
            >
              {group.label}
            </button>
          ))}
        </div>

        <input
          className="input fw-sheet-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar exercício…"
          aria-label="Buscar exercício"
        />

        {/* Enquanto o novo filtro carrega, a lista anterior fica visível porém
            apagada — trocar de chip não pode dar a impressão de que o grupo
            recém-escolhido é que está vazio. */}
        <div
          className={`fw-results${loading && results.length > 0 ? " fw-results--loading" : ""}`}
          aria-busy={loading}
        >
          {loading && results.length === 0 ? (
            <div className="fw-sheet-status">Carregando exercícios…</div>
          ) : error ? (
            <div className="fw-sheet-status">
              <div className="fw-error">{error}</div>
              <button
                type="button"
                className="btn btn-ghost fw-sheet-action"
                onClick={() => setReloadTick((tick) => tick + 1)}
              >
                Tentar novamente
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="fw-sheet-status">
              {/* Busca vazia COM chip ligado era beco sem saída: "supino" dentro
                  de Costas não acha nada, e o aluno concluía que o exercício não
                  existe no app — existem dez. O vazio diz onde procurou e o
                  botão tira o filtro sem perder o que ele já digitou. */}
              {debouncedQuery && groupLabel
                ? `Nenhum exercício de ${groupLabel} encontrado para "${debouncedQuery}".`
                : debouncedQuery
                  ? `Nenhum exercício encontrado para "${debouncedQuery}".`
                  : "Nenhum exercício neste grupo."}
              {groupLabel ? (
                <button
                  type="button"
                  className="btn btn-ghost fw-sheet-action"
                  onClick={() => setBodyPart(null)}
                >
                  {debouncedQuery ? "Buscar em todos os grupos" : "Ver todos os grupos"}
                </button>
              ) : null}
            </div>
          ) : (
            results.map((exercise) => {
              const already = selectedIds.has(exercise.id);
              const justAdded = justAddedId === exercise.id;
              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={`fw-result${justAdded ? " fw-result--just-added" : ""}`}
                  disabled={already}
                  onClick={() => handleAdd(exercise)}
                >
                  <span className="fw-thumb">
                    {exercise.primaryMediaUrl ? (
                      <img
                        src={exercise.primaryMediaUrl}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="fw-result-body">
                    <span className="fw-result-name">{exercise.name}</span>
                    <span className="fw-result-meta">
                      {[exercise.bodyPart, exercise.equipment].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {already ? (
                    <span className="fw-result-state">{justAdded ? "Adicionado ✓" : "No treino"}</span>
                  ) : (
                    <span className="fw-result-add" aria-hidden="true">＋</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default FreeExercisePickerSheet;

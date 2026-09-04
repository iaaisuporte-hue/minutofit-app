import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FreeExercisePickerSheet, type PickedExercise } from "./FreeExercisePickerSheet";
import {
  addExercise,
  buildFreeDraftExercises,
  isFull,
  moveExercise,
  removeAt,
  stepReps,
  stepRest,
  stepSets,
  MAX_EXERCISES,
  MAX_REPS,
  MAX_REST_S,
  MAX_SETS,
  MIN_REPS,
  MIN_REST_S,
  MIN_SETS,
  REST_STEP_S,
  type FreeWorkoutItem,
} from "./freeSessionOps";
import {
  clearFreeDraft,
  loadFreeDraft,
  newClientKey,
  saveFreeDraft,
  type FreeSessionDraft,
} from "../workoutSession/sessionDraft";
import { cancelarLembretesTreino } from "../workoutSession/pendingWorkoutReminder";
import { clearFreeSetupDraft, loadFreeSetupDraft, saveFreeSetupDraft } from "./freeSetupDraft";
import { describeTitleGroupsPt } from "../../../features/training/freeWorkout/muscleGroupMap";
import "./freeWorkout.css";

// Montagem do treino livre. A fricção é o produto aqui: entrar, tocar num
// grupo, tocar nos exercícios e começar. Nada de nome, objetivo ou duração —
// quem está na academia com o fone no ouvido não preenche formulário, e todos
// esses campos são deriváveis do que foi escolhido e do que foi executado.

const SESSION_ROUTE = "/app/user/treino-livre/sessao";

function formatStartedAt(startedAt: number): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
      new Date(startedAt),
    );
  } catch {
    return "";
  }
}

export default function FreeWorkoutSetupPage() {
  const navigate = useNavigate();

  // Lido uma vez: o rascunho só muda por ação nesta tela (descartar) ou dentro
  // da sessão, que é outra rota.
  const [draft, setDraft] = useState<FreeSessionDraft | null>(() => loadFreeDraft());
  // A montagem sobrevive a recarregar a tela e a perder a aba (PWA no Android):
  // escolher oito exercícios é trabalho, e antes disso um F5 apagava tudo.
  const [items, setItems] = useState<FreeWorkoutItem[]>(() => loadFreeSetupDraft());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const selectedIds = useMemo(() => new Set(items.map((item) => item.exerciseId)), [items]);
  const titleGroups = useMemo(() => describeTitleGroupsPt(items), [items]);
  const full = isFull(items);

  // Grava a cada mudança da lista, e não ao sair: `beforeunload`/`pagehide` não
  // dispara de forma confiável quando o sistema mata o app em segundo plano.
  // Lista vazia limpa a chave — ver `saveFreeSetupDraft`.
  useEffect(() => {
    saveFreeSetupDraft(items);
  }, [items]);

  function handleAdd(exercise: PickedExercise) {
    const next = addExercise(items, exercise);
    setItems(next);
    // No teto a folha fecha sozinha: seguir com ela aberta faria o próximo toque
    // não produzir nada, sem o aluno entender por quê. Fechada, ele lê o aviso.
    if (isFull(next)) setPickerOpen(false);
  }

  function handleDiscard() {
    clearFreeDraft();
    // Descartar aqui é o mesmo que encerrar o treino: sem isto o lembrete ainda
    // tocaria horas depois apontando para uma sessão que não existe mais.
    void cancelarLembretesTreino();
    setDraft(null);
    setConfirmingDiscard(false);
  }

  function handleStart() {
    if (!items.length || draft) return;
    const fresh: FreeSessionDraft = {
      version: 1,
      mode: "free",
      startedAt: Date.now(),
      currentIndex: 0,
      exercises: buildFreeDraftExercises(items),
      restEndsAt: null,
      restForKey: null,
      // Nasce aqui e acompanha o treino até o POST: refresh no meio da sessão
      // não pode virar uma segunda sessão no histórico.
      clientKey: newClientKey(),
    };
    saveFreeDraft(fresh);
    // A montagem virou sessão: manter as duas chaves faria a próxima visita à
    // tela remontar uma lista que já está em execução ao lado.
    clearFreeSetupDraft();
    navigate(SESSION_ROUTE);
  }

  return (
    <div className="fw-page">
      <div className="fw-head">
        <button type="button" className="btn btn-ghost fw-back" onClick={() => navigate(-1)}>
          ← Voltar
        </button>
        <h1 className="fw-title">Treino livre</h1>
        <p className="fw-sub">
          Escolha os exercícios que você vai fazer agora. Séries, repetições e descanso já vêm
          preenchidos — ajuste só o que precisar.
        </p>
      </div>

      {draft && (
        <div className="fw-card fw-card--resume">
          <div className="fw-card-title">Treino livre em andamento</div>
          <div className="fw-card-text">
            {draft.exercises.length}{" "}
            {draft.exercises.length === 1 ? "exercício" : "exercícios"}
            {formatStartedAt(draft.startedAt) ? `, iniciado às ${formatStartedAt(draft.startedAt)}` : ""}.
            Só é possível ter um treino livre aberto por vez.
          </div>
          {confirmingDiscard ? (
            <>
              <div className="fw-card-text">
                Descartar apaga as séries já marcadas neste treino. Não dá para desfazer.
              </div>
              <div className="fw-card-actions">
                <button type="button" className="btn btn-danger" onClick={handleDiscard}>
                  Sim, descartar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmingDiscard(false)}
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <div className="fw-card-actions">
              <button type="button" className="btn btn-primary" onClick={() => navigate(SESSION_ROUTE)}>
                Retomar
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmingDiscard(true)}
              >
                Descartar e começar novo
              </button>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="fw-empty">
          <div>Nenhum exercício escolhido ainda.</div>
          <div>Comece pelo grupo que você vai treinar hoje.</div>
        </div>
      ) : (
        <div className="fw-list">
          {items.map((item, index) => (
            <div className="fw-item" key={item.exerciseId}>
              <div className="fw-item-head">
                <span className="fw-item-order" aria-hidden="true">{index + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="fw-item-name">{item.name}</div>
                  {item.bodyPart && <div className="fw-item-group">{item.bodyPart}</div>}
                </div>
              </div>

              <div className="fw-steppers">
                <div className="fw-stepper">
                  <span className="fw-stepper-label">Séries</span>
                  <div className="fw-stepper-row">
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={item.sets <= MIN_SETS}
                      onClick={() => setItems((current) => stepSets(current, index, -1))}
                      aria-label={`Menos uma série em ${item.name}`}
                    >
                      −
                    </button>
                    <span className="fw-step-value">
                      {item.sets}
                    </span>
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={item.sets >= MAX_SETS}
                      onClick={() => setItems((current) => stepSets(current, index, 1))}
                      aria-label={`Mais uma série em ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="fw-stepper">
                  <span className="fw-stepper-label">Reps</span>
                  <div className="fw-stepper-row">
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={Number(item.reps) <= MIN_REPS}
                      onClick={() => setItems((current) => stepReps(current, index, -1))}
                      aria-label={`Menos uma repetição em ${item.name}`}
                    >
                      −
                    </button>
                    <span className="fw-step-value">
                      {item.reps}
                    </span>
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={Number(item.reps) >= MAX_REPS}
                      onClick={() => setItems((current) => stepReps(current, index, 1))}
                      aria-label={`Mais uma repetição em ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="fw-stepper">
                  <span className="fw-stepper-label">Descanso</span>
                  <div className="fw-stepper-row">
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={item.restS <= MIN_REST_S}
                      onClick={() => setItems((current) => stepRest(current, index, -REST_STEP_S))}
                      aria-label={`Menos descanso em ${item.name}`}
                    >
                      −
                    </button>
                    <span className="fw-step-value">
                      {item.restS}s
                    </span>
                    <button
                      type="button"
                      className="fw-step-btn"
                      disabled={item.restS >= MAX_REST_S}
                      onClick={() => setItems((current) => stepRest(current, index, REST_STEP_S))}
                      aria-label={`Mais descanso em ${item.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Setas em vez de arrastar: drag-and-drop HTML5 não dispara em touch. */}
              <div className="fw-item-tools">
                <button
                  type="button"
                  className="fw-tool-btn"
                  disabled={index === 0}
                  onClick={() => setItems((current) => moveExercise(current, index, -1))}
                  aria-label={`Mover ${item.name} para cima`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="fw-tool-btn"
                  disabled={index === items.length - 1}
                  onClick={() => setItems((current) => moveExercise(current, index, 1))}
                  aria-label={`Mover ${item.name} para baixo`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="fw-tool-btn fw-tool-btn--danger"
                  onClick={() => setItems((current) => removeAt(current, index))}
                  aria-label={`Remover ${item.name} do treino`}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {full && (
        <div className="fw-note">
          Você chegou ao limite de {MAX_EXERCISES} exercícios por treino. Remova algum para trocar.
        </div>
      )}

      <button
        type="button"
        className="btn fw-add-btn"
        onClick={() => setPickerOpen(true)}
        disabled={full}
      >
        + Adicionar exercício
      </button>

      <div className="fw-cta-bar">
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={handleStart}
          disabled={!items.length || !!draft}
        >
          Começar treino
        </button>
        {draft ? (
          <div className="fw-cta-hint">
            Retome ou descarte o treino em andamento para começar outro.
          </div>
        ) : items.length ? (
          <div className="fw-cta-hint">
            {items.length} {items.length === 1 ? "exercício" : "exercícios"}
            {titleGroups ? ` · ${titleGroups}` : ""}
          </div>
        ) : (
          <div className="fw-cta-hint">Adicione ao menos um exercício.</div>
        )}
      </div>

      <FreeExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={handleAdd}
        selectedIds={selectedIds}
      />
    </div>
  );
}

import { useState } from "react";
import { FreeExercisePickerSheet, type PickedExercise } from "./FreeExercisePickerSheet";
import { MAX_EXERCISES } from "./freeSessionOps";
import { countDoneSets, hasRecordedWork } from "./liveSessionOps";
import type { DraftExercise } from "../workoutSession/sessionDraft";
import "./freeWorkout.css";

// Gestão da lista com o treino livre já em andamento. Existe porque o treino
// real muda no meio: o banco está ocupado, o ombro reclamou, sobrou tempo para
// mais um. Sem isto o aluno teria que finalizar e abrir outra sessão — e o
// histórico ficaria com dois treinos onde houve um.
//
// Só edita a ordem e a composição. Séries, carga e descanso continuam sendo
// mexidos na tela do exercício, que é onde ele está olhando enquanto treina.

interface Props {
  exercises: DraftExercise[];
  /** Exercício em execução — marcado na lista para orientar quem está no meio da sessão. */
  currentIndex: number;
  onClose: () => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: (exercise: PickedExercise) => void;
}

export function LiveExerciseSheet({ exercises, currentIndex, onClose, onMove, onRemove, onAdd }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const full = exercises.length >= MAX_EXERCISES;
  const onlyOne = exercises.length <= 1;
  const selectedIds = new Set(
    exercises.map((ex) => ex.exerciseId).filter((id): id is string => !!id),
  );

  function requestRemove(index: number) {
    // Sem nada registrado, confirmar seria fricção pura: não há o que perder.
    if (hasRecordedWork(exercises[index])) setConfirmIndex(index);
    else onRemove(index);
  }

  function confirmRemove(index: number) {
    setConfirmIndex(null);
    onRemove(index);
  }

  return (
    <>
      <div
        className="drawer-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fw-manage-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="drawer-panel fw-manage">
          <div className="fw-sheet-head">
            <div>
              <h2 id="fw-manage-title" className="fw-sheet-title">Exercícios do treino</h2>
              <div className="fw-sheet-count">
                Reordene, remova ou inclua sem sair do treino.
              </div>
            </div>
            <button type="button" className="fw-sheet-close" onClick={onClose} aria-label="Fechar lista">
              ✕
            </button>
          </div>

          <div className="fw-manage-list">
            {exercises.map((exercise, index) => {
              const done = countDoneSets(exercise);
              const confirming = confirmIndex === index;
              return (
                <div className="fw-item" key={`${exercise.exerciseId ?? exercise.name}-${index}`}>
                  <div className="fw-item-head">
                    <span className="fw-item-order" aria-hidden="true">{index + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="fw-item-name">{exercise.name}</div>
                      <div className="fw-item-group">
                        {done > 0
                          ? `${done} de ${exercise.sets.length} ${exercise.sets.length === 1 ? "série feita" : "séries feitas"}`
                          : `${exercise.sets.length} ${exercise.sets.length === 1 ? "série" : "séries"}`}
                        {index === currentIndex ? " · em andamento" : ""}
                      </div>
                    </div>
                  </div>

                  {confirming ? (
                    <>
                      <div className="fw-card-text">
                        {done > 0
                          ? `${done === 1 ? "A série feita" : `As ${done} séries feitas`} de ${exercise.name} ${done === 1 ? "será descartada" : "serão descartadas"}. Não dá para desfazer.`
                          : `A carga que você anotou em ${exercise.name} será descartada. Não dá para desfazer.`}
                      </div>
                      <div className="fw-card-actions">
                        <button type="button" className="btn btn-danger" onClick={() => confirmRemove(index)}>
                          Sim, remover
                        </button>
                        <button type="button" className="btn btn-ghost" onClick={() => setConfirmIndex(null)}>
                          Cancelar
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="fw-item-tools">
                      <button
                        type="button"
                        className="fw-tool-btn"
                        disabled={index === 0}
                        onClick={() => onMove(index, -1)}
                        aria-label={`Mover ${exercise.name} para cima`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="fw-tool-btn"
                        disabled={index === exercises.length - 1}
                        onClick={() => onMove(index, 1)}
                        aria-label={`Mover ${exercise.name} para baixo`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="fw-tool-btn fw-tool-btn--danger"
                        disabled={onlyOne}
                        onClick={() => requestRemove(index)}
                        aria-label={`Remover ${exercise.name} do treino`}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            {onlyOne ? (
              <div className="fw-card-text">
                Este é o único exercício do treino. Para encerrar, use Sair do treino.
              </div>
            ) : null}
            {full ? (
              <div className="fw-note">
                Você chegou ao limite de {MAX_EXERCISES} exercícios por treino.
              </div>
            ) : null}
            <button
              type="button"
              className="btn fw-add-btn"
              onClick={() => setPickerOpen(true)}
              disabled={full}
            >
              + Adicionar exercício
            </button>
          </div>
        </div>
      </div>

      {/* Depois do painel no DOM de propósito: as duas folhas usam a mesma
          camada, e é a ordem que coloca o seletor por cima. */}
      <FreeExercisePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={onAdd}
        selectedIds={selectedIds}
      />
    </>
  );
}

export default LiveExerciseSheet;

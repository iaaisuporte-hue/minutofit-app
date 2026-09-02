import { useCallback } from "react";
import {
  cargaInicial,
  passoCarga,
  passoReps,
  repsIniciais,
  type PASSOS_CARGA,
} from "./setSteppers";
import type { DraftSetEntry } from "./sessionDraft";

/** Um passo de carga oferecido na barra. */
type PassoCarga = (typeof PASSOS_CARGA)[number];

interface Props {
  /** Série que a barra opera — a primeira não concluída do exercício. */
  set: DraftSetEntry | null;
  /** Posição da série no exercício, para "Série 2 de 4". */
  posicao: number;
  totalNoExercicio: number;
  /** Carga da série imediatamente anterior DESTE treino (referência do stepper). */
  cargaSerieAnterior: string | null;
  repsSerieAnterior: string | null;
  /** Última carga conhecida do exercício em treinos passados (§8). */
  ultimaCarga: number | null;
  /** Repetições da última execução conhecida, quando houver (§8). */
  ultimasReps: string | null;
  /** true quando todas as séries do exercício estão feitas. */
  exercicioConcluido: boolean;
  /** Há um próximo exercício para avançar. */
  temProximo: boolean;
  onChange: (setIndex: number, patch: Partial<DraftSetEntry>) => void;
  onConcluir: (setIndex: number) => void;
  onProximo: () => void;
  /** "Pular por agora" (§15) — avança sem concluir nada. Ausente no último. */
  onPular?: () => void;
}

const PASSOS: PassoCarga[] = [2.5, 5];

/**
 * Barra fixa inferior com a série atual (SPEC P1 §5 · §6 · §7 · §10 · §45).
 *
 * Concentra as três ações mais frequentes do treino — ajustar carga, ajustar
 * repetições e concluir a série — na zona do polegar, em posição que não muda
 * entre exercícios. A lista de séries continua acima, no corpo rolável, porque
 * é ela que permite corrigir uma série já registrada; o que saiu de lá foi a
 * necessidade de MIRAR nela a cada série.
 *
 * O botão de concluir não pede confirmação: é reversível (basta desmarcar) e a
 * SPEC §46 é explícita sobre não confirmar ação reversível simples.
 */
export function SetActionBar({
  set,
  posicao,
  totalNoExercicio,
  cargaSerieAnterior,
  repsSerieAnterior,
  ultimaCarga,
  ultimasReps,
  exercicioConcluido,
  temProximo,
  onChange,
  onConcluir,
  onProximo,
  onPular,
}: Props) {
  const ajustarCarga = useCallback(
    (delta: number) => {
      if (!set) return;
      const base = cargaInicial({ atual: set.loadKg, cargaSerieAnterior, ultimaCarga });
      // O primeiro toque em "+" com o campo vazio ASSUME a referência em vez de
      // somar sobre ela: quem tinha 80 kg da última vez quer 80, não 82,5. Só a
      // partir do segundo toque o passo é aplicado.
      const valor = set.loadKg.trim() === "" && base > 0 ? base : base + delta;
      onChange(set.setIndex, { loadKg: passoCarga(valor, 0) });
    },
    [set, cargaSerieAnterior, ultimaCarga, onChange],
  );

  const ajustarReps = useCallback(
    (delta: number) => {
      if (!set) return;
      const base = repsIniciais({
        atual: set.reps,
        prescritas: set.plannedReps,
        repsSerieAnterior,
      });
      const valor = set.reps.trim() === "" && base > 0 ? base : base + delta;
      onChange(set.setIndex, { reps: passoReps(valor, 0) });
    },
    [set, repsSerieAnterior, onChange],
  );

  // Exercício terminado: a mesma posição da tela vira "próximo exercício".
  // Manter o botão no lugar é o ponto do §6 — o polegar não precisa reaprender.
  if (!set || exercicioConcluido) {
    return (
      <div className="ws-action-bar" data-testid="ws-action-bar">
        <div className="ws-ab-head">
          <span className="ws-ab-serie">Exercício concluído</span>
        </div>
        <button
          type="button"
          className="ws-ab-done ws-ab-next"
          onClick={onProximo}
          disabled={!temProximo}
        >
          {temProximo ? "Próximo exercício →" : "Último exercício — finalize abaixo"}
        </button>
      </div>
    );
  }

  const referencia =
    ultimaCarga != null
      ? `Último: ${ultimaCarga} kg${ultimasReps ? ` × ${ultimasReps}` : ""}`
      : null;

  return (
    <div className="ws-action-bar" data-testid="ws-action-bar">
      <div className="ws-ab-head">
        <span className="ws-ab-serie">
          Série {posicao} de {totalNoExercicio}
        </span>
        {referencia ? <span className="ws-ab-prev">{referencia}</span> : null}
        {/*
          "Pular por agora" (§15). O exercício NÃO é dado como concluído: ele
          continua na lista, sem séries marcadas, e o aviso de pendentes na
          finalização (§33) o traz de volta. É a saída para a máquina ocupada
          sem mentir sobre o que foi feito.
        */}
        {onPular ? (
          <button type="button" className="ws-ab-skip" onClick={onPular}>
            Pular por agora
          </button>
        ) : null}
      </div>

      <div className="ws-ab-steppers">
        {/* Carga */}
        <div className="ws-stepper">
          <button
            type="button"
            className="ws-step-btn"
            aria-label={`Diminuir carga em ${PASSOS[0]} kg`}
            onClick={() => ajustarCarga(-PASSOS[0])}
          >
            −
          </button>
          <label className="ws-step-val">
            <input
              className="ws-step-input"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={set.loadKg}
              placeholder={ultimaCarga != null ? String(ultimaCarga) : "0"}
              onChange={(e) => onChange(set.setIndex, { loadKg: e.target.value })}
              aria-label={`Carga da série ${posicao}`}
            />
            <span className="ws-step-unit">kg</span>
          </label>
          <button
            type="button"
            className="ws-step-btn"
            aria-label={`Aumentar carga em ${PASSOS[0]} kg`}
            onClick={() => ajustarCarga(PASSOS[0])}
          >
            +
          </button>
        </div>

        {/* Repetições */}
        <div className="ws-stepper">
          <button
            type="button"
            className="ws-step-btn"
            aria-label="Diminuir uma repetição"
            onClick={() => ajustarReps(-1)}
          >
            −
          </button>
          <label className="ws-step-val">
            <input
              className="ws-step-input"
              type="number"
              inputMode="numeric"
              min={0}
              value={set.reps}
              placeholder={set.plannedReps || "0"}
              onChange={(e) => onChange(set.setIndex, { reps: e.target.value })}
              aria-label={`Repetições da série ${posicao}`}
            />
            <span className="ws-step-unit">reps</span>
          </label>
          <button
            type="button"
            className="ws-step-btn"
            aria-label="Aumentar uma repetição"
            onClick={() => ajustarReps(1)}
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        className="ws-ab-done"
        onClick={() => onConcluir(set.setIndex)}
        aria-label={`Concluir série ${posicao}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        CONCLUIR SÉRIE
      </button>
    </div>
  );
}

import { useEffect, useState } from "react";
import { getExerciseHistory, type ExerciseHistoryEntry } from "../../../services/workoutSessionApi";

interface Props {
  exerciseId: string;
  exerciseName: string;
  onClose: () => void;
}

function dataCurta(iso: string): string {
  // "2026-08-29" → "29/08". Sem `new Date`: a string já vem no dia do aluno
  // (convertida no servidor), e reinterpretar como UTC voltaria um dia.
  const [, mes, dia] = iso.split("-");
  return dia && mes ? `${dia}/${mes}` : iso;
}

/**
 * Histórico rápido do exercício (SPEC P1 §27).
 *
 * Abre SOBRE a sessão, sem tirar ninguém do treino: a pergunta "quanto eu
 * levantei da última vez?" é feita entre duas séries, e mandar a pessoa até a
 * aba de Evolução para responder custa o treino inteiro.
 *
 * Mostra o que o domínio realmente tem — carga máxima, repetições daquela
 * série e quantas séries. Nada é derivado nem projetado: a §9 da SPEC é
 * explícita sobre não inventar algoritmo de sugestão aqui.
 */
export function ExerciseHistorySheet({ exerciseId, exerciseName, onClose }: Props) {
  const [linhas, setLinhas] = useState<ExerciseHistoryEntry[] | null>(null);

  useEffect(() => {
    let vivo = true;
    getExerciseHistory(exerciseId, 3).then((r) => { if (vivo) setLinhas(r); });
    return () => { vivo = false; };
  }, [exerciseId]);

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ehs-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="drawer-panel ehs">
        <div className="ehs__head">
          <div style={{ minWidth: 0 }}>
            <h2 id="ehs-title" className="ehs__title">Últimas sessões</h2>
            <div className="ehs__ex">{exerciseName}</div>
          </div>
          <button type="button" className="ehs__close" onClick={onClose} aria-label="Fechar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {linhas === null ? (
          <div className="ehs__vazio">Carregando…</div>
        ) : linhas.length === 0 ? (
          <div className="ehs__vazio">
            Primeira vez neste exercício por aqui. A partir de hoje ele passa a ter histórico.
          </div>
        ) : (
          <ul className="ehs__lista">
            {linhas.map((l) => (
              <li key={l.date} className="ehs__linha">
                <span className="ehs__data">{dataCurta(l.date)}</span>
                <span className="ehs__valor">
                  {l.loadKg != null ? `${l.loadKg} kg` : "sem carga"}
                  {l.reps != null ? ` × ${l.reps}` : ""}
                </span>
                <span className="ehs__sets">{l.sets} {l.sets === 1 ? "série" : "séries"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

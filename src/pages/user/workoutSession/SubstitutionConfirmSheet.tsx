import { useState } from "react";
import { useDismissable } from "../../../lib/overlayStack";
import "./workoutSession.css";

/**
 * Confirmação da troca de exercício, com motivo OPCIONAL.
 *
 * A pergunta existe porque o motivo é o que transforma "o aluno fez outra coisa"
 * em informação para o personal: banco ocupado é logística da academia, dor é
 * sinal do corpo, preferência é conversa de prescrição. Mas ela nunca pode
 * atrasar quem está treinando — daí os chips (um toque), o "Prefiro não
 * informar" explícito e o confirmar habilitado sem nada selecionado.
 *
 * Mesma folha inferior do seletor de exercícios: o aluno acaba de escolher ali e
 * confirma aqui, e trocar a linguagem visual no meio do fluxo pareceria outra
 * tela.
 */

/** Cap do backend (`substitution_reason` é truncado em 280 no serviço). */
const MAX_REASON = 280;

/** "Prefiro não informar" não é motivo: vira `null`, como não escolher nada. */
const DECLINED = "Prefiro não informar";
const OTHER = "Outro";

const REASONS = [
  "Equipamento ocupado",
  "Equipamento quebrado",
  "Dor ou desconforto",
  "Preferência no momento",
  "Orientação do personal",
  OTHER,
  DECLINED,
];

interface Props {
  open: boolean;
  originalName: string;
  newName: string;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
}

export function SubstitutionConfirmSheet({
  open,
  originalName,
  newName,
  onCancel,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState("");

  useDismissable(onCancel, open);

  if (!open) return null;

  function confirm() {
    if (selected === OTHER) {
      const texto = other.trim().slice(0, MAX_REASON);
      onConfirm(texto || null);
      return;
    }
    onConfirm(selected && selected !== DECLINED ? selected : null);
  }

  return (
    <div
      className="drawer-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ws-sub-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="drawer-panel ws-sub-sheet">
        <h2 id="ws-sub-title" className="ws-sub-title">
          Substituir {originalName} por {newName}?
        </h2>
        <div className="ws-sub-text">
          As séries planejadas continuam as mesmas — você ajusta carga e reps durante o treino.
        </div>

        <div className="ws-sub-reasons" role="group" aria-label="Motivo da troca (opcional)">
          {REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              className="ws-sub-chip"
              aria-pressed={selected === reason}
              onClick={() => setSelected(selected === reason ? null : reason)}
            >
              {reason}
            </button>
          ))}
        </div>

        {selected === OTHER ? (
          <input
            className="input ws-sub-input"
            type="text"
            value={other}
            maxLength={MAX_REASON}
            onChange={(event) => setOther(event.target.value)}
            placeholder="O que aconteceu?"
            aria-label="Motivo da troca"
          />
        ) : null}

        <div className="ws-sub-actions">
          <button type="button" className="btn btn-primary ws-sub-btn" onClick={confirm}>
            Substituir
          </button>
          <button type="button" className="btn btn-ghost ws-sub-btn" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubstitutionConfirmSheet;

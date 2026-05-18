import type { WorkoutProtocol } from "../../../services/workoutProtocolsApi";
import { WbButton } from "../workoutBuilder/WorkoutBuilderUi";
import { useProtocolUsages } from "./useProtocolUsages";
import "./workoutLibrary.css";

type Props = {
  protocol: WorkoutProtocol | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProtocolUsageDrawer({ protocol, open, onClose, onChanged }: Props) {
  const { students, loading, error, remove } = useProtocolUsages(protocol?.id ?? null, open);
  if (!open || !protocol) return null;

  async function handleRemove(planId: number, studentName: string) {
    if (!window.confirm(`Remover a ficha de ${studentName}? O protocolo continua na biblioteca.`)) return;
    await remove(planId);
    onChanged?.();
  }

  return (
    <div className="protocolDrawerOverlay" role="presentation" onMouseDown={onClose}>
      <aside className="protocolDrawer" role="dialog" aria-modal="true" aria-label="Alunos usando protocolo" onMouseDown={(e) => e.stopPropagation()}>
        <div className="protocolDrawer__header">
          <div>
            <div className="pp-kicker">Uso do protocolo</div>
            <h2>{protocol.title}</h2>
          </div>
          <WbButton variant="ghost" type="button" onClick={onClose}>Fechar</WbButton>
        </div>

        {loading ? <div className="protocolDrawer__empty">Carregando alunos vinculados...</div> : null}
        {error ? <div className="protocolDrawer__error">{error}</div> : null}
        {!loading && !error && students.length === 0 ? (
          <div className="protocolDrawer__empty">
            Este protocolo ainda não está atribuído. Quando uma ficha partir dele, o aluno aparece aqui.
          </div>
        ) : null}

        <div className="protocolDrawer__list">
          {students.map((student) => (
            <div className="protocolDrawer__row" key={student.id}>
              <div>
                <strong>{student.studentName}</strong>
                <span>{student.studentEmail}</span>
                <small>Atribuído em {formatDate(student.createdAt)}</small>
              </div>
              <WbButton variant="ghost" type="button" onClick={() => void handleRemove(student.id, student.studentName)}>
                Remover ficha
              </WbButton>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  CalendarClock,
  Dumbbell,
  RotateCcw,
  StickyNote,
  MoreHorizontal,
} from "lucide-react";
import { createRelationshipAction } from "../../services/personalRetentionApi";
import { QuickMessageModal } from "./QuickMessageModal";
import { ObservationModal } from "./ObservationModal";

type Props = {
  studentId: string;
  studentName: string;
  onActionDone?: () => void;
};

type ActiveModal = "message" | "observation" | "light_workout" | "gradual_return" | null;

export function QuickActionsMenu({ studentId, studentName, onActionDone }: Props) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function quickAction(type: "follow_up_marked" | "light_workout_offered" | "gradual_return_offered") {
    setOpen(false);
    try {
      const dueAt =
        type === "follow_up_marked"
          ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
          : undefined;
      await createRelationshipAction(studentId, { actionType: type, dueAt });
      onActionDone?.();
    } catch {
      // noop
    }
  }

  return (
    <>
      <div className="pp-quick-actions-popover" ref={ref}>
        <button
          className="pp-risk-action-btn"
          onClick={() => setOpen((p) => !p)}
          title="Ações rápidas"
        >
          <MoreHorizontal size={14} />
        </button>

        {open && (
          <div className="pp-quick-actions-menu">
            <button
              className="pp-quick-actions-item"
              onClick={() => { setOpen(false); setModal("message"); }}
            >
              <MessageSquare size={14} /> Enviar mensagem
            </button>
            <button
              className="pp-quick-actions-item"
              onClick={() => quickAction("follow_up_marked")}
            >
              <CalendarClock size={14} /> Marcar acompanhamento
            </button>
            <button
              className="pp-quick-actions-item"
              onClick={() => quickAction("light_workout_offered")}
            >
              <Dumbbell size={14} /> Oferecer treino leve
            </button>
            <button
              className="pp-quick-actions-item"
              onClick={() => quickAction("gradual_return_offered")}
            >
              <RotateCcw size={14} /> Oferecer retorno gradual
            </button>
            <button
              className="pp-quick-actions-item"
              onClick={() => { setOpen(false); setModal("observation"); }}
            >
              <StickyNote size={14} /> Registrar observação
            </button>
          </div>
        )}
      </div>

      {modal === "message" && (
        <QuickMessageModal
          studentId={studentId}
          studentName={studentName}
          onClose={() => setModal(null)}
          onSent={onActionDone}
        />
      )}

      {modal === "observation" && (
        <ObservationModal
          studentId={studentId}
          studentName={studentName}
          actionType="observation"
          title="Registrar observação"
          onClose={() => setModal(null)}
          onSaved={onActionDone}
        />
      )}
    </>
  );
}

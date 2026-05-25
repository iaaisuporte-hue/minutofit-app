import { useEffect, useState } from "react";
import { MoreHorizontal, X, Users, BookMarked } from "lucide-react";
import { DrawerShell } from "../../components/overlay/DrawerShell";
import {
  createPersonalWorkoutPlan,
  type PersonalWorkoutPlanRow,
} from "../../services/personalWorkoutApi";
import { createWorkoutProtocol } from "../../services/workoutProtocolsApi";
import {
  fetchPersonalDashboard,
  type PersonalDashboardStudent,
} from "../../services/personalDashboardApi";

type Props = {
  plan: PersonalWorkoutPlanRow;
  /** ID do aluno atual — escondido na lista de destino do "duplicar para outro aluno". */
  currentStudentId: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
};

type View = "menu" | "students";

export function DuplicatePlanMenu({ plan, currentStudentId, onSuccess, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [students, setStudents] = useState<PersonalDashboardStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [savingToStudentId, setSavingToStudentId] = useState<string | null>(null);
  const [savingAsProtocol, setSavingAsProtocol] = useState(false);

  useEffect(() => {
    if (view !== "students" || students.length > 0) return;
    let cancelled = false;
    setStudentsLoading(true);
    void (async () => {
      try {
        const dash = await fetchPersonalDashboard();
        if (cancelled) return;
        setStudents(dash?.students ?? []);
      } catch {
        if (!cancelled) setStudents([]);
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, students.length]);

  function close() {
    setOpen(false);
    setView("menu");
  }

  function planDaysOrFallback() {
    if (plan.days?.length > 0) {
      return plan.days.map((d) => ({ name: d.name, focus: d.focus, items: d.items }));
    }
    return [
      {
        name: plan.selected_group ?? "Único",
        focus: plan.selected_group ?? null,
        items: plan.payload_json ?? [],
      },
    ];
  }

  async function handleDuplicateToStudent(target: PersonalDashboardStudent) {
    setSavingToStudentId(target.id);
    try {
      await createPersonalWorkoutPlan(target.id, {
        title: plan.title,
        weekPreset: plan.week_preset,
        days: planDaysOrFallback(),
        sourceProtocolId: plan.source_protocol_id,
      });
      onSuccess(`Ficha "${plan.title}" duplicada para ${target.name}.`);
      close();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível duplicar.");
      setSavingToStudentId(null);
    }
  }

  async function handleSaveAsProtocol() {
    setSavingAsProtocol(true);
    try {
      const days = planDaysOrFallback();
      const flatItems = days[0]?.items ?? [];
      await createWorkoutProtocol({
        title: `Cópia de ${plan.title}`,
        weekPreset: plan.week_preset,
        selectedGroup: plan.selected_group,
        items: flatItems,
        days,
      });
      onSuccess(`Protocolo "Cópia de ${plan.title}" salvo na sua biblioteca.`);
      close();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Não foi possível salvar como protocolo.");
      setSavingAsProtocol(false);
    }
  }

  const otherStudents = students.filter((s) => s.id !== currentStudentId);

  return (
    <>
      <button
        type="button"
        className="pp-btn pp-btn--icon pp-btn--ghost pp-btn--sm"
        onClick={() => setOpen(true)}
        aria-label="Mais opções da ficha"
        title="Mais opções"
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <DrawerShell open onClose={close} ariaLabel={`Ações da ficha ${plan.title}`}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h3 className="pp-quick-msg-title">{view === "menu" ? "Ações da ficha" : "Duplicar para outro aluno"}</h3>
              <p className="small" style={{ margin: "2px 0 0", color: "var(--color-text-muted)" }}>
                {view === "menu" ? plan.title : `Origem: ${plan.title}`}
              </p>
            </div>
            <button onClick={close} className="pp-btn pp-btn--icon pp-btn--ghost" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          {view === "menu" ? (
            <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                style={{ justifyContent: "flex-start", gap: 10 }}
                onClick={() => setView("students")}
              >
                <Users size={16} />
                <span>Duplicar para outro aluno</span>
              </button>
              <button
                type="button"
                className="pp-btn pp-btn--ghost"
                style={{ justifyContent: "flex-start", gap: 10 }}
                disabled={savingAsProtocol}
                onClick={() => void handleSaveAsProtocol()}
              >
                <BookMarked size={16} />
                <span>{savingAsProtocol ? "Salvando…" : "Salvar como protocolo da biblioteca"}</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
              {studentsLoading ? (
                <p className="muted">Carregando alunos…</p>
              ) : otherStudents.length === 0 ? (
                <p className="muted">Sem outros alunos vinculados ao seu perfil.</p>
              ) : (
                otherStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="pp-btn pp-btn--ghost"
                    style={{ justifyContent: "space-between", gap: 10 }}
                    disabled={savingToStudentId !== null}
                    onClick={() => void handleDuplicateToStudent(s)}
                  >
                    <span>{s.name}</span>
                    <span className="small" style={{ color: "var(--color-text-muted)" }}>
                      {savingToStudentId === s.id ? "Duplicando…" : "Duplicar →"}
                    </span>
                  </button>
                ))
              )}
              <button
                type="button"
                className="pp-btn pp-btn--ghost pp-btn--sm"
                style={{ marginTop: 4 }}
                onClick={() => setView("menu")}
              >
                ← Voltar
              </button>
            </div>
          )}
        </DrawerShell>
      )}
    </>
  );
}

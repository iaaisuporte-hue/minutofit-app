/**
 * Financeiro do personal — 5º destino da área.
 *
 * O que esta tela responde, em ordem: quanto entra este mês, quem está devendo,
 * o que termina em breve e como está cada aluno. A plataforma não processa
 * pagamento nenhum: o dinheiro continua indo direto para o personal, e aqui
 * fica o registro do que foi combinado e do que já entrou.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/EmptyState";
import { SkeletonStudentList } from "../../components/feedback/Skeleton";
import {
  fetchFinanceOverview,
  fetchFinanceStudents,
  formatCents,
  formatIsoDay,
  type FinanceOverview,
  type FinanceStudentsFilter,
  type StudentFinanceRow,
} from "../../services/personalFinanceApi";
import "../../pages/personal/personalPremium.css";
import { FinanceKpis } from "./FinanceKpis";
import { FinanceStudentList } from "./FinanceStudentList";
import { RenewalsSection } from "./RenewalsSection";
import { StudentFinanceSheet } from "./StudentFinanceSheet";
import { sendFinanceReminder } from "./financeReminder";

const EMPTY_HINT: Record<FinanceStudentsFilter, string> = {
  all: "Sua carteira ainda está vazia.",
  overdue: "Ninguém em atraso agora.",
  upcoming: "Nenhuma cobrança a vencer no momento.",
  paid: "Nenhuma cobrança quitada aparece por aqui ainda.",
  no_plan: "Todos os seus alunos já têm acordo registrado.",
};

/**
 * O filtro roda no cliente porque a lista inteira já chega com o status
 * derivado pelo servidor — e os contadores dos chips exigem o conjunto
 * completo de qualquer maneira. Quem decide o que é "vencido" continua sendo
 * o backend; aqui só se separa o que ele classificou.
 */
function matchesFilter(row: StudentFinanceRow, filter: FinanceStudentsFilter): boolean {
  if (filter === "all") return true;
  if (filter === "no_plan") return row.plan === null;
  return row.currentCharge?.derivedStatus === filter;
}

export default function FinancePage() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [rows, setRows] = useState<StudentFinanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinanceStudentsFilter>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<StudentFinanceRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [head, list] = await Promise.all([
        fetchFinanceOverview(),
        fetchFinanceStudents({ status: "all" }),
      ]);
      setOverview(head);
      setRows(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const base: Record<FinanceStudentsFilter, number> = {
      all: rows.length,
      overdue: 0,
      upcoming: 0,
      paid: 0,
      no_plan: 0,
    };
    for (const row of rows) {
      if (row.plan === null) base.no_plan += 1;
      const status = row.currentCharge?.derivedStatus;
      if (status === "overdue") base.overdue += 1;
      if (status === "upcoming") base.upcoming += 1;
      if (status === "paid") base.paid += 1;
    }
    return base;
  }, [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (row) =>
        matchesFilter(row, filter) &&
        (!term || (row.studentName ?? "").toLowerCase().includes(term)),
    );
  }, [rows, filter, q]);

  function openStudent(studentId: number) {
    const row = rows.find((r) => r.studentId === studentId);
    if (row) setSelected(row);
  }

  function remind(row: StudentFinanceRow) {
    setNotice(null);
    const opened = sendFinanceReminder({
      studentId: row.studentId,
      studentName: row.studentName,
      studentPhone: row.studentPhone,
      charge: row.currentCharge,
    });
    if (!opened) setNotice(`${row.studentName || "Este aluno"} não tem telefone válido cadastrado.`);
  }

  const chips: { key: FinanceStudentsFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "overdue", label: "Vencidos" },
    { key: "upcoming", label: "A vencer" },
    { key: "paid", label: "Pagos" },
    { key: "no_plan", label: "Sem acordo" },
  ];

  return (
    <div className="pp-page">
      <div className="pp-hero">
        <div style={{ display: "grid", gap: 6 }}>
          <div className="pp-kicker">Carteira</div>
          <h2 className="pp-title" style={{ fontSize: 24 }}>Financeiro</h2>
          <div className="pp-subtitle" style={{ maxWidth: 620 }}>
            O dinheiro continua indo direto para você — aqui fica o registro de quem
            combinou o quê, quem já pagou e quem precisa de um lembrete.
          </div>
        </div>
      </div>

      {loading ? (
        <div className="pp-panel">
          <div className="pp-panel__body">
            <SkeletonStudentList rows={4} label="Carregando financeiro" />
          </div>
        </div>
      ) : error ? (
        <div className="pp-panel">
          <div className="pp-panel__body">
            <EmptyState
              variant="warning"
              title="Não foi possível carregar o financeiro"
              description={error}
              action={
                <button type="button" className="pp-btn pp-btn--primary" onClick={() => void load()}>
                  Tentar de novo
                </button>
              }
            />
          </div>
        </div>
      ) : (
        <>
          {overview ? <FinanceKpis kpis={overview.kpis} /> : null}

          {overview && overview.attention.length > 0 ? (
            <div className="pp-callout pp-callout--danger">
              <b>
                {overview.kpis.overdueStudents === 1
                  ? "1 aluno com pagamento vencido"
                  : `${overview.kpis.overdueStudents} alunos com pagamento vencido`}
              </b>
              <div className="pp-fin-attention">
                {overview.attention.map((item) => (
                  <button
                    key={item.chargeId}
                    type="button"
                    className="pp-name"
                    onClick={() => openStudent(item.studentId)}
                  >
                    {item.studentName || "Aluno sem nome"} · {formatCents(item.amountCents)} ·{" "}
                    venceu em {formatIsoDay(item.dueDate)} ({item.daysOverdue}d)
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {overview ? <RenewalsSection renewals={overview.renewals} onSelect={openStudent} /> : null}

          <div className="pp-panel">
            <div className="pp-panel__header">
              <div>
                <div className="pp-panel__title">Alunos</div>
                <div className="pp-panel__subtitle">
                  Toque em um aluno para registrar pagamento ou ajustar o acordo.
                </div>
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span className="pp-meta">Buscar aluno</span>
                <input
                  className="pp-input"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nome do aluno…"
                  style={{ minWidth: 200, height: 38 }}
                />
              </label>
            </div>

            <div className="pp-panel__body" style={{ display: "grid", gap: 12 }}>
              <div className="pp-pulse-meta" role="toolbar" aria-label="Filtrar cobranças">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="pp-pulse-chip"
                    aria-pressed={filter === chip.key}
                    onClick={() => setFilter(chip.key)}
                  >
                    {chip.label} ({counts[chip.key]})
                  </button>
                ))}
              </div>

              {notice ? <p className="pp-fin-error">{notice}</p> : null}

              <FinanceStudentList
                rows={visible}
                emptyHint={q.trim() ? "Nenhum aluno com esse nome." : EMPTY_HINT[filter]}
                onSelect={setSelected}
                onRemind={remind}
              />
            </div>
          </div>
        </>
      )}

      {selected ? (
        <StudentFinanceSheet
          student={selected}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </div>
  );
}

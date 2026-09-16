import { useEffect, useState } from "react";
import { ClipboardList, Calculator, ChevronRight } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { EmptyState } from "../../../components/EmptyState";
import { DrawerShell } from "../../../components/overlay/DrawerShell";
import {
  fetchPatientIntakeSummary,
  fetchPatientIntakeLogs,
  type PatientIntakeSummary,
  type IntakeDailyRow,
  type NutriIntakeLog,
  type IntakeExceptionType,
} from "../../../services/nutriApi";

const EXCEPTION_LABEL: Record<IntakeExceptionType, string> = {
  intake_kcal_drop: "Queda de ingestão",
  intake_protein_low: "Proteína abaixo da meta",
  intake_silent: "Parou de registrar refeições",
  intake_over: "Ingestão acima da meta",
};

const LEVEL_LABEL: Record<IntakeDailyRow["level"], string> = {
  high: "Alta cobertura",
  partial: "Cobertura parcial",
  low: "Cobertura baixa",
};
const LEVEL_BADGE_CLASS: Record<IntakeDailyRow["level"], string> = {
  high: "badge-success",
  partial: "badge-warn",
  low: "badge-neutral",
};

function Tile({ label, value, target, unit }: { label: string; value: number | null; target: number | undefined; unit: string }) {
  return (
    <div className="card cardPad" style={{ padding: "var(--space-3)" }}>
      <div className="muted" style={{ fontSize: "var(--text-xs)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: COLORS.text }}>
        {value != null ? Math.round(value) : "—"}
        {target != null && <span className="muted" style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}> / {Math.round(target)}</span>}
        <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}> {unit}</span>
      </div>
    </div>
  );
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T12:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

/**
 * PLAN_NUTRITION_QUICK_MACROS (P1C) — seção "Nutrição registrada (7 dias)":
 * contexto (4 tiles + insight) e detalhe sob demanda (drawer com 7 linhas
 * diárias → toque expande as refeições daquele dia). Nunca inbox, nunca
 * aprovação — é leitura.
 */
export function IntakeSection({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{ summary: PatientIntakeSummary; days: IntakeDailyRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [dayLogs, setDayLogs] = useState<Record<string, NutriIntakeLog[]>>({});

  useEffect(() => {
    setLoading(true);
    fetchPatientIntakeSummary(patientId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  async function toggleDay(dateKey: string) {
    if (expandedDay === dateKey) {
      setExpandedDay(null);
      return;
    }
    setExpandedDay(dateKey);
    if (!dayLogs[dateKey]) {
      const logs = await fetchPatientIntakeLogs(patientId, dateKey).catch(() => []);
      setDayLogs((prev) => ({ ...prev, [dateKey]: logs }));
    }
  }

  if (loading) return <SkeletonPanelCard />;
  if (!data || data.summary.state === "none") {
    return (
      <EmptyState
        title="Sem registros de ingestão"
        description="O paciente ainda não registrou nenhuma refeição pelo app."
      />
    );
  }

  const { summary, days } = data;
  const isPlanTarget = summary.target?.source === "plan_items";

  return (
    <div className="card cardPad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
        <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
          {summary.daysLogged7d} dias registrados · {summary.highCoverageDays7d} com alta cobertura
        </div>
        {summary.target && (
          <span className={`badge ${isPlanTarget ? "badge-brand" : "badge-neutral"}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            {isPlanTarget ? <ClipboardList size={11} /> : <Calculator size={11} />}
            {isPlanTarget ? "Meta do plano" : "Estimativa do paciente"}
          </span>
        )}
      </div>

      {summary.state === "insufficient" ? (
        <div className="muted" style={{ fontSize: "var(--text-sm)" }}>
          Poucos dias de registro consistente ainda — sinal aparece a partir de 4 dias de alta cobertura em 7.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <Tile label="Calorias (média)" value={summary.avgKcal7d} target={summary.target?.kcal} unit="kcal" />
          <Tile label="Proteína (média)" value={summary.avgProteinG7d} target={summary.target?.p} unit="g" />
          <Tile label="Carboidrato (média)" value={summary.avgCarbG7d} target={summary.target?.c} unit="g" />
          <Tile label="Gordura (média)" value={summary.avgFatG7d} target={summary.target?.f} unit="g" />
        </div>
      )}

      {summary.exception && (
        <div className="card cardPad" style={{ borderLeft: "3px solid var(--color-warn)", marginBottom: "var(--space-3)" }}>
          <div style={{ fontWeight: 700, color: COLORS.text, fontSize: "var(--text-sm)" }}>{EXCEPTION_LABEL[summary.exception.type]}</div>
          <div className="muted" style={{ fontSize: "var(--text-sm)", marginTop: 2 }}>{summary.exception.detail}</div>
        </div>
      )}

      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(true)}>
        Ver registros
      </button>

      <DrawerShell open={drawerOpen} onClose={() => setDrawerOpen(false)} ariaLabel="Registros de ingestão">
        <div style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text, marginBottom: "var(--space-3)" }}>
          Registros de ingestão (7 dias)
        </div>
        <div className="stack" style={{ gap: "var(--space-2)", maxHeight: "70dvh", overflowY: "auto" }}>
          {days.length === 0 && <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Nenhum registro nos últimos 7 dias.</div>}
          {days.map((d) => (
            <div key={d.dateKey} className="card cardPad" style={{ padding: "var(--space-2) var(--space-3)" }}>
              <button
                type="button"
                onClick={() => void toggleDay(d.dateKey)}
                style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <ChevronRight size={14} style={{ transform: expandedDay === d.dateKey ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                  <span style={{ fontWeight: 600, color: COLORS.text, fontSize: "var(--text-sm)" }}>{formatDayLabel(d.dateKey)}</span>
                  <span className={`badge ${LEVEL_BADGE_CLASS[d.level]}`} style={{ fontSize: 10 }}>{LEVEL_LABEL[d.level]}</span>
                </span>
                <span className="muted" style={{ fontSize: "var(--text-xs)" }}>{d.loggedMeals} refeições · {Math.round(d.totalKcal)} kcal</span>
              </button>
              {expandedDay === d.dateKey && (
                <div style={{ marginTop: "var(--space-2)", paddingLeft: "var(--space-5)", display: "flex", flexDirection: "column", gap: 6 }}>
                  {!dayLogs[d.dateKey] && <div className="muted" style={{ fontSize: "var(--text-xs)" }}>Carregando...</div>}
                  {dayLogs[d.dateKey]?.length === 0 && <div className="muted" style={{ fontSize: "var(--text-xs)" }}>Sem refeições registradas.</div>}
                  {dayLogs[d.dateKey]?.map((log) => (
                    <div key={log.id} style={{ fontSize: "var(--text-xs)" }}>
                      <span style={{ fontWeight: 600, color: COLORS.text }}>{log.label}</span>
                      <span className="muted"> · {Math.round(log.energyKcal)} kcal · P {Math.round(log.proteinG)}g</span>
                      <div className="muted" style={{ marginTop: 2 }}>
                        {log.items.map((it) => it.name).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </DrawerShell>
    </div>
  );
}

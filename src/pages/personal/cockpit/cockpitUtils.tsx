import { COLORS } from "../../../styles/colors";

export function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function metabolismBandLabel(score: number | null): {
  band: "low" | "moderate" | "high";
  label: string;
  toneClass: string;
} | null {
  if (score === null) return null;
  if (score >= 70) return { band: "high", label: "alto", toneClass: "pp-metabo-card--high" };
  if (score >= 45) return { band: "moderate", label: "moderado", toneClass: "pp-metabo-card--moderate" };
  return { band: "low", label: "baixo", toneClass: "pp-metabo-card--low" };
}

export function metabolismNarrative(
  metabolism: { score: number; trend: string } | null | undefined,
  workoutsThisWeek: number
): string {
  if (!metabolism) {
    return "Sem snapshot calculado ainda — registre o primeiro check-in para começar a leitura.";
  }
  const { trend, score } = metabolism;

  if (trend === "down" && score < 55) {
    return "Score em queda e abaixo da faixa saudável. Vale investigar fadiga, sono e volume recente.";
  }
  if (trend === "down") {
    return "Tendência de queda nas últimas semanas — fique de olho na recuperação.";
  }
  if (score >= 70 && trend === "up") {
    return "Em boa fase metabólica — momento de progressão controlada de carga.";
  }
  if (score >= 70) {
    return "Metabolismo em ritmo alto — manter constância sem aumentar volume bruscamente.";
  }
  if (score < 45 && workoutsThisWeek >= 4) {
    return "Volume alto sem retorno metabólico — considerar uma semana de descarga.";
  }
  if (score < 45) {
    return "Score baixo. Reengajar com treinos curtos e foco em recuperação.";
  }
  return "Em ritmo moderado — espaço para evoluir consistência sem sobrecarregar.";
}

export function buildAdherenceNarrative(series: Array<{ date: string; score: number }>): string {
  if (!series.length) return "Sem snapshots suficientes para leitura semanal.";
  if (series.length < 4) return "Histórico curto — leitura ainda em formação.";
  const half = Math.floor(series.length / 2);
  const recent = series.slice(-half);
  const older = series.slice(0, half);
  const avg = (xs: typeof series) =>
    xs.reduce((sum, item) => sum + Number(item.score || 0), 0) / Math.max(xs.length, 1);
  const delta = avg(recent) - avg(older);
  if (delta <= -8) return "Aderência caindo na última semana.";
  if (delta >= 8) return "Aderência subindo nos últimos dias — boa fase.";
  return "Aderência estável no período.";
}

export function Surface({ children }: { children: React.ReactNode }) {
  return <div className="pp-surface">{children}</div>;
}

export function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div className="pp-metric__label">{label}</div>
      <div style={{ fontWeight: 650, fontSize: 20, color: COLORS.text }}>{value}</div>
      {helper ? (
        <div style={{ color: COLORS.muted, fontSize: 12, lineHeight: 1.45 }}>{helper}</div>
      ) : null}
    </div>
  );
}

export function AdherenceSparkline({ series }: { series: Array<{ date: string; score: number }> }) {
  if (!series.length) {
    return (
      <div style={{ color: COLORS.muted, fontSize: 13 }}>
        Sem snapshots metabólicos suficientes ainda.
      </div>
    );
  }

  const max = Math.max(100, ...series.map((p) => p.score));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, minHeight: 80 }}>
      {series.map((point) => {
        const h = Math.max(8, Math.round((point.score / max) * 72));
        return (
          <div
            key={point.date}
            title={`${formatShortDate(point.date)} — ${point.score}`}
            style={{ display: "grid", gap: 4, justifyItems: "center", flex: 1 }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 14,
                height: h,
                borderRadius: 6,
                background: point.score < 45 ? "var(--color-warn)" : point.score < 70 ? "var(--color-info)" : "var(--color-primary)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

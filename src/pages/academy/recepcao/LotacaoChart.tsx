/**
 * LotacaoChart — Gráfico de lotação em tempo real
 *
 * Pure SVG — sem dependências externas.
 * Mostra a curva típica de ocupação por hora + marcador em tempo real.
 */

// ─── Constantes ───────────────────────────────────────────────────────────────

export const CAPACITY = 120;

/** Lotação típica PH Gym por hora (média 5 dias — padrão operacional) */
const TYPICAL: Record<number, number> = {
   6:  8,  7: 25,  8: 35,  9: 20, 10: 12,
  11: 18, 12: 28, 13: 22, 14: 10, 15:  8,
  16: 14, 17: 32, 18: 55, 19: 78, 20: 68,
  21: 45, 22: 18,
};

const DISPLAY_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
const PEAK_HOURS    = new Set([18, 19, 20]);
const X_LABELS      = [6, 9, 12, 15, 18, 21];
const Y_LABELS      = [0, 30, 60, 90, 120];

const PAD  = { l: 34, r: 14, t: 10, b: 26 };
const CW   = 560;  // chart width
const CH   = 96;   // chart height
const SVG_W = PAD.l + CW + PAD.r;
const SVG_H = PAD.t + CH + PAD.b;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toX(hour: number) {
  return PAD.l + ((hour - 6) / (22 - 6)) * CW;
}

function toY(count: number) {
  return PAD.t + CH - Math.min(count / CAPACITY, 1) * CH;
}

/** Curva suave catmull-rom → bezier cúbico */
function smoothPoints(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  const alpha = 0.45;
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1[0] + (p2[0] - p0[0]) * alpha / 3;
    const cp1y = p1[1] + (p2[1] - p0[1]) * alpha / 3;
    const cp2x = p2[0] - (p3[0] - p1[0]) * alpha / 3;
    const cp2y = p2[1] - (p3[1] - p1[1]) * alpha / 3;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function getNextPeak(hour: number): string | null {
  if (hour < 6 || hour >= 21) return null;
  if (hour < 7)  return "7h";
  if (hour < 18) return "18h";
  if (hour === 18) return "19h";
  if (hour === 19) return "pico";
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface LotacaoChartProps {
  occupancyNow: number;
}

export function LotacaoChart({ occupancyNow }: LotacaoChartProps) {
  const now   = new Date();
  const curH  = now.getHours();
  const pct   = Math.round((occupancyNow / CAPACITY) * 100);
  const peak  = getNextPeak(curH);

  // Build point set — replace current hour with live value
  const points: [number, number][] = DISPLAY_HOURS.map((h) => {
    const val = h === curH && DISPLAY_HOURS.includes(curH)
      ? occupancyNow
      : (TYPICAL[h] ?? 0);
    return [toX(h), toY(val)];
  });

  const linePath = smoothPoints(points);

  // Area path = line path + close bottom
  const firstX = toX(DISPLAY_HOURS[0]);
  const lastX  = toX(DISPLAY_HOURS[DISPLAY_HOURS.length - 1]);
  const bottom = PAD.t + CH;
  const areaPath = `${linePath} L ${lastX.toFixed(1)},${bottom} L ${firstX.toFixed(1)},${bottom} Z`;

  const cursorVisible = DISPLAY_HOURS.includes(curH);
  const cursorX = cursorVisible ? toX(curH) : null;
  const cursorY = cursorVisible ? toY(occupancyNow) : null;

  return (
    <div className="rec-chart-card">
      {/* Header */}
      <div className="rec-chart-header">
        <div>
          <div className="rec-chart-title">Lotação em tempo real</div>
          <div className="rec-chart-sub">Curva típica por horário + lotação ao vivo nesta hora · série histórica real na V2</div>
        </div>
        <div className="rec-chart-stats">
          <div className="rec-chart-stat">
            <span className="rec-chart-stat-value">{occupancyNow}</span>
            <span className="rec-chart-stat-unit">/ {CAPACITY}</span>
            <span className="rec-chart-stat-label">agora</span>
          </div>
          <div className="rec-chart-divider" />
          <div className="rec-chart-stat">
            <span
              className="rec-chart-stat-value"
              style={{ color: pct > 90 ? "var(--color-danger)" : pct > 75 ? "var(--color-warn)" : "var(--color-primary)" }}
            >
              {pct}%
            </span>
            <span className="rec-chart-stat-label">ocupação</span>
          </div>
          {peak && (
            <>
              <div className="rec-chart-divider" />
              <div className="rec-chart-stat">
                <span className="rec-chart-stat-value rec-chart-stat-value--accent">{peak}</span>
                <span className="rec-chart-stat-label">pico previsto</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="rec-chart-svg"
        aria-label={`Lotação atual: ${occupancyNow} de ${CAPACITY} alunos`}
        role="img"
      >
        <defs>
          <linearGradient id="rec-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.20" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Peak zone tint */}
        <rect
          x={toX(18)} y={PAD.t}
          width={toX(21) - toX(18)} height={CH}
          fill="var(--color-warn)" fillOpacity={0.05}
          rx={2}
        />

        {/* Horizontal grid + Y labels */}
        {Y_LABELS.map((v) => (
          <g key={v}>
            <line
              x1={PAD.l} y1={toY(v)} x2={PAD.l + CW} y2={toY(v)}
              stroke="var(--color-border)"
              strokeWidth={v === 0 ? 1 : 0.8}
              strokeDasharray={v === 0 ? "none" : "3,5"}
            />
            <text
              x={PAD.l - 5} y={toY(v) + 4}
              textAnchor="end" fontSize={8.5}
              fill="var(--color-text-subtle)" fontFamily="inherit"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Capacity danger line */}
        <line
          x1={PAD.l} y1={toY(CAPACITY)} x2={PAD.l + CW} y2={toY(CAPACITY)}
          stroke="var(--color-danger)" strokeWidth={1} strokeDasharray="4,5" strokeOpacity={0.35}
        />

        {/* Area fill */}
        <path d={areaPath} fill="url(#rec-grad)" />

        {/* Main line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current hour marker */}
        {cursorX !== null && cursorY !== null && (
          <>
            <line
              x1={cursorX} y1={PAD.t} x2={cursorX} y2={bottom}
              stroke="var(--color-primary)" strokeWidth={1} strokeDasharray="3,4" strokeOpacity={0.4}
            />
            <circle
              cx={cursorX} cy={cursorY} r={4.5}
              fill="var(--color-primary)" stroke="white" strokeWidth={2}
            />
          </>
        )}

        {/* X-axis labels */}
        {X_LABELS.map((h) => {
          const isPeak = PEAK_HOURS.has(h);
          return (
            <text
              key={h}
              x={toX(h)} y={SVG_H - 5}
              textAnchor="middle" fontSize={9}
              fill={isPeak ? "var(--color-warn-text)" : "var(--color-text-subtle)"}
              fontWeight={isPeak ? "600" : "400"}
              fontFamily="inherit"
            >
              {h}h
            </text>
          );
        })}
      </svg>

      {/* Legend strip */}
      <div className="rec-chart-legend">
        <div className="rec-chart-legend-item">
          <span className="rec-chart-legend-dot rec-chart-legend-dot--primary" />
          Hoje
        </div>
        <div className="rec-chart-legend-item">
          <span className="rec-chart-legend-dot rec-chart-legend-dot--warn" />
          Pico noturno 18–21h
        </div>
        <div className="rec-chart-legend-item">
          <span className="rec-chart-legend-line rec-chart-legend-line--danger" />
          Capacidade máxima ({CAPACITY})
        </div>
      </div>
    </div>
  );
}

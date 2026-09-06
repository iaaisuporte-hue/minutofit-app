import { useEffect, useState } from "react";
import { Check, CircleDot, ArrowLeftRight, Clock, X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { COLORS } from "../../../styles/colors";
import { dayKey } from "../../../lib/appDay";
import { SkeletonPanelCard } from "../../../components/feedback/Skeleton";
import { useIsMobile } from "../../../hooks/useIsMobile";
import {
  fetchAdherence,
  fetchMealHeatmap,
  type Adherence,
  type MealCheckinStatus,
  type MealHeatmapData,
  NutriApiError,
} from "../../../services/nutriApi";
import { ConsentRevokedNotice } from "./shared";

// ---------------------------------------------------------------------------
// Tab: Adesão — meal × day heatmap + intelligence layer
// ---------------------------------------------------------------------------

const HEATMAP_COLORS: Record<MealCheckinStatus | "none", string> = {
  done: "var(--color-success)",
  partial: "var(--color-warn)",
  substituted: "var(--color-primary)",
  delayed: "var(--color-warn)",
  skipped: "var(--color-danger)",
  none: "var(--color-border)",
};

// SPEC 036 / §mapa de ícones: glifo tipográfico → ícone lucide monocromático.
const HEATMAP_ICON: Record<MealCheckinStatus, typeof Check> = {
  done: Check,
  partial: CircleDot,
  substituted: ArrowLeftRight,
  delayed: Clock,
  skipped: X,
};

// Computes intelligence metrics from local heatmap data (no extra API call)
function computeAdherenceIntel(
  checkins: MealHeatmapData["checkins"],
  meals: MealHeatmapData["meals"],
  dates: string[],
) {
  // SPEC 035 / NUTRI-05: `check_date` chega da API como timestamp ISO
  // completo (ex. "2026-09-04T03:00:00.000Z"), não como "YYYY-MM-DD". Sem o
  // `.slice(0,10)`, a chave nunca batia com as de `dates` — todo o
  // breakdown por refeição lia "0%, nenhum registro" com o heatmap ao lado
  // cheio de check-ins.
  const map = new Map<string, MealCheckinStatus>();
  for (const c of checkins) map.set(`${c.meal_id}:${String(c.check_date).slice(0, 10)}`, c.status);

  function mealPct(mealId: number, window: string[]): number {
    const done = window.filter((d) => {
      const s = map.get(`${mealId}:${d}`);
      return s === "done" || s === "substituted";
    }).length;
    const partial = window.filter((d) => map.get(`${mealId}:${d}`) === "partial").length;
    return window.length > 0 ? Math.round(((done + partial * 0.5) / window.length) * 100) : 0;
  }

  function dayHasCheckin(date: string): boolean {
    return meals.some((m) => {
      const s = map.get(`${m.id}:${date}`);
      return !!s && s !== "skipped";
    });
  }

  // Overall per-meal adherence
  const mealStats = meals.map((m) => ({ meal: m, pct: mealPct(m.id, dates) }));
  const weakest = [...mealStats].sort((a, b) => a.pct - b.pct)[0] ?? null;

  // Trend: last 7d vs first 7d (requires ≥7 days window)
  let trend: "up" | "down" | "stable" | null = null;
  if (dates.length >= 7) {
    const first7 = dates.slice(0, Math.floor(dates.length / 2));
    const last7 = dates.slice(Math.floor(dates.length / 2));
    const avgFirst = meals.length > 0
      ? Math.round(mealStats.reduce((s, ms) => s + mealPct(ms.meal.id, first7), 0) / meals.length)
      : 0;
    const avgLast = meals.length > 0
      ? Math.round(mealStats.reduce((s, ms) => s + mealPct(ms.meal.id, last7), 0) / meals.length)
      : 0;
    const delta = avgLast - avgFirst;
    trend = delta >= 15 ? "up" : delta <= -15 ? "down" : "stable";
  }

  // Current streak (consecutive days ending today with ≥1 non-skip check-in)
  let streak = 0;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dayHasCheckin(dates[i])) streak++;
    else break;
  }

  // Worst day of week (day with most skips/nulls, requires ≥2 occurrences)
  const skipsByDow: Record<number, number> = {};
  const countsByDow: Record<number, number> = {};
  for (const d of dates) {
    const dow = new Date(d + "T12:00").getDay();
    countsByDow[dow] = (countsByDow[dow] ?? 0) + 1;
    const skips = meals.filter((m) => {
      const s = map.get(`${m.id}:${d}`);
      return !s || s === "skipped";
    }).length;
    skipsByDow[dow] = (skipsByDow[dow] ?? 0) + skips;
  }
  const DOW_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  let worstDow: string | null = null;
  let worstRate = 0;
  for (const [dow, skips] of Object.entries(skipsByDow)) {
    const cnt = countsByDow[Number(dow)] ?? 0;
    const rate = cnt >= 2 ? skips / (cnt * meals.length) : 0;
    if (rate > worstRate && rate >= 0.6) { worstRate = rate; worstDow = DOW_LABELS[Number(dow)]; }
  }

  return { mealStats, weakest, trend, streak, worstDow };
}

function AdherenceNarrative({ pct }: { pct: number }) {
  const cfg =
    pct >= 80 ? { label: "Constância excelente", color: COLORS.successText }
    : pct >= 60 ? { label: "Boa constância", color: COLORS.successText }
    : pct >= 40 ? { label: "Constância moderada", color: COLORS.warnText }
    : pct >= 20 ? { label: "Constância baixa", color: COLORS.warnText }
    : { label: "Adesão muito baixa", color: COLORS.dangerText };
  return <span style={{ fontSize: "var(--text-base)", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>;
}

function buildDateRange(days: number): string[] {
  // dayKey() (fuso do aluno) — não `toISOString()` (UTC do navegador, que
  // costuma coincidir com BRT mas não deveria ser a premissa).
  const todayKey = dayKey();
  const [y, m, d0] = todayKey.split("-").map(Number);
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1, d0 - i));
    dates.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return dates;
}

export function AdherenceTab({ patientId }: { patientId: number }) {
  const [heatmap, setHeatmap] = useState<MealHeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentRevoked, setConsentRevoked] = useState(false);
  const isMobile = useIsMobile(640);

  // Always fetch 14 days — display window narrows on mobile without extra requests
  useEffect(() => {
    setConsentRevoked(false);
    fetchMealHeatmap(patientId, 14)
      .then(setHeatmap)
      .catch((err) => {
        // SPEC 035 / NUTRI-11 (§7): 403 de consent NÃO pode cair no fallback
        // legado — o fallback tem seu PRÓPRIO gate (daily_checkins) e
        // renderizaria "sem dado" para um caso que é revogação, não ausência.
        if (err instanceof NutriApiError && err.consentRevoked) {
          setConsentRevoked(true);
        } else {
          setHeatmap({ plan: null, meals: [], checkins: [], adherence: null });
        }
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const DAYS = isMobile ? 7 : 14;

  if (loading) return <SkeletonPanelCard />;
  if (consentRevoked) return <ConsentRevokedNotice />;

  // Fallback to legacy adherence if no meal checkins schema yet
  if (!heatmap?.plan || heatmap.meals.length === 0) {
    return <LegacyAdherenceTab patientId={patientId} />;
  }

  const dates = buildDateRange(DAYS);
  const checkinMap = new Map<string, MealCheckinStatus>();
  for (const c of heatmap.checkins) {
    const dateKey = String(c.check_date).slice(0, 10);
    checkinMap.set(`${c.meal_id}:${dateKey}`, c.status);
  }

  // SPEC 035 / NUTRI-04: o cabeçalho (%, streak, tendência) vem do bloco
  // CANÔNICO que o backend calcula sobre uma janela fixa (14d/60d),
  // independente de quantos dias esta tela pediu para o grid visual — antes,
  // o numerador vinha de 14 dias e o denominador de `dates.length` (7 no
  // mobile), e o mesmo paciente lia 46% no desktop e 93% no celular no
  // mesmo instante. O grid e o breakdown por refeição abaixo continuam
  // locais (são "como foi cada refeição NESTA janela visível", um conceito
  // diferente de "aderência real do paciente").
  const canonical = heatmap.adherence;
  const calibrating = canonical?.adherenceState === "calibrating";
  const adherePct = canonical?.adherencePct ?? 0;
  const streakDays = canonical?.streakDays ?? 0;
  const trend = canonical?.trend ?? null;

  const intel = computeAdherenceIntel(heatmap.checkins, heatmap.meals, dates);

  const TREND_LABEL: Record<"up" | "down" | "stable", { Icon: typeof TrendingUp; text: string; color: string }> = {
    up: { Icon: TrendingUp, text: "Melhorando", color: COLORS.successText },
    down: { Icon: TrendingDown, text: "Em queda", color: COLORS.dangerText },
    stable: { Icon: Minus, text: "Estável", color: COLORS.muted },
  };

  const barColor = adherePct >= 70 ? "var(--color-success)" : adherePct >= 40 ? "var(--color-warn)" : "var(--color-danger)";
  const barColorText = adherePct >= 70 ? COLORS.successText : adherePct >= 40 ? COLORS.warnText : COLORS.dangerText;

  return (
    <div className="stack">
      {/* ── Intelligence summary card ── */}
      <div className="card cardPad">
        {/* Header row: % + narrative + trend */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)", marginBottom: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)" }}>
            {calibrating ? (
              <span style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: COLORS.muted, lineHeight: 1 }}>Calibrando</span>
            ) : (
              <>
                <span style={{ fontSize: "var(--text-3xl)", fontWeight: 800, color: barColorText, lineHeight: 1 }}>{adherePct}%</span>
                <AdherenceNarrative pct={adherePct} />
              </>
            )}
          </div>
          {trend && (() => {
            const TrendIcon = TREND_LABEL[trend].Icon;
            return (
              <span className="badge" style={{ color: TREND_LABEL[trend].color, display: "flex", alignItems: "center", gap: "var(--space-1)", flexShrink: 0 }}>
                <TrendIcon size={13} aria-hidden="true" /> {TREND_LABEL[trend].text}
              </span>
            );
          })()}
        </div>

        {calibrating && (
          <div className="muted" style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
            Plano recente — ainda não há dias suficientes para um percentual confiável.
          </div>
        )}

        {/* Progress bar */}
        {!calibrating && (
          <div style={{ height: 7, borderRadius: "var(--radius-pill)", background: "var(--color-surface-raised)", overflow: "hidden", marginBottom: "var(--space-4)" }}>
            <div style={{ height: "100%", width: `${adherePct}%`, background: barColor, borderRadius: "var(--radius-pill)", transition: "width 0.5s" }} />
          </div>
        )}

        {/* Stats strip */}
        <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Sequência atual</span>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: streakDays > 0 ? COLORS.successText : COLORS.muted }}>
              {streakDays} {streakDays === 1 ? "dia" : "dias"}
            </span>
          </div>
          <div style={{ width: 1, background: "var(--color-border)", alignSelf: "stretch" }} />
          <div className="stack" style={{ gap: 2 }}>
            <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Janela</span>
            <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.text }}>{DAYS} dias · {heatmap.meals.length} refeições</span>
          </div>
          {intel.worstDow && (
            <>
              <div style={{ width: 1, background: "var(--color-border)", alignSelf: "stretch" }} />
              <div className="stack" style={{ gap: 2 }}>
                <span className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Dia crítico</span>
                <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: COLORS.warnText }}>{intel.worstDow}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Heatmap grid ── */}
      {/* SPEC 036: `overflowX:"hidden"` no mobile escondia dias que não cabiam
          na tela sem dar affordance nenhuma de rolagem — agora sempre "auto",
          a grade tem `minWidth` própria e o card rola horizontalmente. */}
      <div className="card cardPad" style={{ overflowX: "auto" }}>
        {(() => {
          const today = dayKey();
          const COL_NAME = isMobile ? 96 : 128;
          const COL_CELL = isMobile ? 32 : 36;
          const CELL_H = isMobile ? 26 : 28;
          const cols = `${COL_NAME}px repeat(${dates.length}, ${COL_CELL}px)`;
          const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

          return (
            <div style={{ minWidth: COL_NAME + dates.length * (COL_CELL + 3) }}>
              {/* Date header */}
              <div style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: "var(--space-2)" }}>
                <div />
                {dates.map((d) => {
                  const isT = d === today;
                  const dt = new Date(d + "T12:00");
                  return (
                    <div
                      key={d}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        padding: "3px 0 4px",
                        borderRadius: "var(--radius-sm)",
                        // SPEC 036: `${COLORS.primary}18` concatenava hex com
                        // alpha em string — quebrava em qualquer tema que não
                        // usasse hex puro (var() não aceita sufixo de alpha
                        // assim). O token `--color-primary-soft` já é o par
                        // claro/escuro certo da marca.
                        background: isT ? "var(--color-primary-soft)" : "transparent",
                      }}
                    >
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: isT ? COLORS.primary : COLORS.muted }}>
                        {DOW[dt.getDay()]}
                      </span>
                      <span style={{ fontSize: "var(--text-xs)", fontWeight: isT ? 800 : 500, color: isT ? COLORS.primary : COLORS.muted }}>
                        {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Meal rows */}
              {heatmap.meals.map((meal) => (
                <div key={meal.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 3, marginBottom: 3, alignItems: "center" }}>
                  {/* Meal label — 2 lines */}
                  <div style={{ paddingRight: "var(--space-2)" }}>
                    <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: COLORS.text, lineHeight: 1.3, wordBreak: "break-word" }}>
                      {meal.name}
                    </div>
                    {meal.meal_time && (
                      <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: 1 }}>
                        {meal.meal_time.slice(0, 5)}
                      </div>
                    )}
                  </div>

                  {/* Cells */}
                  {dates.map((d) => {
                    const status = checkinMap.get(`${meal.id}:${d}`) ?? "none";
                    const isT = d === today;
                    const hasDatum = status !== "none";
                    const Icon = hasDatum ? HEATMAP_ICON[status] : null;

                    return (
                      <div
                        key={d}
                        title={`${meal.name} · ${new Date(d + "T12:00").toLocaleDateString("pt-BR")} · ${status}`}
                        style={{
                          height: CELL_H,
                          borderRadius: "var(--radius-sm)",
                          background: hasDatum ? HEATMAP_COLORS[status] : isT ? "var(--color-primary-soft)" : "var(--color-surface-raised)",
                          border: isT && !hasDatum ? `1.5px dashed ${COLORS.primary}` : hasDatum ? "none" : "1px solid var(--color-border)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          transition: "transform 0.1s",
                          cursor: "default",
                        }}
                      >
                        {Icon && <Icon size={13} aria-hidden="true" />}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
          {(
            [
              ["done", "Seguiu"],
              ["partial", "Parcial"],
              ["substituted", "Substituiu"],
              ["skipped", "Pulou"],
              ["none", "Sem registro"],
            ] as Array<[MealCheckinStatus | "none", string]>
          ).map(([s, l]) => (
            <span key={s} className="muted" style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", fontSize: "var(--text-xs)" }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 3, background: HEATMAP_COLORS[s], opacity: s === "none" ? 0.35 : 1, border: s === "none" ? "1px solid var(--color-border)" : "none" }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* ── Meal-level intelligence strip ── */}
      {intel.mealStats.length > 0 && (
        <div className="card cardPad">
          <div className="muted" style={{ fontSize: "var(--text-xs)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
            Adesão por refeição
          </div>
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            {[...intel.mealStats]
              .sort((a, b) => a.pct - b.pct)
              .map(({ meal, pct }) => {
                const isWeakest = intel.weakest?.meal.id === meal.id;
                const barC = pct >= 70 ? "var(--color-success)" : pct >= 40 ? "var(--color-warn)" : "var(--color-danger)";
                const barCText = pct >= 70 ? COLORS.successText : pct >= 40 ? COLORS.warnText : COLORS.dangerText;
                return (
                  <div key={meal.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1)" }}>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: isWeakest ? 700 : 500, color: isWeakest ? COLORS.text : COLORS.muted, display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                        {isWeakest && pct < 60 && <span className="badge badge-danger">atenção</span>}
                        {meal.name}
                        {meal.meal_time && <span style={{ fontWeight: 400, color: COLORS.muted }}>{meal.meal_time.slice(0, 5)}</span>}
                      </span>
                      <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: barCText }}>{pct}%</span>
                    </div>
                    <div style={{ height: 5, borderRadius: "var(--radius-pill)", background: "var(--color-surface-raised)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: barC, borderRadius: "var(--radius-pill)", transition: "width 0.4s" }} />
                    </div>
                  </div>
                );
              })}
          </div>

          {intel.weakest && intel.weakest.pct < 40 && (
            <div className="alert alert-danger" style={{ marginTop: "var(--space-4)" }}>
              <span>
                <strong>"{intel.weakest.meal.name}"</strong> tem apenas {intel.weakest.pct}% de adesão nos últimos {DAYS} dias.
                {intel.weakest.pct === 0
                  ? " Nenhum registro — considere ajustar horário ou orientação."
                  : " Considere explorar barreiras ou simplificar esta refeição."}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Fallback: legacy daily adherence bar (for patients without granular checkins yet)
function LegacyAdherenceTab({ patientId }: { patientId: number }) {
  const [data, setData] = useState<{
    plan: { id: number; title: string } | null;
    checkins: Array<{ check_date: string; adherence: Adherence; note: string | null }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentRevoked, setConsentRevoked] = useState(false);

  useEffect(() => {
    fetchAdherence(patientId, 7)
      .then(setData)
      .catch((err) => {
        if (err instanceof NutriApiError && err.consentRevoked) setConsentRevoked(true);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <SkeletonPanelCard />;
  if (consentRevoked) return <ConsentRevokedNotice />;
  if (!data?.plan) return <div className="muted" style={{ fontSize: "var(--text-sm)" }}>Sem plano ativo — nenhum dado de adesão.</div>;

  const fullCount = data.checkins.filter((c) => c.adherence === "full").length;
  const partialCount = data.checkins.filter((c) => c.adherence === "partial").length;
  const adherePct = Math.round(((fullCount + partialCount * 0.5) / 7) * 100);
  const ICON: Record<string, typeof Check> = { full: Check, partial: Minus, skipped: X };
  const COLOR: Record<string, string> = {
    full: COLORS.successText,
    partial: COLORS.warnText,
    skipped: COLORS.dangerText,
  };

  return (
    <div className="card cardPad">
      <div style={{ fontSize: "var(--text-base)", fontWeight: 600, color: COLORS.text, marginBottom: "var(--space-3)" }}>
        Esta semana: {adherePct}% de adesão ({data.checkins.length}/7 dias)
      </div>
      <div style={{ height: 8, borderRadius: "var(--radius-sm)", background: "var(--color-surface-raised)", overflow: "hidden", marginBottom: "var(--space-4)" }}>
        <div style={{ height: "100%", width: `${adherePct}%`, background: adherePct >= 70 ? "var(--color-primary)" : adherePct >= 40 ? "var(--color-warn)" : "var(--color-danger)", borderRadius: "var(--radius-sm)" }} />
      </div>
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        {data.checkins.map((c) => {
          const Icon = ICON[c.adherence] ?? X;
          return (
            <div key={c.check_date} style={{ textAlign: "center", minWidth: 44 }}>
              <div style={{ color: COLOR[c.adherence] ?? COLORS.muted, lineHeight: 1.3, display: "flex", justifyContent: "center" }}>
                <Icon size={18} aria-hidden="true" />
              </div>
              <div className="muted" style={{ fontSize: "var(--text-xs)" }}>
                {new Date(c.check_date).toLocaleDateString("pt-BR", { weekday: "short" })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-3)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Check size={12} aria-hidden="true" /> Seguiu</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Minus size={12} aria-hidden="true" /> Parcial</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><X size={12} aria-hidden="true" /> Não seguiu / sem registro</span>
      </div>
    </div>
  );
}

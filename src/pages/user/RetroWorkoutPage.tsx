import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createWorkoutSessionWithError,
  type CreateWorkoutSessionPayload,
  type CreateWorkoutSessionResult,
} from "../../services/workoutSessionApi";
import { fetchMyWorkoutPlans, type UserWorkoutPlan, type UserWorkoutPlanDay } from "../../services/userWorkoutPlansApi";
import { postRetroEvent } from "./lib/retroEvents";

// Registro retroativo de treino (Spec 024). Correção de diário: o aluno registra
// um treino feito nos últimos 3 dias que esqueceu de marcar. NÃO substitui o
// fluxo ao vivo. Wizard: data → treino → resumo/honestidade → confirmação.

const RPE_OPTIONS = [
  { label: "Leve", rpe: 3 },
  { label: "Moderado", rpe: 6 },
  { label: "Intenso", rpe: 8 },
  { label: "Máximo", rpe: 10 },
];

const MUSCLE_GROUPS: { key: string; label: string }[] = [
  { key: "chest", label: "Peito" },
  { key: "back", label: "Costas" },
  { key: "legs", label: "Pernas" },
  { key: "shoulders", label: "Ombros" },
  { key: "arms", label: "Braços" },
  { key: "core", label: "Core" },
  { key: "cardio", label: "Cardio" },
  { key: "mobility", label: "Mobilidade" },
];

type WorkoutTab = "plan" | "suggested" | "free";
type Step = "date" | "workout" | "summary" | "done";

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgoFrom(dateKey: string): number {
  const today = new Date();
  const [y, m, d] = dateKey.split("-").map(Number);
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const b = Date.UTC(y, m - 1, d);
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function humanDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(
    new Date(y, m - 1, d),
  );
}

const ERROR_COPY: Record<string, string> = {
  retro_window_exceeded: "Só dá para registrar treinos dos últimos 3 dias.",
  performed_at_in_future: "Essa data ainda não chegou.",
  honesty_confirmation_required: "Confirme que realizou o treino para continuar.",
  invalid_performed_at: "Data inválida. Escolha um dia dos últimos 3 dias.",
  rate_limit_exceeded: "Você já registrou vários treinos retroativos por hoje. Tente novamente mais tarde.",
  FEATURE_DISABLED_FOR_PLAN: "Este recurso não está disponível no seu plano.",
};

const CARD: React.CSSProperties = {
  background: "var(--color-surface, #fff)",
  border: "1px solid var(--color-border, var(--color-border))",
  borderRadius: "var(--radius-lg, 16px)",
  padding: "var(--space-4, 20px)",
  display: "grid",
  gap: "var(--space-3, 14px)",
};

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: "var(--radius-full, 999px)",
        border: `1px solid ${active ? "var(--color-primary, #2563EB)" : "var(--color-border, var(--color-border))"}`,
        background: active ? "var(--color-primary-soft, #EFF6FF)" : "transparent",
        color: active ? "var(--color-primary, #2563EB)" : "var(--color-text, var(--gray-900))",
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

export default function RetroWorkoutPage() {
  const navigate = useNavigate();

  const bounds = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const threeAgo = new Date(now);
    threeAgo.setDate(now.getDate() - 3);
    return { max: toDateKey(yesterday), min: toDateKey(threeAgo) };
  }, []);

  const [step, setStep] = useState<Step>("date");
  const [performedDate, setPerformedDate] = useState<string>(bounds.max);

  const [tab, setTab] = useState<WorkoutTab>("free");
  const [plans, setPlans] = useState<UserWorkoutPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [groups, setGroups] = useState<string[]>([]);

  const [status, setStatus] = useState<"completed" | "partial">("completed");
  const [rpe, setRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [hadDiscomfort, setHadDiscomfort] = useState(false);
  const [discomfortNote, setDiscomfortNote] = useState("");
  const [reason, setReason] = useState("");
  const [honesty, setHonesty] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateWorkoutSessionResult | null>(null);

  useEffect(() => {
    postRetroEvent("retro_workout.opened");
  }, []);

  // Carrega as fichas só quando a aba do personal é aberta (evita fetch à toa).
  useEffect(() => {
    if (tab !== "plan" || plansLoaded) return;
    fetchMyWorkoutPlans(20)
      .then((rows) => setPlans(rows.filter((p) => !p.abandoned_at)))
      .catch(() => setPlans([]))
      .finally(() => setPlansLoaded(true));
  }, [tab, plansLoaded]);

  const daysAgo = daysAgoFrom(performedDate);
  const willCountStreak = daysAgo <= 1;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const selectedDay: UserWorkoutPlanDay | null =
    selectedPlan?.days.find((d) => d.index === selectedDayIndex) ?? null;

  function workoutChosen(): boolean {
    if (tab === "plan") return Boolean(selectedDay);
    return groups.length > 0;
  }

  function toggleGroup(key: string) {
    setGroups((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  }

  function goToSummary() {
    if (!workoutChosen()) return;
    setStep("summary");
  }

  async function submit() {
    if (!honesty || submitting) return;
    setSubmitting(true);
    setError(null);

    const composedNotes = [notes.trim(), hadDiscomfort && discomfortNote.trim() ? `Desconforto: ${discomfortNote.trim()}` : ""]
      .filter(Boolean)
      .join(" · ") || null;

    const title =
      tab === "plan"
        ? `${selectedPlan?.title ?? "Ficha"} · ${selectedDay?.name ?? "Treino"}`
        : tab === "suggested"
          ? "Treino sugerido"
          : "Treino livre";

    const payload: CreateWorkoutSessionPayload = {
      source: tab === "plan" ? "personal" : tab === "suggested" ? "suggested" : "free",
      status,
      title,
      planId: tab === "plan" ? selectedPlan?.id ?? null : null,
      dayIndex: tab === "plan" ? selectedDay?.index ?? null : null,
      sessionRpe: rpe,
      notes: composedNotes,
      prescribed:
        tab === "plan" && selectedDay
          ? selectedDay.items.map((it) => ({
              exerciseId: it.exerciseId,
              name: it.name,
              sets: it.sets,
              reps: it.reps,
              rest: it.rest,
            }))
          : [],
      awardGamification: true,
      muscleGroups: tab === "plan" ? undefined : groups,
      performedAt: performedDate,
      confirmedHonesty: honesty,
      retroactiveReason: reason.trim() || undefined,
    };

    const outcome = await createWorkoutSessionWithError(payload);
    setSubmitting(false);

    if (outcome.ok) {
      setResult(outcome.data);
      postRetroEvent("retro_workout.submitted", {
        daysAgo,
        source: payload.source,
        countedForStreak: outcome.data.countedForStreak === true,
      });
      setStep("done");
      return;
    }

    setError(ERROR_COPY[outcome.errorCode] ?? "Não foi possível registrar. Tente novamente.");
    if (outcome.status === 429 || outcome.errorCode === "retro_window_exceeded") {
      postRetroEvent("retro_workout.blocked_over_limit", { reason: outcome.errorCode });
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-4, 20px)", display: "grid", gap: "var(--space-4, 20px)" }}>
      <header style={{ display: "grid", gap: 6 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          // 44px de alvo (SPEC §8 nomeia o botão voltar). O padding negativo à
          // esquerda mantém o texto alinhado à margem — cresce a área, não o
          // recuo visual.
          style={{ background: "none", border: "none", padding: "0 12px", margin: "0 -12px", minHeight: 44, display: "inline-flex", alignItems: "center", color: "var(--color-text-muted, var(--color-text-muted))", cursor: "pointer", justifySelf: "start", fontSize: 14 }}
        >
          ← Voltar
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--color-text, var(--gray-900))", margin: 0 }}>
          Registrar treino anterior
        </h1>
        <p style={{ color: "var(--color-text-soft, #4B5563)", margin: 0, fontSize: 15 }}>
          Treinou e esqueceu de marcar? Registre aqui — o histórico é seu mapa.
        </p>
      </header>

      {/* PASSO 1 — DATA */}
      {step === "date" && (
        <div style={CARD}>
          <label style={{ fontWeight: 700, color: "var(--color-text, var(--gray-900))" }}>Quando foi o treino?</label>
          <input
            type="date"
            value={performedDate}
            min={bounds.min}
            max={bounds.max}
            onChange={(e) => {
              setPerformedDate(e.target.value);
              postRetroEvent("retro_workout.date_selected", { daysAgo: daysAgoFrom(e.target.value) });
            }}
            style={{
              padding: "10px 12px",
              borderRadius: "var(--radius-md, 10px)",
              border: "1px solid var(--color-border, var(--color-border))",
              fontSize: 16,
              color: "var(--color-text, var(--gray-900))",
              background: "var(--color-surface, #fff)",
            }}
          />
          <p style={{ margin: 0, fontSize: 14, color: "var(--color-text-muted, var(--color-text-muted))" }}>
            {humanDate(performedDate)} · {daysAgo === 1 ? "ontem" : `${daysAgo} dias atrás`}
          </p>
          {!willCountStreak && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--color-warn, #D97706)" }}>
              Esse treino vai contar no seu histórico e na sua evolução, mas a sequência (streak) só é preservada
              registrando até o dia seguinte.
            </p>
          )}
          <button
            type="button"
            onClick={() => setStep("workout")}
            style={primaryBtn}
          >
            Continuar
          </button>
        </div>
      )}

      {/* PASSO 2 — QUAL TREINO */}
      {step === "workout" && (
        <div style={CARD}>
          <label style={{ fontWeight: 700, color: "var(--color-text, var(--gray-900))" }}>Qual treino você fez?</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill active={tab === "plan"} onClick={() => setTab("plan")}>Ficha do personal</Pill>
            <Pill active={tab === "suggested"} onClick={() => setTab("suggested")}>Treino sugerido</Pill>
            <Pill active={tab === "free"} onClick={() => setTab("free")}>Avulso</Pill>
          </div>

          {tab === "plan" ? (
            !plansLoaded ? (
              <p style={mutedText}>Carregando suas fichas...</p>
            ) : plans.length === 0 ? (
              <p style={mutedText}>Você não tem ficha ativa. Escolha “Avulso” ou “Treino sugerido”.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {plans.map((p) => (
                  <div key={p.id} style={{ display: "grid", gap: 6 }}>
                    <strong style={{ fontSize: 14, color: "var(--color-text, var(--gray-900))" }}>{p.title}</strong>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {p.days.map((d) => (
                        <Pill
                          key={d.index}
                          active={selectedPlanId === p.id && selectedDayIndex === d.index}
                          onClick={() => {
                            setSelectedPlanId(p.id);
                            setSelectedDayIndex(d.index);
                          }}
                        >
                          {d.name}
                        </Pill>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <span style={mutedText}>Marque os grupos que você treinou:</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MUSCLE_GROUPS.map((g) => (
                  <Pill key={g.key} active={groups.includes(g.key)} onClick={() => toggleGroup(g.key)}>
                    {g.label}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setStep("date")} style={secondaryBtn}>Voltar</button>
            <button type="button" onClick={goToSummary} disabled={!workoutChosen()} style={{ ...primaryBtn, opacity: workoutChosen() ? 1 : 0.5 }}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* PASSO 3 — RESUMO + HONESTIDADE */}
      {step === "summary" && (
        <div style={{ display: "grid", gap: "var(--space-4, 20px)" }}>
          <div style={CARD}>
            <label style={{ fontWeight: 700, color: "var(--color-text, var(--gray-900))" }}>Como foi o treino?</label>

            <span style={mutedText}>Você completou o treino?</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill active={status === "completed"} onClick={() => setStatus("completed")}>Completo</Pill>
              <Pill active={status === "partial"} onClick={() => setStatus("partial")}>Parcial</Pill>
            </div>

            <span style={mutedText}>Intensidade percebida</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {RPE_OPTIONS.map((o) => (
                <Pill key={o.rpe} active={rpe === o.rpe} onClick={() => setRpe(o.rpe)}>{o.label}</Pill>
              ))}
            </div>

            <label style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--color-text, var(--gray-900))", fontSize: 14 }}>
              <input type="checkbox" checked={hadDiscomfort} onChange={(e) => setHadDiscomfort(e.target.checked)} />
              Senti dor ou desconforto
            </label>
            {hadDiscomfort && (
              <input
                type="text"
                value={discomfortNote}
                onChange={(e) => setDiscomfortNote(e.target.value)}
                placeholder="Onde? (ex.: ombro direito)"
                style={inputStyle}
              />
            )}

            <span style={mutedText}>Observações (opcional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Algo que queira registrar sobre o treino"
              style={{ ...inputStyle, resize: "vertical" }}
            />

            <span style={mutedText}>Por que está registrando agora? (opcional)</span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: esqueci de marcar no dia"
              style={inputStyle}
            />
          </div>

          {/* Mensagem de honestidade */}
          <div style={{ ...CARD, background: "var(--color-primary-soft, #EFF6FF)", border: "1px solid var(--color-primary, #2563EB)" }}>
            <strong style={{ color: "var(--color-text, var(--gray-900))", fontSize: 16 }}>Você realmente realizou este treino?</strong>
            <p style={{ margin: 0, color: "var(--color-text-soft, #4B5563)", fontSize: 14, lineHeight: 1.5 }}>
              Seja honesto com você mesmo. O S2Core usa seus registros para acompanhar sua evolução, ajustar
              recomendações e projetar seus resultados. Registrar um treino que não aconteceu pode prejudicar sua
              própria jornada.
            </p>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "var(--color-text, var(--gray-900))", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={honesty} onChange={(e) => setHonesty(e.target.checked)} style={{ marginTop: 3 }} />
              Confirmo que realizei este treino de verdade.
            </label>
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, color: "var(--color-danger, #DC2626)", fontSize: 14 }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={() => setStep("workout")} style={secondaryBtn}>Voltar</button>
            <button
              type="button"
              onClick={submit}
              disabled={!honesty || submitting}
              style={{ ...primaryBtn, opacity: honesty && !submitting ? 1 : 0.5 }}
            >
              {submitting ? "Registrando..." : "Registrar treino"}
            </button>
          </div>
        </div>
      )}

      {/* PASSO 4 — SUCESSO */}
      {step === "done" && result && (
        <div style={{ ...CARD, textAlign: "center" }}>
          <strong style={{ fontSize: 18, color: "var(--color-success-text, #5E7412)" }}>Treino registrado ✓</strong>
          <p style={{ margin: 0, color: "var(--color-text-soft, #4B5563)", fontSize: 15, lineHeight: 1.5 }}>
            {result.countedForStreak
              ? `Registrado no seu histórico e sua sequência está de pé${result.streak != null ? `: ${result.streak} ${result.streak === 1 ? "dia" : "dias"}` : ""}.`
              : "Registrado no seu histórico. A sequência não muda em registros com mais de 1 dia — mas o que importa é que o treino aconteceu."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button type="button" onClick={() => navigate("/app/user/evolucao")} style={primaryBtn}>Ver no histórico</button>
            <button type="button" onClick={() => navigate("/app/user/today")} style={secondaryBtn}>Voltar ao início</button>
          </div>
        </div>
      )}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "var(--radius-md, 10px)",
  border: "none",
  background: "var(--action-primary, #5E7412)",
  color: "var(--color-cta-text, #fff)",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "var(--radius-md, 10px)",
  border: "1px solid var(--color-border, var(--color-border))",
  background: "transparent",
  color: "var(--color-text, var(--gray-900))",
  fontWeight: 600,
  fontSize: 15,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: "var(--radius-md, 10px)",
  border: "1px solid var(--color-border, var(--color-border))",
  fontSize: 15,
  color: "var(--color-text, var(--gray-900))",
  background: "var(--color-surface, #fff)",
  width: "100%",
};

const mutedText: React.CSSProperties = {
  fontSize: 13,
  color: "var(--color-text-muted, var(--color-text-muted))",
};

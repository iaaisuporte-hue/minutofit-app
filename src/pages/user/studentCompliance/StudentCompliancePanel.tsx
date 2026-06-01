import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { useFeatureFlags } from "../../../auth/FeatureFlagsContext";
import {
  buildRecommendation,
  loadAnswers,
  saveAnswers,
  saveRecommendation,
  setOnboardingDone,
  type OnboardingAnswers,
} from "../onboarding/onboardingStorage";
import { submitStudentCompliance } from "../../../services/authApi";
import { PARQ_FORM_VERSION } from "../../../services/complianceConstants";
import { PARQ_ITEMS } from "./parqQuestions";
import { useNeonTheme, type NeonTheme } from "../../../theme/minutofitNeonTheme";

type HealthField =
  | "sem_historico_hipertensao"
  | "sem_historico_cardiaco"
  | "sem_restricao_medica_exercicio"
  | "apto_para_atividade_fisica"
  | "aceita_responsabilidade_informacoes";

type Ob = {
  trainingPlace: OnboardingAnswers["trainingPlace"] | "";
  timePerDay: OnboardingAnswers["timePerDay"] | "";
  injuries: OnboardingAnswers["injuries"];
  surgeryRecent: OnboardingAnswers["surgeryRecent"] | "";
  frequentPain: OnboardingAnswers["frequentPain"] | "";
  daysPerWeek: OnboardingAnswers["daysPerWeek"] | 0;
  bestTime: OnboardingAnswers["bestTime"] | "";
  intensityPref: OnboardingAnswers["intensityPref"] | "";
  equipmentPref: OnboardingAnswers["equipmentPref"] | "";
  wantsCloseFollow: OnboardingAnswers["wantsCloseFollow"] | "";
};

const emptyOb = (): Ob => ({
  trainingPlace: "",
  timePerDay: "",
  injuries: [],
  surgeryRecent: "",
  frequentPain: "",
  daysPerWeek: 0,
  bestTime: "",
  intensityPref: "",
  equipmentPref: "",
  wantsCloseFollow: "",
});

/** Plano Free não exibe onboarding; enviamos valores neutros válidos para o backend. */
const DEFAULT_FREE_ONBOARDING: OnboardingAnswers = {
  trainingPlace: "home",
  timePerDay: "20-30",
  injuries: ["none"],
  surgeryRecent: "no",
  frequentPain: "no",
  daysPerWeek: 3,
  bestTime: "variable",
  intensityPref: "progressive",
  equipmentPref: "both",
  wantsCloseFollow: "no",
};

function pillStyle(active: boolean, neon: NeonTheme) {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? neon.accentBorder : neon.border}`,
    background: active ? neon.accentSoft : "#FAFAFA",
    color: neon.text,
    cursor: "pointer" as const,
    fontWeight: 600,
    minHeight: 44,
    boxShadow: active ? `inset 0 0 0 2px ${neon.strokeStrong}` : undefined,
  };
}

function SelectGroup<T extends string | number>({
  value,
  options,
  onSelect,
  disabled,
  neon,
}: {
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onSelect: (value: T) => void;
  disabled?: boolean;
  neon: NeonTheme;
}) {
  return (
    <div
      role="group"
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        maxWidth: "100%",
        paddingBottom: 2,
      }}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onSelect(option.value)}
            style={{
              ...pillStyle(selected, neon),
              opacity: disabled ? 0.55 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
              touchAction: "manipulation",
            }}
          >
            {selected ? "✓ " : ""}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SignatureCanvas({
  disabled,
  onStrokeChange,
  neon,
}: {
  disabled?: boolean;
  onStrokeChange: (hasInk: boolean) => void;
  neon: NeonTheme;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  const setupCanvas = useCallback(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Aguarda layout — o ResizeObserver rechamará quando a largura estiver disponível
    if (rect.width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(160 * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
  }, []);

  useEffect(() => {
    setupCanvas();
    const ro = new ResizeObserver(() => setupCanvas());
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement);
    return () => ro.disconnect();
  }, [setupCanvas]);

  // Listeners non-passive no DOM — bypass do sistema passivo do React 17+
  // sem isso, e.preventDefault() dentro dos handlers sintéticos é ignorado
  // e o scroll do parent compete com o desenho no celular.
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    function posFromTouch(touch: Touch): { x: number; y: number } {
      const r = canvas!.getBoundingClientRect();
      return { x: touch.clientX - r.left, y: touch.clientY - r.top };
    }

    function onTouchStart(e: TouchEvent) {
      if (disabledRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      drawing.current = true;
      last.current = posFromTouch(t);
      onStrokeChange(true);
    }

    function onTouchMove(e: TouchEvent) {
      if (!drawing.current || disabledRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      const ctx = canvas!.getContext("2d");
      if (!ctx || !last.current) return;
      const p = posFromTouch(t);
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
    }

    function onTouchEnd() {
      drawing.current = false;
      last.current = null;
    }

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("touchcancel", onTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onStrokeChange]);

  function pos(e: React.MouseEvent) {
    const canvas = ref.current!;
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function startMouse(e: React.MouseEvent) {
    if (disabled) return;
    drawing.current = true;
    last.current = pos(e);
    onStrokeChange(true);
  }

  function drawMouse(e: React.MouseEvent) {
    if (!drawing.current || disabled) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function endMouse() {
    drawing.current = false;
    last.current = null;
  }

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Área de assinatura"
      style={{
        display: "block",
        width: "100%",
        height: 160,
        borderRadius: 12,
        border: `1px solid ${neon.border}`,
        background: "rgba(0,0,0,.35)",
        touchAction: "none",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "crosshair",
      }}
      onMouseDown={startMouse}
      onMouseMove={drawMouse}
      onMouseUp={endMouse}
      onMouseLeave={endMouse}
    />
  );
}

const injuryOptions: Array<{ value: OnboardingAnswers["injuries"][number]; label: string }> = [
  { value: "none", label: "Nenhuma" },
  { value: "joelho", label: "Joelho" },
  { value: "ombro", label: "Ombro" },
  { value: "lombar", label: "Lombar" },
  { value: "tornozelo", label: "Tornozelo" },
  { value: "outra", label: "Outra" },
];

export default function StudentCompliancePanel() {
  const neon = useNeonTheme();
  const { planName } = useFeatureFlags();
  const isFreePlan = (planName || "").toLowerCase() === "free";
  const { user, getUser } = useAuth();
  const locked = Boolean(user?.studentComplianceComplete);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSignatureInk, setHasSignatureInk] = useState(false);

  const [healthFlags, setHealthFlags] = useState<Record<HealthField, boolean>>({
    sem_historico_hipertensao: false,
    sem_historico_cardiaco: false,
    sem_restricao_medica_exercicio: false,
    apto_para_atividade_fisica: false,
    aceita_responsabilidade_informacoes: false,
  });

  const [onb, setOnb] = useState<Ob>(emptyOb());
  const [parq, setParq] = useState<Record<string, boolean | null>>(() =>
    Object.fromEntries(PARQ_ITEMS.map((q) => [q.id, null as boolean | null])),
  );

  useEffect(() => {
    if (!user) return;
    const uid = String(user.id);
    if (user.onboardingAnswers) {
      const o = user.onboardingAnswers as unknown as Ob;
      setOnb({
        trainingPlace: (o.trainingPlace as Ob["trainingPlace"]) || "",
        timePerDay: (o.timePerDay as Ob["timePerDay"]) || "",
        injuries: Array.isArray(o.injuries) ? (o.injuries as OnboardingAnswers["injuries"]) : [],
        surgeryRecent: (o.surgeryRecent as Ob["surgeryRecent"]) || "",
        frequentPain: (o.frequentPain as Ob["frequentPain"]) || "",
        daysPerWeek: (o.daysPerWeek as Ob["daysPerWeek"]) || 0,
        bestTime: (o.bestTime as Ob["bestTime"]) || "",
        intensityPref: (o.intensityPref as Ob["intensityPref"]) || "",
        equipmentPref: (o.equipmentPref as Ob["equipmentPref"]) || "",
        wantsCloseFollow: (o.wantsCloseFollow as Ob["wantsCloseFollow"]) || "",
      });
    } else {
      const local = loadAnswers(uid);
      if (local) {
        setOnb({
          trainingPlace: local.trainingPlace,
          timePerDay: local.timePerDay,
          injuries: local.injuries,
          surgeryRecent: local.surgeryRecent,
          frequentPain: local.frequentPain,
          daysPerWeek: local.daysPerWeek,
          bestTime: local.bestTime,
          intensityPref: local.intensityPref,
          equipmentPref: local.equipmentPref,
          wantsCloseFollow: local.wantsCloseFollow,
        });
      }
    }

    if (user.healthFlags) {
      const h = user.healthFlags;
      setHealthFlags({
        sem_historico_hipertensao: !!h.semHistoricoHipertensao,
        sem_historico_cardiaco: !!h.semHistoricoCardiaco,
        sem_restricao_medica_exercicio: !!h.semRestricaoMedicaExercicio,
        apto_para_atividade_fisica: !!h.aptoParaAtividadeFisica,
        aceita_responsabilidade_informacoes: !!h.aceitaResponsabilidadeInformacoes,
      });
    }

    if (user.parqAnswers && user.parqAnswers.length) {
      const next: Record<string, boolean | null> = {};
      for (const q of PARQ_ITEMS) next[q.id] = null;
      for (const row of user.parqAnswers) {
        if (row && typeof row.id === "string" && typeof row.yes === "boolean") {
          next[row.id] = row.yes;
        }
      }
      setParq(next);
    }
  }, [user]);

  function toggleInjury(injury: OnboardingAnswers["injuries"][number]) {
    setOnb((current) => {
      const selected = current.injuries;
      let next: OnboardingAnswers["injuries"];
      if (injury === "none") {
        next = ["none"];
      } else {
        const withoutNone = selected.filter((item) => item !== "none");
        next = withoutNone.includes(injury)
          ? (withoutNone.filter((item) => item !== injury) as OnboardingAnswers["injuries"])
          : ([...withoutNone, injury] as OnboardingAnswers["injuries"]);
      }
      return { ...current, injuries: next.length ? next : [] };
    });
  }

  const validationError = useMemo(() => {
    if (!healthFlags.sem_historico_hipertensao) return "Marque todas as declarações de saúde (primeiro bloco).";
    if (!healthFlags.sem_historico_cardiaco) return "Marque todas as declarações de saúde (primeiro bloco).";
    if (!healthFlags.sem_restricao_medica_exercicio) return "Marque todas as declarações de saúde (primeiro bloco).";
    if (!healthFlags.apto_para_atividade_fisica) return "Confirme aptidão para atividade física.";
    if (!healthFlags.aceita_responsabilidade_informacoes) return "Aceite a declaração de responsabilidade.";
    if (!isFreePlan) {
      if (!onb.trainingPlace) return "Escolha onde você treina.";
      if (!onb.timePerDay) return "Escolha o tempo disponível por dia.";
      if (!onb.daysPerWeek) return "Escolha a frequência semanal.";
      if (!onb.bestTime) return "Escolha o melhor horário.";
      if (!onb.equipmentPref) return "Escolha a preferência de equipamento.";
      if (!onb.intensityPref) return "Escolha a intensidade.";
      if (!onb.wantsCloseFollow) return "Informe se deseja acompanhamento mais próximo.";
      if (!onb.surgeryRecent) return "Informe sobre cirurgia recente.";
      if (!onb.frequentPain) return "Informe sobre dor ao treinar.";
      if (!onb.injuries.length) return "Selecione ao menos uma opção de lesões (pode ser Nenhuma).";
    }
    for (const q of PARQ_ITEMS) {
      if (parq[q.id] === null) return "Responda todas as perguntas do PAR-Q (Sim ou Não).";
    }
    if (!hasSignatureInk) return "Assine no quadro com o dedo ou mouse.";
    return null;
  }, [healthFlags, onb, parq, hasSignatureInk, isFreePlan]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    const dataUrl = canvas?.toDataURL("image/png") || "";
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) return;

    const onboardingAnswers: OnboardingAnswers = isFreePlan
      ? DEFAULT_FREE_ONBOARDING
      : {
          trainingPlace: onb.trainingPlace as OnboardingAnswers["trainingPlace"],
          timePerDay: onb.timePerDay as OnboardingAnswers["timePerDay"],
          injuries: onb.injuries,
          surgeryRecent: onb.surgeryRecent as OnboardingAnswers["surgeryRecent"],
          frequentPain: onb.frequentPain as OnboardingAnswers["frequentPain"],
          daysPerWeek: onb.daysPerWeek as OnboardingAnswers["daysPerWeek"],
          bestTime: onb.bestTime as OnboardingAnswers["bestTime"],
          intensityPref: onb.intensityPref as OnboardingAnswers["intensityPref"],
          equipmentPref: onb.equipmentPref as OnboardingAnswers["equipmentPref"],
          wantsCloseFollow: onb.wantsCloseFollow as OnboardingAnswers["wantsCloseFollow"],
        };

    const parqAnswers = PARQ_ITEMS.map((q) => ({ id: q.id, yes: parq[q.id] === true }));

    setSaving(true);
    try {
      await submitStudentCompliance({
        healthFlags,
        onboardingAnswers,
        parqAnswers,
        parqSignatureDataUrl: dataUrl,
        parqFormVersion: PARQ_FORM_VERSION,
      });
      const uid = String(user.id);
      saveAnswers(onboardingAnswers, uid);
      saveRecommendation(buildRecommendation(onboardingAnswers), uid);
      setOnboardingDone(uid);
      await getUser();
      setMessage(
        isFreePlan
          ? "Dados salvos. Obrigado por completar triagem e PAR-Q."
          : "Dados salvos. Obrigado por completar triagem, onboarding e PAR-Q.",
      );
      setHasSignatureInk(false);
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  function clearCanvas() {
    const canvas = canvasWrapRef.current?.querySelector("canvas");
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignatureInk(false);
  }

  if (!user || user.role !== "user") {
    return null;
  }

  return (
    <div
      id="compliance"
      style={{
        border: `1px solid ${locked ? neon.border : neon.accentBorder}`,
        borderRadius: 16,
        background: locked ? neon.panel : `linear-gradient(180deg, ${neon.accentSoft}, transparent 40%), ${neon.panel}`,
        padding: 16,
        display: "grid",
        gap: 14,
        color: neon.text,
        minWidth: 0,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Saúde, treino e PAR-Q</div>
        <div style={{ color: neon.muted, fontSize: 13, marginTop: 6, lineHeight: 1.45 }}>
          {isFreePlan ? (
            <>
              Obrigatório para uso do app: declarações de saúde e questionário PAR-Q com assinatura digital. Texto orientativo —
              consulte profissional de saúde e assessoria jurídica.
            </>
          ) : (
            <>
              Obrigatório para uso do app: declarações de saúde, preferências de treino (onboarding) e questionário PAR-Q com
              assinatura digital. Texto orientativo — consulte profissional de saúde e assessoria jurídica.
            </>
          )}
        </div>
      </div>

      {locked ? (
        <div style={{ color: neon.muted, fontSize: 14 }}>
          Seu cadastro de compliance está completo.
          {user.parqAnyYes ? (
            <div style={{ marginTop: 10, color: neon.danger, fontWeight: 600 }}>
              Você respondeu “sim” a pelo menos uma pergunta do PAR-Q. Recomenda-se liberação médica antes de intensificar o treino.
            </div>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 18 }}>
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ fontWeight: 600 }}>Declarações de saúde</div>
          {(
            [
              ["sem_historico_hipertensao", "Sem histórico de hipertensão."],
              ["sem_historico_cardiaco", "Sem histórico cardíaco relevante."],
              ["sem_restricao_medica_exercicio", "Sem restrição médica atual para exercícios."],
              ["apto_para_atividade_fisica", "Declaro que estou apto para iniciar atividade física."],
              ["aceita_responsabilidade_informacoes", "Confirmo que as informações são verdadeiras e de minha responsabilidade."],
            ] as const
          ).map(([key, label]) => (
            <label key={key} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 10, alignItems: "start" }}>
              <input
                type="checkbox"
                checked={healthFlags[key]}
                onChange={(ev) => setHealthFlags((h) => ({ ...h, [key]: ev.target.checked }))}
                disabled={saving || locked}
              />
              <span>{label}</span>
            </label>
          ))}
        </section>

        {!isFreePlan ? (
        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>Onboarding de treino</div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Onde você treina?</div>
            <SelectGroup neon={neon}
              value={onb.trainingPlace}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, trainingPlace: v }))}
              options={[
                { value: "home", label: "Em casa" },
                { value: "gym", label: "Academia" },
                { value: "both", label: "Ambos" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Tempo por dia</div>
            <SelectGroup neon={neon}
              value={onb.timePerDay}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, timePerDay: v }))}
              options={[
                { value: "10-15", label: "10–15 min" },
                { value: "20-30", label: "20–30 min" },
                { value: "30-45", label: "30–45 min" },
                { value: "60+", label: "60+ min" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Dias por semana</div>
            <SelectGroup neon={neon}
              value={onb.daysPerWeek}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, daysPerWeek: v }))}
              options={[
                { value: 2, label: "2x" },
                { value: 3, label: "3x" },
                { value: 4, label: "4x" },
                { value: 5, label: "5x" },
                { value: 6, label: "6x" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Melhor horário</div>
            <SelectGroup neon={neon}
              value={onb.bestTime}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, bestTime: v }))}
              options={[
                { value: "morning", label: "Manhã" },
                { value: "afternoon", label: "Tarde" },
                { value: "night", label: "Noite" },
                { value: "variable", label: "Variável" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Equipamento</div>
            <SelectGroup neon={neon}
              value={onb.equipmentPref}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, equipmentPref: v }))}
              options={[
                { value: "weights", label: "Com pesos" },
                { value: "no_weights", label: "Sem pesos" },
                { value: "both", label: "Ambos" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Intensidade</div>
            <SelectGroup neon={neon}
              value={onb.intensityPref}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, intensityPref: v }))}
              options={[
                { value: "intense", label: "Intensa" },
                { value: "progressive", label: "Progressiva" },
                { value: "any", label: "Qualquer" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Acompanhamento próximo</div>
            <SelectGroup neon={neon}
              value={onb.wantsCloseFollow}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, wantsCloseFollow: v }))}
              options={[
                { value: "yes", label: "Sim" },
                { value: "no", label: "Não" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Lesões / limitações</div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                maxWidth: "100%",
                paddingBottom: 2,
              }}
            >
              {injuryOptions.map((option) => {
                const selected = onb.injuries.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={saving || locked}
                    aria-pressed={selected}
                    onClick={() => toggleInjury(option.value)}
                    style={{ ...pillStyle(selected, neon), touchAction: "manipulation" }}
                  >
                    {selected ? "✓ " : ""}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Cirurgia recente</div>
            <SelectGroup neon={neon}
              value={onb.surgeryRecent}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, surgeryRecent: v }))}
              options={[
                { value: "no", label: "Não" },
                { value: "yes", label: "Sim" },
              ]}
            />
          </div>
          <div>
            <div style={{ color: neon.muted, fontSize: 12, marginBottom: 6 }}>Dor frequente ao treinar</div>
            <SelectGroup neon={neon}
              value={onb.frequentPain}
              disabled={saving || locked}
              onSelect={(v) => setOnb((o) => ({ ...o, frequentPain: v }))}
              options={[
                { value: "no", label: "Não" },
                { value: "sometimes", label: "Às vezes" },
                { value: "often", label: "Com frequência" },
              ]}
            />
          </div>
        </section>
        ) : null}

        <section style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 600 }}>PAR-Q ({PARQ_FORM_VERSION})</div>
          {PARQ_ITEMS.map((q) => (
            <div key={q.id} style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>{q.text}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  disabled={saving || locked}
                  aria-pressed={parq[q.id] === false}
                  onClick={() => setParq((p) => ({ ...p, [q.id]: false }))}
                  style={{ ...pillStyle(parq[q.id] === false, neon), touchAction: "manipulation" }}
                >
                  {parq[q.id] === false ? "✓ " : ""}Não
                </button>
                <button
                  type="button"
                  disabled={saving || locked}
                  aria-pressed={parq[q.id] === true}
                  onClick={() => setParq((p) => ({ ...p, [q.id]: true }))}
                  style={{ ...pillStyle(parq[q.id] === true, neon), touchAction: "manipulation" }}
                >
                  {parq[q.id] === true ? "✓ " : ""}Sim
                </button>
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Assinatura digital</div>
          <div style={{ color: neon.muted, fontSize: 12 }}>
            Ao assinar, você confirma que leu e respondeu o PAR-Q acima. Versão registrada: {PARQ_FORM_VERSION}.
          </div>
          <div ref={canvasWrapRef}>
            <SignatureCanvas disabled={saving || locked} onStrokeChange={setHasSignatureInk} neon={neon} />
          </div>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={saving || locked}
            style={{ ...pillStyle(false, neon), width: "fit-content" }}
          >
            Limpar assinatura
          </button>
        </section>

        {error ? <div style={{ color: neon.danger, fontSize: 14 }}>{error}</div> : null}
        {message ? <div style={{ color: neon.muted, fontSize: 14 }}>{message}</div> : null}

        {!locked ? (
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              border: `1px solid ${neon.accentBorder}`,
              background: neon.ctaGradient,
              color: neon.ctaText,
              fontWeight: 600,
              cursor: saving ? "wait" : "pointer",
              minHeight: 44,
            }}
          >
            {saving ? "Salvando…" : isFreePlan ? "Salvar triagem e PAR-Q" : "Salvar triagem, onboarding e PAR-Q"}
          </button>
        ) : null}
      </form>
    </div>
  );
}

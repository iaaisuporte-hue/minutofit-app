import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchMyWorkoutPlans,
  type UserWorkoutPlan,
  type UserWorkoutPlanDay,
  type UserWorkoutPlanItem,
} from "../../services/userWorkoutPlansApi";
import { getExercisesBatch, type Exercise } from "../../services/exercisesApi";
import { getWorkoutStats } from "../../services/workoutSessionApi";
import { useFeatureFlags } from "../../auth/FeatureFlagsContext";
import { useAdaptiveTraining } from "../../features/training/adaptive/useAdaptiveTraining";
import { ExerciseDemoModal } from "./components/ExerciseDemoModal";
import {
  prescribedWorkoutTitle,
  registerFreeWorkoutSession,
  registerWorkoutSession,
  type RegisterSessionStatus,
} from "./workoutSession/registerWorkoutSession";
import { useRestTimer } from "./workoutSession/useRestTimer";
import {
  clearDraft,
  clearFreeDraft,
  loadDraft,
  loadFreeDraft,
  saveDraft,
  saveFreeDraft,
  type DraftExercise,
  type FreeSessionDraft,
  type SessionDraft,
} from "./workoutSession/sessionDraft";
import { LiveExerciseSheet } from "./freeWorkout/LiveExerciseSheet";
import type { PickedExercise } from "./freeWorkout/FreeExercisePickerSheet";
import {
  addLiveExercise,
  moveLiveExercise,
  removeLiveExercise,
  type LiveSessionResult,
  type LiveSessionState,
} from "./freeWorkout/liveSessionOps";
import { freeWorkoutTitle } from "../../features/training/freeWorkout/muscleGroupMap";
import { findFilledUnchecked, markFilledDone } from "./workoutSession/filledSets";
import { SetActionBar } from "./workoutSession/SetActionBar";
import { serieAtual } from "./workoutSession/setSteppers";
import { ExerciseHistorySheet } from "./workoutSession/ExerciseHistorySheet";
import { postWorkoutEvent } from "./workoutSession/workoutEvents";
import { agendarAvisoDescanso, cancelarAvisoDescanso } from "./workoutSession/restNotification";
import { computeSessionComparison, deriveFatigueInsight } from "./workoutSession/sessionSummary";
import { WorkoutShareTrigger } from "./components/WorkoutShareTrigger";
import { splitShareTitle } from "./lib/sessionShareData";
import { PrCelebration, type PrEventSummary } from "../../features/performance/PrCelebration";
import "../../features/performance/performance.css";
import "./workoutSession/workoutSession.css";

// ── helpers de parsing (espelham o backend p/ contagem de séries / rest) ──
function parseSetCount(s?: string): number {
  if (!s) return 1;
  const t = String(s).trim();
  if (t.includes(",")) return Math.min(12, Math.max(1, t.split(",").length));
  const n = parseInt(t, 10);
  return Math.min(12, Math.max(1, Number.isFinite(n) ? n : 1));
}
function leadingInt(s?: string | null): number | null {
  if (s == null) return null;
  const m = String(s).match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}
function parseNum(v: string): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function fmtClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function pickMediaUrl(ex: Exercise | undefined | null): string | null {
  if (!ex?.media?.length) return null;
  const gif = ex.media.find((m) => m.mediaType === "gif" || m.url.toLowerCase().includes(".gif"));
  const image = ex.media.find((m) => m.mediaType === "image");
  const primary = ex.media.find((m) => m.isPrimary) ?? ex.media[0];
  const chosen = gif ?? image ?? primary;
  return chosen && (chosen.mediaType === "gif" || chosen.mediaType === "image") ? chosen.url : null;
}

function buildExercises(items: UserWorkoutPlanItem[]): DraftExercise[] {
  return items.map((it) => {
    const count = parseSetCount(it.sets);
    const restS = leadingInt(it.rest);
    return {
      exerciseId: it.exerciseId ?? null,
      name: it.name,
      biSetGroupId: it.technique?.type === "bi_set" ? it.technique.biSetGroupId ?? null : null,
      sets: Array.from({ length: count }, (_, i) => ({
        setIndex: i + 1,
        plannedReps: it.reps,
        plannedRestS: restS,
        loadKg: "",
        reps: "",
        done: false,
        restDoneS: null,
        completedAt: null,
      })),
    };
  });
}

type Phase = "loading" | "empty" | "running" | "summary";

/** Montagem do treino livre — destino de quem chega na sessão sem rascunho. */
const FREE_SETUP_ROUTE = "/app/user/treino-livre";

const RPE_OPTIONS = [
  { label: "Leve", rpe: 3 },
  { label: "Moderado", rpe: 6 },
  { label: "Intenso", rpe: 8 },
  { label: "Máximo", rpe: 10 },
];

export default function WorkoutSessionPage() {
  const navigate = useNavigate();
  const params = useParams();
  const planId = Number(params.planId);
  const dayIndex = Number(params.dayIndex);
  // Mesma engine nos dois modos: sem :planId na rota é treino livre. Tudo que
  // difere passa por este booleano — o caminho da ficha continua idêntico.
  const isFree = params.planId === undefined;

  const [phase, setPhase] = useState<Phase>("loading");
  const [plan, setPlan] = useState<UserWorkoutPlan | null>(null);
  const [day, setDay] = useState<UserWorkoutPlanDay | null>(null);
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [prevLoad, setPrevLoad] = useState<Map<string, number>>(new Map());
  const [exMedia, setExMedia] = useState<Map<string, string>>(new Map());
  // Spec 022: uuid do exercício → perfil de captura do Lab (quando mapeado).
  const [exLab, setExLab] = useState<Map<string, string>>(new Map());
  const { hasFeature } = useFeatureFlags();
  const canGuidedLab = hasFeature("movement_lab_guided");
  const [demoName, setDemoName] = useState<string | null>(null);
  /** Exercício cujo histórico rápido está aberto (§27). */
  const [histFor, setHistFor] = useState<{ id: string; name: string } | null>(null);
  const [showExit, setShowExit] = useState(false);
  const [showUnchecked, setShowUnchecked] = useState(false);
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  // P1-3: desconforto/dor por exercício (índice na lista) — sinal de recuperação
  // capturado no resumo, sem poluir as linhas de série. Alimenta workout_set_logs.discomfort.
  const [discomfortEx, setDiscomfortEx] = useState<Set<number>>(() => new Set());
  const [finishing, setFinishing] = useState(false);
  const [prEvents, setPrEvents] = useState<PrEventSummary[]>([]);
  const [saved, setSaved] = useState(false);
  // Só treino livre: edição da lista em andamento, falha de gravação e confirmação
  // do descarte (aqui o rascunho é a única cópia da sessão).
  const [showManage, setShowManage] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [confirmFreeDiscard, setConfirmFreeDiscard] = useState(false);
  const freeClientKey = useRef<string | null>(null);
  /**
   * Trava a gravação do rascunho depois que a sessão foi finalizada.
   *
   * O descanso sobrevive à finalização, e o `onComplete` do cronômetro chama
   * `finalizeRest` → `persist`: sem esta trava, um timer que estoura DEPOIS do
   * `clearDraft` regrava o treino que acabou de ser salvo. O aluno então volta
   * à ficha e "Iniciar treino" reabre a sessão inteira já marcada, como se não
   * tivesse sido concluída. Vale para os dois modos (QA ago/2026): no livre a
   * montagem oferecia "retomar" algo já no histórico; no prescrito o rascunho
   * ressuscitava — defeito antigo, mesma causa, corrigido junto por ser a
   * mesma linha de código.
   */
  const sessionSaved = useRef(false);

  /** Evita emitir `workout.started` duas vezes no mesmo mount. */
  const inicioEmitido = useRef(false);

  /**
   * Guarda de duplo toque em "Concluir série" (SPEC P1 §47).
   *
   * `toggleDone` ALTERNA — dois toques rápidos marcam e desmarcam, e o segundo
   * ainda cancelaria o descanso que o primeiro acabou de iniciar. Com o botão
   * grande do rodapé isso deixa de ser hipótese: ele é largo e fica embaixo do
   * polegar. A janela cobre o toque repetido sem impedir quem realmente quer
   * desmarcar a série logo em seguida.
   */
  const ultimoToqueSerie = useRef<{ key: string; at: number } | null>(null);

  /**
   * Relógio da sessão (§4). Um tique por segundo, e só enquanto a aba está
   * visível — o valor é derivado de `startedAt`, então voltar do segundo plano
   * mostra o tempo certo sem precisar ter contado nada enquanto esteve fora.
   */
  /**
   * Indicador de conexão da sessão (SPEC P1 §49).
   *
   * O banner global de offline existe, mas fala do app; aqui a informação que
   * importa é outra e mais tranquilizadora: as séries continuam sendo gravadas
   * NO APARELHO. Quem está treinando sem sinal precisa saber que não está
   * perdendo o treino — desde o P0 isso é verdade, mas nada dizia.
   *
   * "Sincronizado" aparece por alguns segundos ao reconectar e some: a §24 da
   * P1 pede estado discreto, não um selo permanente.
   */
  const [offline, setOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );
  const [reconectou, setReconectou] = useState(false);
  useEffect(() => {
    const caiu = () => { setOffline(true); setReconectou(false); };
    const voltou = () => {
      setOffline((estavaOffline) => {
        if (estavaOffline) {
          setReconectou(true);
          window.setTimeout(() => setReconectou(false), 4000);
        }
        return false;
      });
    };
    window.addEventListener("offline", caiu);
    window.addEventListener("online", voltou);
    return () => {
      window.removeEventListener("offline", caiu);
      window.removeEventListener("online", voltou);
    };
  }, []);

  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 1000);
    const onVis = () => { if (document.visibilityState === "visible") setAgora(Date.now()); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Desligado no livre: não há ficha para adaptar, e o hook fica em idle
  // (loading:false, data:null) sem disparar requisição.
  const adaptive = useAdaptiveTraining(!isFree);
  const restCtx = useRef<{ exIdx: number; setIdx: number; planned: number; endsAt: number } | null>(null);
  const currentIndexRef = useRef(0);
  const startedAtRef = useRef(Date.now());
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    startedAtRef.current = startedAt;
  }, [startedAt]);

  /**
   * `workout.started` / `workout.resumed` (§51).
   *
   * Emitido quando a sessão entra em execução, e distinguindo os dois casos
   * pelo que o rascunho trazia: com séries já marcadas é retomada, não início.
   * A distinção é o que permite responder "quantos usuários iniciam e concluem
   * treino" (§52) sem contar a mesma sessão duas vezes.
   */
  useEffect(() => {
    if (phase !== "running" || inicioEmitido.current) return;
    inicioEmitido.current = true;
    const jaTinhaSerie = exercises.some((ex) => ex.sets.some((x) => x.done));
    postWorkoutEvent(jaTinhaSerie ? "workout.resumed" : "workout.started", {
      mode: isFree ? "free" : "plan",
      totalExercises: exercises.length,
    });
    if (isFree && !jaTinhaSerie) postWorkoutEvent("workout.free_started", { mode: "free" });
  }, [phase, exercises, isFree]);

  // Aplica itens adaptados quando o motor adaptou ESTE dia hoje (mesma regra da ficha).
  const resolvedItems = useMemo<UserWorkoutPlanItem[] | null>(() => {
    if (!day) return null;
    const ad = adaptive.data;
    if (ad?.adaptationEnabled && ad.changes.length && ad.adaptedPlanDay.index === day.index) {
      return ad.adaptedPlanDay.items as UserWorkoutPlanItem[];
    }
    return day.items ?? [];
  }, [day, adaptive.data]);

  // ── persistência do rascunho ──────────────────────────
  const persist = useCallback(
    (exs: DraftExercise[], idx: number, started: number) => {
      // Sessão já finalizada não volta a gravar rascunho — ver `sessionSaved`.
      if (sessionSaved.current) return;

      const ctx = restCtx.current;
      const restEndsAt = ctx?.endsAt ?? null;
      const restForKey = ctx ? `${ctx.exIdx}:${ctx.setIdx}` : null;

      if (isFree) {
        const clientKey = freeClientKey.current;
        // Sem a chave o rascunho perderia a idempotência do envio — melhor não
        // gravar do que gravar um treino que pode duplicar no retry.
        if (!clientKey) return;
        const freeDraft: FreeSessionDraft = {
          version: 1,
          mode: "free",
          startedAt: started,
          currentIndex: idx,
          exercises: exs,
          restEndsAt,
          restForKey,
          clientKey,
        };
        saveFreeDraft(freeDraft);
        return;
      }

      const draft: SessionDraft = {
        version: 1,
        planId,
        dayIndex,
        startedAt: started,
        currentIndex: idx,
        exercises: exs,
        restEndsAt,
        restForKey,
      };
      saveDraft(draft);
    },
    [isFree, planId, dayIndex],
  );

  // grava restDoneS na série que disparou o descanso
  const finalizeRest = useCallback(
    (spent: number) => {
      const ctx = restCtx.current;
      restCtx.current = null;
      // O descanso acabou (naturalmente ou pulado): o aviso agendado no sistema
      // não tem mais razão de tocar. Sem isto, pular o descanso e sair do app
      // renderia uma notificação para uma série já feita.
      void cancelarAvisoDescanso();
      if (!ctx) return;
      setExercises((prev) => {
        const next = prev.map((ex, i) =>
          i === ctx.exIdx
            ? {
                ...ex,
                sets: ex.sets.map((s) => (s.setIndex === ctx.setIdx ? { ...s, restDoneS: spent } : s)),
              }
            : ex,
        );
        persist(next, currentIndexRef.current, startedAtRef.current);
        return next;
      });
    },
    [persist],
  );

  const rest = useRestTimer({ onComplete: () => finalizeRest(restCtx.current?.planned ?? 0) });

  // ── carga: busca plano + dia ──────────────────────────
  useEffect(() => {
    if (isFree) return; // sem ficha para buscar
    let alive = true;
    if (!Number.isFinite(planId) || !Number.isFinite(dayIndex)) {
      setPhase("empty");
      return;
    }
    fetchMyWorkoutPlans()
      .then((plans) => {
        if (!alive) return;
        const p = plans.find((x) => x.id === planId) ?? null;
        const d = p?.days?.find((x) => x.index === dayIndex) ?? null;
        setPlan(p);
        setDay(d);
        if (!p || !d || !(d.items?.length)) setPhase("empty");
      })
      .catch(() => alive && setPhase("empty"));
    return () => {
      alive = false;
    };
  }, [isFree, planId, dayIndex]);

  // ── monta sessão (retoma rascunho se houver) — espera adaptação resolver ──
  useEffect(() => {
    if (phase !== "loading") return;

    if (isFree) {
      const draft = loadFreeDraft();
      // O rascunho É o treino livre: sem ele não há o que executar. Mandar montar
      // é mais honesto que a tela de "treino indisponível", que fala de ficha.
      if (!draft || !draft.exercises.length) {
        navigate(FREE_SETUP_ROUTE, { replace: true });
        return;
      }
      freeClientKey.current = draft.clientKey;
      setExercises(draft.exercises);
      setCurrentIndex(Math.min(Math.max(0, draft.currentIndex), draft.exercises.length - 1));
      setStartedAt(draft.startedAt);
      if (draft.restForKey && draft.restEndsAt && draft.restEndsAt > Date.now()) {
        const [exIdx, setIdx] = draft.restForKey.split(":").map(Number);
        const remaining = Math.round((draft.restEndsAt - Date.now()) / 1000);
        const planned = draft.exercises[exIdx]?.sets[setIdx - 1]?.plannedRestS ?? remaining;
        restCtx.current = { exIdx, setIdx, planned, endsAt: draft.restEndsAt };
        rest.start(remaining);
      }
      setPhase("running");
      return;
    }

    if (!plan || !day || !resolvedItems) return;
    if (adaptive.loading) return; // aguarda p/ não montar com prescrito errado

    const fresh = buildExercises(resolvedItems);
    const draft = loadDraft(planId, dayIndex);
    if (draft && draft.exercises.length === fresh.length) {
      setExercises(draft.exercises);
      setCurrentIndex(Math.min(draft.currentIndex, draft.exercises.length - 1));
      setStartedAt(draft.startedAt);
      // retoma descanso ativo
      if (draft.restForKey && draft.restEndsAt && draft.restEndsAt > Date.now()) {
        const [exIdx, setIdx] = draft.restForKey.split(":").map(Number);
        const remaining = Math.round((draft.restEndsAt - Date.now()) / 1000);
        const planned = draft.exercises[exIdx]?.sets[setIdx - 1]?.plannedRestS ?? remaining;
        restCtx.current = { exIdx, setIdx, planned, endsAt: draft.restEndsAt };
        rest.start(remaining);
      }
    } else {
      setExercises(fresh);
    }
    setPhase("running");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, plan, day, resolvedItems, adaptive.loading, planId, dayIndex, isFree, navigate]);

  // ── carga anterior + mídias (GIF) ─────────────────────
  useEffect(() => {
    let alive = true;
    getWorkoutStats().then((stats) => {
      if (!alive || !stats) return;
      const m = new Map<string, number>();
      for (const e of stats.exerciseProgression) m.set(e.exerciseId, e.lastLoadKg);
      setPrevLoad(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Ids dos exercícios da sessão, como chave estável.
   *
   * No livre a lista muda DURANTE o treino (o aluno inclui exercício na folha de
   * gestão), então a fonte é o rascunho e não `resolvedItems`, que é sempre null
   * ali. A chave é string para o efeito não refazer a busca a cada tecla digitada
   * numa série — `exercises` muda de identidade o tempo todo, os ids não.
   */
  const mediaIdsKey = useMemo(() => {
    const ids = isFree
      ? exercises.map((ex) => ex.exerciseId)
      : (resolvedItems ?? []).map((it) => it.exerciseId);
    return Array.from(new Set(ids.filter(Boolean) as string[])).join("|");
  }, [isFree, exercises, resolvedItems]);

  useEffect(() => {
    let alive = true;
    const ids = mediaIdsKey ? mediaIdsKey.split("|") : [];
    if (!ids.length) return;
    getExercisesBatch(ids)
      .then((rows) => {
        if (!alive) return;
        const m = new Map<string, string>();
        const lab = new Map<string, string>();
        for (const ex of rows) {
          const url = pickMediaUrl(ex);
          if (url) m.set(ex.id, url);
          if (ex.movementLabExerciseId) lab.set(ex.id, ex.movementLabExerciseId);
        }
        setExMedia(m);
        setExLab(lab);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [mediaIdsKey]);

  const totalSets = useMemo(() => exercises.reduce((a, e) => a + e.sets.length, 0), [exercises]);
  const doneSets = useMemo(
    () => exercises.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0),
    [exercises],
  );

  /**
   * Séries em que o aluno DIGITOU algo e não tocou no ✓.
   *
   * A regra vive em `filledSets.ts`, pura e testada: é ela que decide se um
   * trabalho registrado conta ou é descartado, e isso não pode depender de
   * renderização para ser verificado.
   */
  const filledUnchecked = useMemo(() => findFilledUnchecked(exercises), [exercises]);

  /**
   * Exercícios sem NENHUMA série marcada (SPEC P1 §33).
   *
   * Diferente do alerta de séries preenchidas-e-não-marcadas: aqui não há nada
   * digitado, o exercício simplesmente não foi feito — pulado, máquina ocupada
   * ou tempo curto. O aviso existe para que "pular por agora" (§15) não vire
   * "esqueci de vez", e nunca impede a conclusão.
   */
  const exerciciosPendentes = useMemo(
    () => exercises.filter((ex) => ex.sets.every((s) => !s.done)).map((ex) => ex.name),
    [exercises],
  );
  const [showPendentes, setShowPendentes] = useState(false);

  /** Marca de uma vez o que já foi preenchido e segue para o resumo. */
  function markFilledAsDone() {
    setExercises((prev) => {
      const next = markFilledDone(prev, Date.now());
      persist(next, currentIndex, startedAt);
      return next;
    });
    setShowUnchecked(false);
    // O aluno já tinha pedido para finalizar; marcar era o que faltava.
    setPhase("summary");
  }

  const current = exercises[currentIndex];
  const currentItem = (resolvedItems ?? [])[currentIndex];
  // No livre não existe item de ficha: as repetições planejadas moram na própria
  // série. O fallback vale para os dois modos (a série copia o prescrito).
  const currentReps = currentItem?.reps ?? current?.sets[0]?.plannedReps ?? "";

  function updateSet(setIdx: number, patch: Partial<DraftExercise["sets"][number]>) {
    setExercises((prev) => {
      const next = prev.map((ex, i) =>
        i === currentIndex
          ? { ...ex, sets: ex.sets.map((s) => (s.setIndex === setIdx ? { ...s, ...patch } : s)) }
          : ex,
      );
      persist(next, currentIndex, startedAt);
      return next;
    });
  }

  function toggleDone(setIdx: number) {
    const ex = exercises[currentIndex];
    const set = ex?.sets.find((s) => s.setIndex === setIdx);
    if (!set) return;

    // §47: o segundo toque de um duplo toque é ignorado. 600ms é a janela do
    // gesto acidental — abaixo do tempo de quem decide desmarcar de propósito.
    const key = `${currentIndex}:${setIdx}`;
    const ultimo = ultimoToqueSerie.current;
    if (ultimo && ultimo.key === key && Date.now() - ultimo.at < 600) return;
    ultimoToqueSerie.current = { key, at: Date.now() };

    const becomingDone = !set.done;
    updateSet(setIdx, { done: becomingDone, completedAt: becomingDone ? Date.now() : null });

    if (becomingDone) {
      // Háptico curto ao concluir a série (§38). Um pulso só: a SPEC pede
      // "leve" e "não exagerar", e o aparelho está na mão de quem acabou de
      // fazer força. Degrada em silêncio onde a API não existe (iOS/desktop).
      try { navigator.vibrate?.(35); } catch { /* sem vibração é ok */ }
      postWorkoutEvent("workout.set_completed", { mode: isFree ? "free" : "plan" });

      // Bi-Set roda em par, sem descanso entre os dois exercícios — não dispara timer.
      const planned = set.plannedRestS ?? 0;
      const isBiSet = !!ex.biSetGroupId;
      if (planned > 0 && !isBiSet) {
        const endsAt = Date.now() + planned * 1000;
        restCtx.current = { exIdx: currentIndex, setIdx, planned, endsAt };
        rest.start(planned);
        // Entregue ao SISTEMA agora, com a hora absoluta: se o aparelho for
        // bloqueado no meio do descanso, o JS congela e nenhum timer nosso
        // dispararia (§40).
        void agendarAvisoDescanso(endsAt);
      }
    }
  }

  function goTo(idx: number) {
    const clamped = Math.max(0, Math.min(exercises.length - 1, idx));
    setCurrentIndex(clamped);
    persist(exercises, clamped, startedAt);
  }

  // ── edição da lista durante o treino livre ────────────
  // Três referências apontam para exercício por índice — o atual, o dono do
  // descanso e os desconfortos. `liveSessionOps` devolve os três já remapeados
  // junto da lista nova; aplicar em bloco é o que impede o descanso de um
  // exercício ir contar para outro depois de uma reordenação.
  function liveState(): LiveSessionState {
    return {
      exercises,
      currentIndex,
      restExIdx: restCtx.current?.exIdx ?? null,
      discomfort: discomfortEx,
    };
  }

  function applyLiveResult(result: LiveSessionResult) {
    if (!result.changed) return;
    if (result.restOwnerRemoved) {
      // O descanso pertencia a quem saiu: cancela sem gravar restDoneS (a série
      // dona não existe mais).
      rest.skip();
      restCtx.current = null;
    } else if (restCtx.current && result.restExIdx != null) {
      restCtx.current = { ...restCtx.current, exIdx: result.restExIdx };
    }
    setExercises(result.exercises);
    setCurrentIndex(result.currentIndex);
    setDiscomfortEx(result.discomfort);
    persist(result.exercises, result.currentIndex, startedAt);
  }

  function handleLiveAdd(picked: PickedExercise) {
    applyLiveResult(addLiveExercise(liveState(), picked));
  }

  function handleLiveMove(index: number, direction: -1 | 1) {
    postWorkoutEvent("workout.exercise_reordered", { mode: isFree ? "free" : "plan" });
    applyLiveResult(moveLiveExercise(liveState(), index, direction));
  }

  function handleLiveRemove(index: number) {
    applyLiveResult(removeLiveExercise(liveState(), index));
  }

  function buildSessionPayload(): { sets: unknown[]; status: RegisterSessionStatus } {
    const sets: unknown[] = [];
    exercises.forEach((ex, orderIndex) => {
      ex.sets.forEach((s) => {
        sets.push({
          exerciseId: ex.exerciseId,
          name: ex.name,
          orderIndex,
          setIndex: s.setIndex,
          plannedReps: s.plannedReps,
          repsDone: s.done ? parseNum(s.reps) ?? leadingInt(s.plannedReps) : null,
          plannedLoadKg: null,
          loadDoneKg: s.done ? parseNum(s.loadKg) : null,
          plannedRestS: s.plannedRestS,
          restDoneS: s.restDoneS,
          discomfort: discomfortEx.has(orderIndex) ? "desconforto relatado" : null,
          status: s.done ? "done" : "skipped",
        });
      });
    });
    const status: RegisterSessionStatus =
      doneSets === 0 ? "abandoned" : doneSets === totalSets ? "completed" : "partial";
    return { sets, status };
  }

  // resumo
  const volume = useMemo(() => {
    let v = 0;
    for (const ex of exercises) {
      for (const s of ex.sets) {
        if (!s.done) continue;
        const load = parseNum(s.loadKg);
        const reps = parseNum(s.reps) ?? leadingInt(s.plannedReps);
        if (load && reps) v += load * reps;
      }
    }
    return Math.round(v);
  }, [exercises]);
  /**
   * Exercícios para a mini tabela do card de compartilhamento: o que foi
   * EXECUTADO (série marcada), não o que estava prescrito — quem parou no 3º
   * exercício não compartilha uma peça dizendo que fez sete. As reps saem do
   * que a pessoa digitou (faixa "8-12" quando variou), com o planejado só como
   * rede de segurança para quem marca o ✓ sem preencher.
   */
  const shareExercises = useMemo(
    () =>
      exercises
        .map((ex) => {
          const done = ex.sets.filter((s) => s.done);
          if (!done.length) return null;
          const typed = done.map((s) => parseNum(s.reps)).filter((n): n is number => n != null && n > 0);
          let reps: string | null = null;
          if (typed.length) {
            const min = Math.min(...typed);
            const max = Math.max(...typed);
            reps = min === max ? String(min) : `${min}-${max}`;
          } else {
            const planned = leadingInt(done[0].plannedReps);
            reps = planned ? String(planned) : null;
          }
          return { name: ex.name, sets: done.length, reps };
        })
        .filter((x): x is { name: string; sets: number; reps: string | null } => x !== null),
    [exercises],
  );

  const durationMin = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const adherence = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
  const sessionStatus: "completed" | "partial" | "abandoned" =
    doneSets === 0 ? "abandoned" : doneSets === totalSets ? "completed" : "partial";

  // Fase 4 — comparação carga hoje × anterior por exercício.
  const comparison = useMemo(() => computeSessionComparison(exercises, prevLoad), [exercises, prevLoad]);
  // Fase 5 — sinal de fadiga (readiness × queda de carga).
  const fatigue = useMemo(
    () =>
      deriveFatigueInsight({
        readiness: adaptive.data?.readiness?.level ?? null,
        comparison,
        status: sessionStatus,
      }),
    [adaptive.data, comparison, sessionStatus],
  );

  /**
   * Finalização do treino livre.
   *
   * Diferente do prescrito em um ponto que importa: o rascunho só é apagado
   * DEPOIS do servidor confirmar. Lá, engolir a falha é tolerável porque a ficha
   * reconstrói o treino; aqui o rascunho é a única cópia da sessão, e limpá-lo
   * numa falha de rede apagaria o treino inteiro. O `clientKey` torna a nova
   * tentativa idempotente — reenviar não duplica histórico nem XP.
   */
  async function confirmFinishFree() {
    const clientKey = freeClientKey.current;
    if (!clientKey) return;
    setFinishing(true);
    setFinishError(null);
    const { sets, status } = buildSessionPayload();
    try {
      const outcome = await registerFreeWorkoutSession({
        clientKey,
        exercises,
        sets,
        status,
        sessionRpe,
        notes: notes.trim() || null,
      });
      if (outcome.celebrate) setPrEvents(outcome.prEvents);
      // Ordem importa: fecha a persistência e para o cronômetro ANTES de apagar,
      // senão um descanso ainda em contagem regrava o rascunho logo depois.
      sessionSaved.current = true;
      rest.skip();
      restCtx.current = null;
      void cancelarAvisoDescanso();
      clearFreeDraft();
      postWorkoutEvent("workout.completed", {
        mode: "free",
        durationS: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
        setsDone: doneSets,
        totalSets,
        totalExercises: exercises.length,
        pendingExercises: exerciciosPendentes.length,
      });
      setFinishing(false);
      setSaved(true);
    } catch {
      setFinishing(false);
      setFinishError(
        "Não foi possível salvar o treino agora. Ele continua guardado neste aparelho — tente de novo.",
      );
    }
  }

  async function confirmFinish() {
    if (finishing) return;
    if (isFree) {
      await confirmFinishFree();
      return;
    }
    if (!plan || !day) return;
    setFinishing(true);
    setFinishError(null);
    const { sets, status } = buildSessionPayload();
    try {
      const outcome = await registerWorkoutSession({
        planId: plan.id,
        planTitle: plan.title,
        selectedGroup: plan.selected_group,
        dayIndex: day.index,
        dayName: day.name,
        dayFocus: day.focus,
        prescribed: (resolvedItems ?? []).map((it) => ({
          exerciseId: it.exerciseId ?? null,
          name: it.name,
          sets: it.sets,
          reps: it.reps,
          rest: it.rest,
        })),
        sets,
        status,
        sessionRpe,
        notes: notes.trim() || null,
      });
      // Recordes desta sessão (Spec 033, P2). O servidor já decidiu o que é
      // conquista e o que é estreia — a tela só reconhece.
      if (outcome.celebrate) setPrEvents(outcome.prEvents);
    } catch {
      // NÃO engolir. A versão anterior seguia em frente aqui, apagava o rascunho
      // e mostrava "Treino salvo" — com o servidor fora do ar o treino sumia dos
      // dois lados e o aluno era informado do contrário (QA mobile set/2026).
      // O reenvio é seguro: `createSession` deduplica pela chave natural
      // (aluno + ficha + dia da ficha + dia do aluno) sob advisory lock e devolve
      // a sessão existente, então tentar de novo nunca duplica histórico nem XP.
      setFinishing(false);
      setFinishError(
        "Não foi possível salvar o treino agora. Ele continua guardado neste aparelho — tente de novo.",
      );
      return;
    }
    // Mesma ordem do livre: trancar a persistência e parar o cronômetro antes de
    // apagar. Sem isso, um descanso que estoura depois daqui regravava o
    // rascunho e a ficha reabria o treino inteiro já marcado (QA ago/2026).
    sessionSaved.current = true;
    rest.skip();
    restCtx.current = null;
    void cancelarAvisoDescanso();
    clearDraft(planId, dayIndex);
    // NÃO navega embora: entra no estado "salvo" com o Compartilhar em destaque.
    // Sair na hora escondia a divulgação orgânica (regressão reportada jun/2026).
    postWorkoutEvent("workout.completed", {
      mode: "plan",
      durationS: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      setsDone: doneSets,
      totalSets,
      totalExercises: exercises.length,
      pendingExercises: exerciciosPendentes.length,
    });
    setFinishing(false);
    setSaved(true);
  }

  function discardAndExit() {
    rest.skip();
    void cancelarAvisoDescanso();
    postWorkoutEvent("workout.abandoned", {
      mode: isFree ? "free" : "plan",
      durationS: Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      setsDone: doneSets,
      totalSets,
    });
    if (isFree) {
      clearFreeDraft();
      navigate(FREE_SETUP_ROUTE, { replace: true });
      return;
    }
    clearDraft(planId, dayIndex);
    navigate("/app/user/ficha", { replace: true });
  }

  /**
   * Botão voltar do Android durante o treino.
   *
   * Cai no MESMO diálogo do "Sair" do cabeçalho — que oferece sair guardando o
   * progresso ou descartar — em vez de navegar embora sem avisar. O evento vem
   * da `NativeAppBridge`, que só o emite quando não há modal aberto por cima.
   */
  useEffect(() => {
    const onBack = () => setShowExit(true);
    window.addEventListener("s2core:native-back", onBack);
    return () => window.removeEventListener("s2core:native-back", onBack);
  }, []);

  function closeExitDialog() {
    setShowExit(false);
    setConfirmFreeDiscard(false);
  }

  function exitKeepProgress() {
    if (rest.active) rest.pause();
    persist(exercises, currentIndex, startedAt);
    // No livre a montagem é a tela que oferece "Retomar" — voltar para a ficha
    // esconderia o treino que ficou aberto.
    navigate(isFree ? FREE_SETUP_ROUTE : "/app/user/ficha", { replace: true });
  }

  // ── render ────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="ws-root" style={{ display: "grid", placeItems: "center" }}>
        <div style={{ color: "var(--color-text-muted)" }}>Preparando seu treino…</div>
      </div>
    );
  }

  if (phase === "empty" || (!isFree && (!plan || !day))) {
    return (
      <div className="ws-root" style={{ display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Treino indisponível</div>
          <div style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>
            Não encontramos os exercícios deste dia.
          </div>
          <button className="ws-btn ws-btn-primary" onClick={() => navigate("/app/user/ficha")}>
            Voltar para a ficha
          </button>
        </div>
      </div>
    );
  }

  // Sem ficha o título é derivado do que o aluno montou — e é o MESMO que vai
  // para o histórico, para a sessão não ter dois nomes.
  const sessionTitle =
    plan && day ? prescribedWorkoutTitle(plan.title, day.name, day.focus) : freeWorkoutTitle(exercises);

  // Manchete do card: MESMA regra do compartilhamento pelo gráfico, aplicada ao
  // MESMO título que acabou de ser gravado. Antes esta tela tinha a sua própria
  // derivação, e as duas divergiam — ao terminar dizia "Costas e Ombros", pelo
  // gráfico dizia "Treino B", para a mesma sessão.
  const shareFocus = splitShareTitle(sessionTitle, isFree ? "free" : "personal").focus;

  if (phase === "summary") {
    return (
      <div className="ws-root">
        <div className="ws-top">
          <div className="ws-top-row">
            <div>
              <div className="ws-title">Treino concluído</div>
              <div className="ws-sub">{sessionTitle}</div>
            </div>
          </div>
        </div>
        <div className="ws-body ws-summary">
          {fatigue ? (
            <div className={`ws-insight ws-insight-${fatigue.tone}`}>
              <div className="ws-insight-head">{fatigue.headline}</div>
              <div className="ws-insight-body">{fatigue.body}</div>
            </div>
          ) : null}

          <div className="ws-summary-grid">
            <div className="ws-stat">
              <div className="ws-stat-value">{durationMin} min</div>
              <div className="ws-stat-label">Duração</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{doneSets}/{totalSets}</div>
              <div className="ws-stat-label">Séries feitas</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{adherence}%</div>
              <div className="ws-stat-label">Aderência</div>
            </div>
            <div className="ws-stat">
              <div className="ws-stat-value">{volume > 0 ? `${volume} kg` : "—"}</div>
              <div className="ws-stat-label">Volume total</div>
            </div>
          </div>

          {comparison.items.length > 0 ? (
            <div className="ws-cmp">
              <div className="ws-cmp-title">Comparado à última vez</div>
              {comparison.items.map((it) => (
                <div className="ws-cmp-row" key={`${it.exerciseId ?? it.name}`}>
                  <span className="ws-cmp-name">{it.name}</span>
                  <span className="ws-cmp-load">
                    {it.dir === "new" ? (
                      <>{it.todayKg} kg <em>1ª vez</em></>
                    ) : (
                      <>
                        {it.prevKg} → {it.todayKg} kg{" "}
                        <em
                          className={
                            it.dir === "up" ? "ws-delta-up" : it.dir === "down" ? "ws-delta-down" : undefined
                          }
                        >
                          {it.dir === "equal"
                            ? "igual"
                            : `${(it.deltaKg ?? 0) > 0 ? "+" : ""}${it.deltaKg} kg`}
                        </em>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {!saved ? (
            <>
              <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
                  Como foi o esforço? (opcional)
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {RPE_OPTIONS.map((o) => (
                    <button
                      key={o.rpe}
                      type="button"
                      onClick={() => setSessionRpe(sessionRpe === o.rpe ? null : o.rpe)}
                      className="ws-rest-btn"
                      style={
                        sessionRpe === o.rpe
                          ? { flex: 1, background: "var(--color-primary-soft)", borderColor: "var(--color-primary)" }
                          : { flex: 1 }
                      }
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {exercises.length > 0 && (
                <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)" }}>
                    Algum movimento incomodou? (opcional)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {exercises.map((ex, i) => {
                      const on = discomfortEx.has(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setDiscomfortEx((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            })
                          }
                          className="ws-rest-btn"
                          style={
                            on
                              ? { background: "var(--color-warn-soft, #fff8e1)", borderColor: "var(--color-warn, #f0a500)" }
                              : undefined
                          }
                        >
                          {ex.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <textarea
                className="ws-textarea"
                placeholder="Observação rápida (opcional): como você se sentiu, algum incômodo…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={280}
              />
            </>
          ) : (
            <div className="ws-saved-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Treino salvo — agora mostre sua evolução
            </div>
          )}

          {saved && prEvents.length > 0 ? <PrCelebration events={prEvents} /> : null}

          {finishError ? (
            <div className="ws-error" role="alert">
              {finishError}
            </div>
          ) : null}

          <div className="ws-actions">
            {saved ? (
              <>
                {/* ⚠️ Compartilhamento social (feature madura — ver docs/MATURE_FEATURES.md).
                    Em destaque APÓS salvar — é o momento natural de divulgação orgânica. */}
                {sessionStatus !== "abandoned" ? (
                  <WorkoutShareTrigger
                    variant="primary"
                    focus={shareFocus}
                    exercises={shareExercises}
                    stats={{
                      durationMin,
                      doneSets,
                      totalSets,
                      completionPct: adherence,
                      volumeKg: volume > 0 ? volume : null,
                    }}
                  />
                ) : null}
                <button
                  className="ws-btn ws-btn-ghost"
                  onClick={() => navigate(isFree ? "/app/user/today" : "/app/user/ficha", { replace: true })}
                >
                  {isFree ? "Voltar para o início" : "Voltar para a ficha"}
                </button>
              </>
            ) : (
              <>
                <button className="ws-btn ws-btn-primary" onClick={confirmFinish} disabled={finishing}>
                  {finishing ? "Salvando…" : finishError ? "Tentar novamente" : "Concluir e salvar"}
                </button>
                <button className="ws-btn ws-btn-ghost" onClick={() => setPhase("running")} disabled={finishing}>
                  Voltar ao treino
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // phase === "running"
  const restSoon = rest.active && rest.secondsLeft <= 10;
  const mediaUrl = current?.exerciseId ? exMedia.get(current.exerciseId) ?? null : null;
  const currentLabId = current?.exerciseId ? exLab.get(current.exerciseId) ?? null : null;

  function openLabForCurrent() {
    if (!current?.exerciseId || !currentLabId) return;
    const q = new URLSearchParams({
      from: "treino",
      labId: currentLabId,
      exerciseId: current.exerciseId,
      name: current.name,
      sets: String(current.sets.length),
      reps: currentReps,
      rest: String(current.sets[0]?.plannedRestS ?? ""),
      planId: String(planId),
      dayIndex: String(dayIndex),
    });
    navigate(`/app/user/movement-lab?${q.toString()}`);
  }
  const prev = current?.exerciseId ? prevLoad.get(current.exerciseId) ?? null : null;
  // Repetições da última execução: o servidor devolve só `lastLoadKg` em
  // `/training/stats`. A SPEC §8 mostra "80 kg × 10", mas §17 é explícita sobre
  // não inventar métrica que o domínio não tem — então a barra exibe a carga,
  // que é o número que decide o próximo ajuste, e as reps ficam no histórico
  // rápido (§27), que lê a execução real.
  const prevReps: string | null = null;
  const allCurrentDone = current?.sets.every((s) => s.done) ?? false;

  // Carga/reps da última série JÁ REGISTRADA deste exercício nesta sessão.
  // É a referência que o stepper usa antes de cair na do treino passado: quem
  // subiu o peso na série 1 de hoje não quer o número da semana passada de volta.
  const alvo = current ? serieAtual(current.sets) : null;
  const anterior = current && alvo
    ? [...current.sets].filter((x) => x.setIndex < alvo.setIndex && x.done).pop() ?? null
    : null;
  const cargaSerieAnterior = anterior?.loadKg?.trim() ? anterior.loadKg : null;
  const repsSerieAnterior = anterior?.reps?.trim() ? anterior.reps : null;
  const isLast = currentIndex >= exercises.length - 1;

  return (
    // `data-workout-live`: contrato lido pelo back do Android (NativeAppBridge).
    // Sem ele o botão voltar saía da sessão em silêncio (SPEC §32).
    <div className="ws-root" data-workout-live>
      <div className="ws-top">
        <div className="ws-top-row">
          <div style={{ minWidth: 0 }}>
            <div className="ws-title">{sessionTitle}</div>
            <div className="ws-sub">
              {/* Tempo decorrido (§4): a sessão já guardava `startedAt`, mas o
                  número nunca aparecia — quem treina precisa saber há quanto
                  tempo está ali sem sair para o relógio do aparelho. */}
              <span className="ws-elapsed">{fmtClock(Math.max(0, Math.floor((agora - startedAt) / 1000)))}</span>
              {" · "}
              Exercício {currentIndex + 1}/{exercises.length} · {doneSets}/{totalSets} séries
            </div>
            {offline ? (
              <div className="ws-sync ws-sync-off" role="status">Offline — salvando no aparelho</div>
            ) : reconectou ? (
              <div className="ws-sync ws-sync-ok" role="status">Sincronizado</div>
            ) : null}
          </div>
          <div className="ws-top-actions">
            {/*
              Editar a lista durante a sessão vale nos DOIS modos (SPEC P1
              §17/§21/§22). Era exclusivo do livre, mas a máquina ocupada é um
              problema de quem tem ficha, não de quem improvisa: reordenar é
              justamente a saída para não pular o exercício.

              A ficha ORIGINAL não muda. O que o servidor recebe como
              `prescribed` continua saindo do plano (`resolvedItems`), e só a
              execução vem desta lista — então reordenar, adicionar ou remover
              aqui altera o que foi FEITO, nunca o que foi PRESCRITO.
            */}
            <button type="button" className="ws-manage-btn" onClick={() => setShowManage(true)}>
              Exercícios
            </button>
            <button className="ws-icon-btn" aria-label="Sair" onClick={() => setShowExit(true)}>
              ×
            </button>
          </div>
        </div>
        <div className="ws-progress-track">
          <div className="ws-progress-fill" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="ws-body">
        {current && (
          <div className="ws-ex-card">
            <div className="ws-ex-head">
              <button
                className="ws-thumb"
                onClick={() => setDemoName(current.name)}
                aria-label={`Ver demonstração de ${current.name}`}
              >
                {mediaUrl ? <img src={mediaUrl} alt={current.name} decoding="async" /> : null}
                <span className="ws-thumb-badge">ver</span>
              </button>
              <div style={{ minWidth: 0 }}>
                <div className="ws-ex-name">{current.name}</div>
                <div className="ws-chips">
                  <span className="ws-chip">
                    {current.sets.length}×{currentReps}
                  </span>
                  {current.sets[0]?.plannedRestS ? (
                    <span className="ws-chip">descanso {current.sets[0].plannedRestS}s</span>
                  ) : null}
                  {currentItem?.technique && currentItem.technique.type !== "none" ? (
                    <span className="ws-chip">
                      {currentItem.technique.type === "drop_set"
                        ? "Drop set"
                        : currentItem.technique.type === "rest_pause"
                          ? "Rest-pause"
                          : "Bi-set"}
                    </span>
                  ) : null}
                  {prev != null ? <span className="ws-chip ws-chip-prev">última: {prev} kg</span> : null}
                  {/* §27: o histórico abre SOBRE a sessão — perguntar "quanto
                      levantei da última vez" não pode custar sair do treino. */}
                  {current.exerciseId ? (
                    <button
                      type="button"
                      className="ws-chip ws-chip-hist"
                      onClick={() => setHistFor({ id: current.exerciseId!, name: current.name })}
                    >
                      histórico
                    </button>
                  ) : null}
                </div>
                {/* Fora do livre: o Lab guiado grava sessão própria atrelada a
                    plano e dia, que aqui não existem. */}
                {canGuidedLab && currentLabId && !isFree ? (
                  <button type="button" className="ws-lab-btn" onClick={openLabForCurrent}>
                    <span className="ws-lab-badge">Beta</span>
                    Analisar com o Lab
                  </button>
                ) : null}
              </div>
            </div>

            <div className="ws-sets">
              {current.sets.map((s) => (
                <div key={s.setIndex} className={`ws-set-row${s.done ? " ws-set-done" : ""}`}>
                  <span className="ws-set-idx">{s.setIndex}</span>
                  <div className="ws-field">
                    <label>carga (kg)</label>
                    <input
                      className="ws-input"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder={prev != null ? String(prev) : "—"}
                      value={s.loadKg}
                      onChange={(e) => updateSet(s.setIndex, { loadKg: e.target.value })}
                      aria-label={`Carga série ${s.setIndex}`}
                    />
                  </div>
                  <div className="ws-field">
                    <label>reps</label>
                    <input
                      className="ws-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      placeholder={s.plannedReps}
                      value={s.reps}
                      onChange={(e) => updateSet(s.setIndex, { reps: e.target.value })}
                      aria-label={`Repetições série ${s.setIndex}`}
                    />
                  </div>
                  <button
                    className={`ws-set-check${s.done ? " ws-checked" : ""}`}
                    onClick={() => toggleDone(s.setIndex)}
                    aria-label={s.done ? `Desmarcar série ${s.setIndex}` : `Concluir série ${s.setIndex}`}
                    aria-pressed={s.done}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ws-actions">
          {!isLast ? (
            <button className={`ws-btn ${allCurrentDone ? "ws-btn-primary" : "ws-btn-ghost"}`} onClick={() => goTo(currentIndex + 1)}>
              Próximo exercício →
            </button>
          ) : null}
          {currentIndex > 0 ? (
            <button className="ws-btn ws-btn-ghost" onClick={() => goTo(currentIndex - 1)}>
              ← Exercício anterior
            </button>
          ) : null}
          <button
            className={`ws-btn ${isLast || doneSets > 0 ? "ws-btn-primary" : "ws-btn-ghost"}`}
            onClick={() => {
              // O aviso vem ANTES do resumo: depois de salvo, não há desfazer.
              // Ordem: primeiro o que seria DESCARTADO (séries digitadas e não
              // marcadas), depois o que ficou por FAZER. Os dois avisam antes
              // do resumo, porque depois de salvo não há desfazer.
              if (filledUnchecked.length > 0) setShowUnchecked(true);
              else if (exerciciosPendentes.length > 0 && doneSets > 0) setShowPendentes(true);
              else setPhase("summary");
            }}
          >
            Finalizar treino
          </button>
        </div>
      </div>

      {/*
        Barra de ação da série atual (§5/§6/§7/§10/§45). Escondida enquanto o
        descanso está na tela: as duas ocupam a mesma faixa inferior, e durante
        o descanso a ação relevante é o descanso, não a próxima série.
      */}
      {current && !rest.active ? (
        <SetActionBar
          set={serieAtual(current.sets)}
          posicao={serieAtual(current.sets)?.setIndex ?? current.sets.length}
          totalNoExercicio={current.sets.length}
          cargaSerieAnterior={cargaSerieAnterior}
          repsSerieAnterior={repsSerieAnterior}
          ultimaCarga={prev}
          ultimasReps={prevReps}
          exercicioConcluido={allCurrentDone}
          temProximo={!isLast}
          onChange={updateSet}
          onConcluir={toggleDone}
          onProximo={() => goTo(currentIndex + 1)}
          onPular={
            isLast
              ? undefined
              : () => {
                  postWorkoutEvent("workout.exercise_skipped", { mode: isFree ? "free" : "plan" });
                  goTo(currentIndex + 1);
                }
          }
        />
      ) : null}

      {rest.active ? (
        <div className={`ws-rest${restSoon ? " ws-rest-soon" : ""}`}>
          <div>
            <div className="ws-rest-time">{fmtClock(rest.secondsLeft)}</div>
            <div className="ws-rest-label">{rest.running ? "Descanso" : "Pausado"}</div>
          </div>
          <div className="ws-rest-actions">
            <button className="ws-rest-btn" onClick={() => rest.add(15)}>+15s</button>
            <button className="ws-rest-btn" onClick={() => rest.add(30)}>+30s</button>
            <button className="ws-rest-btn" onClick={() => (rest.running ? rest.pause() : rest.resume())}>
              {rest.running ? "Pausar" : "Retomar"}
            </button>
            <button className="ws-rest-btn ws-rest-btn-skip" onClick={() => finalizeRest(rest.skip())}>
              Pular
            </button>
          </div>
        </div>
      ) : null}

      {demoName ? <ExerciseDemoModal key={demoName} name={demoName} onClose={() => setDemoName(null)} /> : null}

      {histFor ? (
        <ExerciseHistorySheet
          key={histFor.id}
          exerciseId={histFor.id}
          exerciseName={histFor.name}
          onClose={() => setHistFor(null)}
        />
      ) : null}

      {showManage ? (
        <LiveExerciseSheet
          exercises={exercises}
          currentIndex={currentIndex}
          onClose={() => setShowManage(false)}
          onMove={handleLiveMove}
          onRemove={handleLiveRemove}
          onAdd={handleLiveAdd}
        />
      ) : null}

      {/*
        Alerta de séries preenchidas e não marcadas.
        
        Aparece só quando há trabalho digitado que seria descartado — não é um
        passo a mais no fluxo de quem usa o ✓ normalmente. A ação principal
        resolve tudo de uma vez; a secundária deixa seguir, porque o aluno pode
        ter preenchido uma série que de fato não fez.
      */}
      {showUnchecked ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-unchecked-title"
          style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(10,19,13,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
          onClick={() => setShowUnchecked(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px,100%)", background: "var(--color-surface)", borderRadius: 18, border: "1px solid var(--color-border)", padding: 18, display: "grid", gap: 10 }}
          >
            <div id="ws-unchecked-title" style={{ fontWeight: 700, fontSize: 17 }}>
              {filledUnchecked.length === 1
                ? "1 série preenchida não está marcada"
                : `${filledUnchecked.length} séries preenchidas não estão marcadas`}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              {doneSets === 0
                ? "Sem nenhuma série marcada, este treino não conta para sua frequência, XP nem recordes — e a carga que você digitou não é salva."
                : "O que não estiver marcado não é salvo: a carga e as repetições digitadas nessas séries são descartadas."}
            </div>
            <button className="ws-btn ws-btn-primary" onClick={markFilledAsDone}>
              {filledUnchecked.length === 1 ? "Marcar como feita" : `Marcar as ${filledUnchecked.length} como feitas`}
            </button>
            <button className="ws-btn ws-btn-ghost" onClick={() => setShowUnchecked(false)}>
              Voltar e marcar manualmente
            </button>
            <button
              className="ws-btn ws-btn-ghost"
              onClick={() => {
                setShowUnchecked(false);
                if (exerciciosPendentes.length > 0 && doneSets > 0) setShowPendentes(true);
                else setPhase("summary");
              }}
            >
              Finalizar sem elas
            </button>
          </div>
        </div>
      ) : null}

      {/* §33 — exercícios que não foram executados. Avisa, não bloqueia. */}
      {showPendentes ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ws-pend-title"
          style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(10,19,13,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
          onClick={() => setShowPendentes(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px,100%)", background: "var(--color-surface)", borderRadius: 18, border: "1px solid var(--color-border)", padding: 18, display: "grid", gap: 10 }}
          >
            <div id="ws-pend-title" style={{ fontWeight: 700, fontSize: 17 }}>
              {exerciciosPendentes.length === 1
                ? "1 exercício ainda não foi concluído."
                : `${exerciciosPendentes.length} exercícios ainda não foram concluídos.`}
            </div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.45 }}>
              {exerciciosPendentes.slice(0, 4).join(" · ")}
              {exerciciosPendentes.length > 4 ? ` · +${exerciciosPendentes.length - 4}` : ""}
            </div>
            <button
              className="ws-btn ws-btn-primary"
              onClick={() => {
                setShowPendentes(false);
                const idx = exercises.findIndex((ex) => ex.sets.every((s) => !s.done));
                if (idx >= 0) goTo(idx);
              }}
            >
              Voltar ao treino
            </button>
            <button
              className="ws-btn ws-btn-ghost"
              onClick={() => {
                setShowPendentes(false);
                setPhase("summary");
              }}
            >
              Finalizar mesmo assim
            </button>
          </div>
        </div>
      ) : null}

      {showExit ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, zIndex: 1300, background: "rgba(10,19,13,.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}
          onClick={closeExitDialog}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(480px,100%)", background: "var(--color-surface)", borderRadius: 18, border: "1px solid var(--color-border)", padding: 18, display: "grid", gap: 10 }}
          >
            <div style={{ fontWeight: 700, fontSize: 17 }}>Sair do treino?</div>
            <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Seu progresso fica salvo neste aparelho — você pode retomar de onde parou.
            </div>
            <button className="ws-btn ws-btn-ghost" onClick={closeExitDialog}>Continuar treino</button>
            <button className="ws-btn ws-btn-ghost" onClick={exitKeepProgress}>Sair (salvar progresso)</button>
            {/*
              No livre o descarte é irreversível de verdade: não há ficha para
              remontar o treino, então o botão pede confirmação nomeando o que
              se perde. No prescrito segue direto, como sempre foi.
            */}
            {isFree && confirmFreeDiscard ? (
              <>
                <div style={{ fontSize: 13, color: "var(--color-danger-text)" }}>
                  {doneSets > 0
                    ? `Descartar apaga ${doneSets === 1 ? "a série já marcada" : `as ${doneSets} séries já marcadas`} neste treino. Não dá para desfazer.`
                    : "Descartar apaga este treino livre. Não dá para desfazer."}
                </div>
                <button
                  className="ws-btn ws-btn-ghost"
                  style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}
                  onClick={discardAndExit}
                >
                  Sim, descartar
                </button>
                <button className="ws-btn ws-btn-ghost" onClick={() => setConfirmFreeDiscard(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button
                className="ws-btn ws-btn-ghost"
                style={{ color: "var(--color-danger)", borderColor: "var(--color-danger-border)" }}
                onClick={isFree ? () => setConfirmFreeDiscard(true) : discardAndExit}
              >
                Descartar treino
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Espaço de trabalho da refeição (registro alimentar INCREMENTAL, P0).
 *
 * Antes, a folha montava a refeição inteira na memória e um único "Confirmar" gravava tudo e fechava — o aluno que
 * lançava pão, depois ovo, depois leite voltava à tela principal a cada alimento. Aqui cada alimento confirmado é
 * GRAVADO NA HORA e a folha continua aberta: a lista de itens salvos vem do servidor (que recalcula tudo), e o
 * "em preenchimento" é só estado de UI — nenhum status novo no banco, nenhuma obrigação de "finalizar".
 *
 * Garantias:
 * - **Fila serial**: as gravações de UMA refeição nunca correm em paralelo (cada uma usa o `logId`/`updatedAt`
 *   devolvidos pela anterior) — sem "último a gravar vence" dentro do aparelho. Interpretar texto (parse) pode
 *   correr em paralelo; só o salvar é serializado.
 * - **Idempotência**: cada item novo leva uma `clientKey` (UUID). Um reenvio (rede instável, "Tentar de novo")
 *   reusa a mesma chave e o servidor não duplica.
 * - **Edição concorrente**: o PATCH leva o `updatedAt` que o cliente viu; outro aparelho que tenha editado antes
 *   gera 409 e a refeição é recarregada.
 * - **Retomada**: abrir uma refeição do plano que já tem registro hoje reabre o espaço com os itens salvos
 *   (esqueceu a bebida? é só abrir e adicionar).
 * - Remover um item tem uma janela de "Desfazer" (o PATCH só vai ao servidor depois dela, ou ao fechar/próxima ação).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  NutritionIntakeApiError,
  deleteIntakeLog,
  getDayIntake,
  submitIntakeLog,
  updateIntakeLog,
  type IntakeItemRequest,
  type IntakeLogRecord,
  type IntakeSource,
  type NutritionIntakeMeal,
  type PersistedIntakeItem,
} from "../../services/nutritionIntakeApi";
import { previewToRequest, type WorkingItem } from "./intakeWorking";

export const UNDO_WINDOW_MS = 5000;

export interface InflightOp {
  key: string;
  items: WorkingItem[];
  status: "saving" | "failed";
  error?: string;
}

interface AddMeta {
  label: string;
  source: IntakeSource;
  rawText?: string | null;
}

interface Rec {
  logId: number | null;
  /** `null` = a linha nunca foi editada; `undefined` = o cliente ainda não sabe (sem checagem de conflito). */
  updatedAt: string | null | undefined;
  /** Refeição legada em mais de uma linha física: depois de cada gravação o conjunto é relido do servidor. */
  legacy: boolean;
  dateKey: string | null;
  label: string | null;
}

/** Resultado de montar um PATCH a partir do estado ATUAL (índices resolvidos na execução, nunca no toque). */
interface PatchPlan {
  requests: IntakeItemRequest[];
  nextUids: string[];
}

function newKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof NutritionIntakeApiError) {
    if (err.status === 409) return "Esta refeição foi alterada em outro aparelho e foi atualizada. Tente de novo.";
    if (err.status === 403) return "Esta refeição não pode mais ser alterada.";
    if (err.code === "intake_log_out_of_range") return "Essa refeição passou do limite de calorias permitido.";
  }
  return "Não foi possível salvar. Verifique a conexão e tente de novo.";
}

export interface SavedEntry {
  item: PersistedIntakeItem;
  /** Posição atual na lista do servidor — só para exibição; NUNCA usar para agir (use `uid`). */
  index: number;
  /** Identidade estável do item neste espaço de trabalho: sobrevive a remoções/edições de outros itens. */
  uid: string;
}

export function useMealWorkspace({
  open,
  mealId,
  editingMeal,
  onChanged,
}: {
  open: boolean;
  /** Refeição do plano (null = refeição extra). */
  mealId: number | null;
  editingMeal?: NutritionIntakeMeal | null;
  /** Chamado depois de cada gravação com sucesso — o pai atualiza os totais sem fechar nada. */
  onChanged?: (log: IntakeLogRecord | null) => void;
}) {
  const [saved, setSaved] = useState<PersistedIntakeItem[]>([]);
  const [uids, setUids] = useState<string[]>([]);
  const [inflight, setInflight] = useState<InflightOp[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingRemovals, setPendingRemovals] = useState<string[]>([]);
  const [lastAdded, setLastAdded] = useState<string[] | null>(null);
  const [patching, setPatching] = useState(false);

  const rec = useRef<Rec>({ logId: null, updatedAt: undefined, legacy: false, dateKey: null, label: null });
  const savedRef = useRef<PersistedIntakeItem[]>([]);
  const uidsRef = useRef<string[]>([]);
  const uidByKey = useRef<Map<string, string>>(new Map());
  const keyByUid = useRef<Map<string, string>>(new Map());
  /** Geração da sessão: respostas de operações de uma sessão anterior (folha reaberta) são ignoradas. */
  const gen = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const ready = useRef<Promise<void>>(Promise.resolve());
  const removalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removalUids = useRef<string[]>([]);
  /** Operações de adicionar que falharam e ainda não foram refeitas/descartadas — o "Pronto" não fecha sem resolver. */
  const failedKeys = useRef<Set<string>>(new Set());
  const addMetaRef = useRef<Map<string, AddMeta>>(new Map());
  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  });

  const setSavedBoth = useCallback((items: PersistedIntakeItem[], nextUids: string[]) => {
    savedRef.current = items;
    uidsRef.current = nextUids;
    setSaved(items);
    setUids(nextUids);
  }, []);

  const registerKey = useCallback((clientKey: string, uid: string) => {
    uidByKey.current.set(clientKey, uid);
    keyByUid.current.set(uid, clientKey);
  }, []);

  /**
   * Atribui uids à lista devolvida pelo servidor: por `clientKey` (itens adicionados aqui) e, para itens sem chave
   * (legado/plano), pela posição anterior — nunca reaproveitando um uid que pertence a outra chave.
   */
  const reconcileUids = useCallback(
    (items: PersistedIntakeItem[], previous: string[]): string[] => {
      const used = new Set<string>();
      return items.map((it, p) => {
        let u = it.clientKey ? uidByKey.current.get(it.clientKey) : undefined;
        if (u && used.has(u)) u = undefined;
        if (!u && !it.clientKey) {
          const cand = previous[p];
          if (cand && !used.has(cand) && !keyByUid.current.has(cand)) u = cand;
        }
        if (!u) {
          u = newKey();
          if (it.clientKey) registerKey(it.clientKey, u);
        }
        used.add(u);
        return u;
      });
    },
    [registerKey]
  );

  const enqueue = useCallback((fn: () => Promise<void>) => {
    chain.current = chain.current.then(() => ready.current).then(fn).catch(() => undefined);
    return chain.current;
  }, []);

  const applyLog = useCallback(
    (log: IntakeLogRecord, nextUids?: string[]) => {
      rec.current.logId = log.id;
      rec.current.updatedAt = log.updatedAt;
      rec.current.dateKey = log.dateKey;
      rec.current.label = log.label;
      if (rec.current.legacy) return;
      const u = nextUids && nextUids.length === log.items.length ? nextUids : reconcileUids(log.items, uidsRef.current);
      setSavedBoth(log.items, u);
    },
    [reconcileUids, setSavedBoth]
  );

  /** Relê a refeição inteira (linhas legadas): a ordem dos itens é a que `existing.index` usa no servidor. */
  const reloadMeal = useCallback(async () => {
    const r = rec.current;
    if (r.logId == null) return;
    const g = gen.current;
    const day = await getDayIntake(r.dateKey ?? undefined);
    if (g !== gen.current) return;
    const meal = day.meals.find((m) => m.sourceLogIds.includes(r.logId!));
    if (!meal) {
      setSavedBoth([], []);
      r.logId = null;
      return;
    }
    r.logId = meal.sourceLogIds[0];
    r.legacy = meal.sourceLogIds.length > 1;
    r.updatedAt = day.logs.find((l) => l.id === r.logId)?.updatedAt ?? r.updatedAt;
    setSavedBoth(meal.items, reconcileUids(meal.items, uidsRef.current));
  }, [reconcileUids, setSavedBoth]);

  // Abertura: limpa tudo e (re)carrega a refeição — edição vem pronta; refeição do plano com registro hoje é retomada.
  useEffect(() => {
    if (!open) return;
    gen.current += 1;
    if (removalTimer.current) clearTimeout(removalTimer.current);
    removalUids.current = [];
    uidByKey.current = new Map();
    keyByUid.current = new Map();
    setPendingRemovals([]);
    setLastAdded(null);
    setInflight([]);
    setNotice(null);
    failedKeys.current.clear();
    addMetaRef.current.clear();
    chain.current = Promise.resolve();
    rec.current = { logId: null, updatedAt: undefined, legacy: false, dateKey: null, label: null };
    setSavedBoth([], []);

    if (editingMeal) {
      rec.current = {
        logId: editingMeal.sourceLogIds[0],
        updatedAt: editingMeal.updatedAt,
        legacy: editingMeal.sourceLogIds.length > 1,
        dateKey: editingMeal.dateKey ?? null,
        label: editingMeal.label,
      };
      setSavedBoth(editingMeal.items, reconcileUids(editingMeal.items, []));
      ready.current = Promise.resolve();
      return;
    }
    if (mealId == null) {
      ready.current = Promise.resolve();
      return;
    }
    let cancelled = false;
    setLoading(true);
    ready.current = getDayIntake()
      .then((day) => {
        if (cancelled) return;
        const meal = day.meals.find((m) => m.mealId === mealId);
        if (!meal) return;
        rec.current = {
          logId: meal.sourceLogIds[0],
          updatedAt: day.logs.find((l) => l.id === meal.sourceLogIds[0])?.updatedAt ?? null,
          legacy: meal.sourceLogIds.length > 1,
          dateKey: day.date,
          label: meal.label,
        };
        setSavedBoth(meal.items, reconcileUids(meal.items, []));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `editingMeal` é reidratado a cada abertura; reabrir é o gatilho certo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mealId, editingMeal]);

  useEffect(
    () => () => {
      if (removalTimer.current) clearTimeout(removalTimer.current);
    },
    []
  );

  // ── adicionar ────────────────────────────────────────────────────────────
  const runAdd = useCallback(
    async (key: string, items: WorkingItem[], meta: AddMeta) => {
      const g = gen.current;
      const requests: IntakeItemRequest[] = items.map((w) => ({ ...previewToRequest(w), clientKey: w.clientKey }));
      try {
        const log = await submitIntakeLog({
          label: rec.current.label ?? meta.label,
          rawText: meta.rawText ?? null,
          mealId,
          logId: rec.current.logId,
          items: requests,
          source: meta.source,
        });
        if (g !== gen.current) return; // a folha foi reaberta (outra refeição): esta resposta não é mais desta sessão
        applyLog(log);
        if (rec.current.legacy) await reloadMeal();
        if (g !== gen.current) return;
        failedKeys.current.delete(key);
        setInflight((prev) => prev.filter((o) => o.key !== key));
        const present = new Set(uidsRef.current);
        const batch = items.map((w) => (w.clientKey ? uidByKey.current.get(w.clientKey) : undefined)).filter((u): u is string => !!u && present.has(u));
        setLastAdded(batch.length > 0 ? batch : null);
        onChangedRef.current?.(log);
      } catch (err) {
        if (g !== gen.current) return;
        failedKeys.current.add(key);
        setInflight((prev) => prev.map((o) => (o.key === key ? { ...o, status: "failed", error: errorMessage(err) } : o)));
      }
    },
    [applyLog, mealId, reloadMeal]
  );

  /** Grava já os itens confirmados (em fila). */
  const addItems = useCallback(
    (items: WorkingItem[], meta: AddMeta) => {
      if (items.length === 0) return;
      const keyed = items.map((w) => {
        const clientKey = w.clientKey ?? newKey();
        if (!uidByKey.current.has(clientKey)) registerKey(clientKey, newKey());
        return { ...w, clientKey };
      });
      const key = newKey();
      addMetaRef.current.set(key, meta);
      setNotice(null);
      setInflight((prev) => [...prev, { key, items: keyed, status: "saving" }]);
      void enqueue(() => runAdd(key, keyed, meta));
    },
    [enqueue, registerKey, runAdd]
  );

  const retry = useCallback(
    (key: string) => {
      const op = inflight.find((o) => o.key === key);
      const meta = addMetaRef.current.get(key);
      if (!op || !meta) return;
      setInflight((prev) => prev.map((o) => (o.key === key ? { ...o, status: "saving", error: undefined } : o)));
      void enqueue(() => runAdd(key, op.items, meta));
    },
    [enqueue, inflight, runAdd]
  );

  const discard = useCallback((key: string) => {
    failedKeys.current.delete(key);
    setInflight((prev) => prev.filter((o) => o.key !== key));
    addMetaRef.current.delete(key);
  }, []);

  // ── editar / remover (PATCH com itens `existing`) ────────────────────────
  const runPatch = useCallback(
    async (build: (current: PersistedIntakeItem[], currentUids: string[]) => PatchPlan) => {
      const r = rec.current;
      if (r.logId == null) return;
      const g = gen.current;
      setPatching(true);
      try {
        const plan = build(savedRef.current, uidsRef.current);
        if (plan.requests.length === 0) {
          await deleteIntakeLog(r.logId);
          // linhas legadas irmãs: o servidor consolida no PATCH, mas apagar tudo exige apagar todas
          if (r.legacy) {
            const day = await getDayIntake(r.dateKey ?? undefined);
            const meal = day.meals.find((m) => m.sourceLogIds.includes(r.logId!));
            if (meal) await Promise.all(meal.sourceLogIds.filter((id) => id !== r.logId).map((id) => deleteIntakeLog(id)));
          }
          if (g !== gen.current) return;
          rec.current = { logId: null, updatedAt: undefined, legacy: false, dateKey: r.dateKey, label: null };
          setSavedBoth([], []);
          setLastAdded(null);
          onChangedRef.current?.(null);
          return;
        }
        const log = await updateIntakeLog(r.logId, {
          label: r.label ?? "Refeição",
          items: plan.requests,
          source: "manual",
          ...(r.updatedAt !== undefined ? { baseUpdatedAt: r.updatedAt } : {}),
        });
        if (g !== gen.current) return;
        rec.current.legacy = false; // o servidor consolidou as irmãs
        applyLog(log, plan.nextUids);
        onChangedRef.current?.(log);
      } catch (err) {
        if (g !== gen.current) return;
        if (err instanceof NutritionIntakeApiError && err.status === 409) await reloadMeal().catch(() => undefined);
        setNotice(errorMessage(err));
      } finally {
        setPatching(false);
      }
    },
    [applyLog, reloadMeal, setSavedBoth]
  );

  /** Pega (e zera) as remoções pendentes — vão juntas no próximo PATCH, contra o MESMO estado. */
  const takeRemovals = useCallback((): string[] => {
    if (removalTimer.current) clearTimeout(removalTimer.current);
    const taken = removalUids.current;
    removalUids.current = [];
    setPendingRemovals([]);
    return taken;
  }, []);

  /**
   * Enfileira UM patch: remove `remove` (+ as remoções pendentes) e, opcionalmente, troca um item. Tudo é resolvido
   * por `uid` NA EXECUÇÃO, contra a lista que o servidor tem naquele momento — um índice capturado no toque ficaria
   * obsoleto se outro PATCH da fila encolhesse a lista antes.
   */
  const queuePatch = useCallback(
    (extra: { remove?: string[]; replace?: { uid: string; edited: WorkingItem } } = {}) => {
      const drop = new Set<string>([...takeRemovals(), ...(extra.remove ?? [])]);
      return enqueue(() =>
        runPatch((current, currentUids) => {
          const requests: IntakeItemRequest[] = [];
          const nextUids: string[] = [];
          current.forEach((_, i) => {
            const u = currentUids[i];
            if (drop.has(u)) return;
            requests.push(extra.replace?.uid === u ? previewToRequest(extra.replace.edited) : { kind: "existing", index: i });
            nextUids.push(u);
          });
          return { requests, nextUids };
        })
      );
    },
    [enqueue, runPatch, takeRemovals]
  );

  const commitRemoval = useCallback(() => {
    if (removalUids.current.length === 0) return Promise.resolve();
    return queuePatch();
  }, [queuePatch]);

  /** Remove o item `uid` com janela de "Desfazer"; remover o último apaga a refeição (a UI confirma antes). */
  const removeItem = useCallback(
    (uid: string) => {
      if (removalUids.current.includes(uid)) return;
      removalUids.current = [...removalUids.current, uid];
      setPendingRemovals(removalUids.current);
      setLastAdded(null);
      if (removalTimer.current) clearTimeout(removalTimer.current);
      removalTimer.current = setTimeout(() => void commitRemoval(), UNDO_WINDOW_MS);
    },
    [commitRemoval]
  );

  const undoRemoval = useCallback(() => {
    if (removalTimer.current) clearTimeout(removalTimer.current);
    removalUids.current = [];
    setPendingRemovals([]);
  }, []);

  /** Troca o item salvo `uid` por uma versão editada (re-resolvida no servidor); os demais ficam como estão. */
  const replaceItem = useCallback(
    (uid: string, edited: WorkingItem) => {
      setLastAdded(null);
      return queuePatch({ replace: { uid, edited } });
    },
    [queuePatch]
  );

  /** Desfaz o último lote adicionado (remove exatamente esses itens, onde quer que estejam agora). */
  const undoLastAdd = useCallback(() => {
    const batch = lastAdded;
    if (!batch) return;
    setLastAdded(null);
    void queuePatch({ remove: batch });
  }, [lastAdded, queuePatch]);

  /** Espera tudo que está gravando. `ok` = nada falhou (nada ficou sem salvar). */
  const flush = useCallback(async () => {
    await commitRemoval();
    await chain.current;
    return { ok: failedKeys.current.size === 0 };
  }, [commitRemoval]);

  const hidden = new Set(pendingRemovals);
  const visibleSaved: SavedEntry[] = saved
    .map((item, index) => ({ item, index, uid: uids[index] }))
    .filter(({ uid }) => uid && !hidden.has(uid));

  const totals = visibleSaved.reduce(
    (acc, { item }) => ({
      energyKcal: acc.energyKcal + item.energyKcal,
      proteinG: acc.proteinG + item.proteinG,
      carbohydrateG: acc.carbohydrateG + item.carbohydrateG,
      fatG: acc.fatG + item.fatG,
    }),
    { energyKcal: 0, proteinG: 0, carbohydrateG: 0, fatG: 0 }
  );

  return {
    saved: visibleSaved,
    totals,
    inflight,
    loading,
    notice,
    busy: patching || inflight.some((o) => o.status === "saving"),
    hasFailed: inflight.some((o) => o.status === "failed"),
    pendingRemovalCount: pendingRemovals.length,
    lastAdded,
    logId: rec.current.logId,
    label: rec.current.label,
    addItems,
    retry,
    discard,
    removeItem,
    undoRemoval,
    replaceItem,
    undoLastAdd,
    flush,
    clearNotice: () => setNotice(null),
  };
}

import { useEffect, useState } from "react";
import { getPerformanceOverview, type PerformanceOverview } from "./performanceApi";

export type OverviewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: PerformanceOverview };

/**
 * Overview de performance com estado explícito (Spec 033, P3).
 *
 * `getPerformanceOverview` devolve `null` em falha e um objeto com `gated` em
 * sucesso — o hook separa os dois porque a tela reage de formas opostas: falha
 * é silêncio (a Evolução continua útil sem o score), gating é convite.
 */
export function usePerformanceOverview(): OverviewState {
  const [state, setState] = useState<OverviewState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    getPerformanceOverview(controller.signal).then((res) => {
      if (controller.signal.aborted) return;
      setState(res ? { status: "ready", data: res } : { status: "error" });
    });
    return () => controller.abort();
  }, []);

  return state;
}

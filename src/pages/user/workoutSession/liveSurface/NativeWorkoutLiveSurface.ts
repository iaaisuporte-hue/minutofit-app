import { registerPlugin } from "@capacitor/core";
import type { EstadoTreinoVisivel, WorkoutLiveSurface } from "./WorkoutLiveSurface";

interface WorkoutLivePluginApi {
  start(opts: { title?: string; text?: string }): Promise<void>;
  update(opts: { title: string; body: string }): Promise<void>;
  stop(): Promise<void>;
}

const WorkoutLive = registerPlugin<WorkoutLivePluginApi>("WorkoutLive");

/**
 * `WorkoutLiveSurface` sobre o serviço de primeiro plano do TREINO (P1D).
 *
 * Serviço PRÓPRIO, separado do `LocationForegroundService` da P1B/P1C: aquele
 * é `foregroundServiceType="location"` e SÓ sobe com permissão de localização
 * concedida — exigir isso de quem só faz musculação, sem GPS nenhum envolvido,
 * seria pedir uma permissão sem motivo (risco real de rejeição na Play Store,
 * que audita se o tipo declarado bate com o uso real). Este usa `dataSync`,
 * estável desde a API 29 e sem a revisão dedicada que `specialUse` exigiria —
 * ver o relatório da P1D para o raciocínio completo.
 *
 * Título e corpo chegam PRONTOS: diferente do outdoor tracker, aqui o nativo
 * não tem como saber se o treino está em descanso — só o web enxerga o
 * `useRestTimer`. Então quem decide o texto final é sempre quem liga aqui.
 */
export class NativeWorkoutLiveSurface implements WorkoutLiveSurface {
  iniciar(): void {
    void WorkoutLive.start({ title: "S2Core · Treino em andamento", text: "Preparando..." }).catch(() => {});
  }

  atualizar(estado: EstadoTreinoVisivel): void {
    const emDescanso = estado.status !== "ativo";
    const titulo =
      estado.status === "descanso_pausado"
        ? "S2Core · Descanso pausado"
        : estado.status === "descansando"
          ? "S2Core · Descanso"
          : "S2Core · Treino em andamento";
    const corpo = emDescanso
      ? `${estado.descansoRestanteLabel ?? "--:--"} · Próxima: ${estado.exercicioNome} · ${estado.serieLabel}`
      : `${estado.tempoLabel} · ${estado.exercicioNome} · ${estado.serieLabel}` +
        (estado.cargaRepsLabel ? ` · ${estado.cargaRepsLabel}` : "");
    void WorkoutLive.update({ title: titulo, body: corpo }).catch(() => {});
  }

  parar(): void {
    void WorkoutLive.stop().catch(() => {});
  }
}

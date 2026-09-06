import type { EstadoTreinoVisivel, WorkoutLiveSurface } from "./WorkoutLiveSurface";

/** Sem Lock Screen no PWA/web (P1D) — a tela em si já mostra o estado ao vivo. */
export class WebWorkoutLiveSurface implements WorkoutLiveSurface {
  iniciar(): void {
    /* no-op */
  }

  atualizar(_estado: EstadoTreinoVisivel): void {
    /* no-op */
  }

  parar(): void {
    /* no-op */
  }
}

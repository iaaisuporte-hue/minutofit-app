import { Loader2, Mic, MicOff } from "lucide-react";

/**
 * Estado mínimo do Voice Workout (P5A) — sem redesign, um indicador pequeno.
 *
 * O motor de execução não ganha um conceito novo por causa disto: `off` é o
 * padrão (mesmo comportamento de hoje), os demais só existem enquanto o modo
 * está ligado dentro de UMA sessão.
 */
export type VoiceWorkoutHudState = "off" | "active" | "listening" | "processing" | "error";

export function VoiceWorkoutHud({
  state,
  message,
}: {
  state: VoiceWorkoutHudState;
  message?: string | null;
}) {
  if (state === "off") return null;

  const texto =
    state === "listening"
      ? "Ouvindo…"
      : state === "processing"
        ? "Processando…"
        : state === "error"
          ? (message ?? "Não entendi")
          : "Voz ativa";

  const Icone = state === "error" ? MicOff : state === "processing" ? Loader2 : Mic;

  return (
    <div className={`vw-hud vw-hud-${state}`} role="status" aria-live="polite">
      <Icone size={13} className={state === "processing" ? "vw-hud-spin" : undefined} aria-hidden />
      <span>{texto}</span>
    </div>
  );
}

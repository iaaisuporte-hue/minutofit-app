/**
 * Porta de captura/fala de voz (P5A — fundação do Voice Workout).
 *
 * Mesma ideia de `WorkoutLiveSurface`/`LocationTracker`: uma interface só,
 * uma implementação nativa (Android, via plugin Capacitor local) e uma
 * implementação alternativa só para QA em navegador (Chromium), nunca usada
 * no app empacotado — a WebView do Android e a WKWebView do iOS não têm
 * `SpeechRecognition`/`speechSynthesis` confiáveis.
 *
 * Nada aqui decide o que um comando SIGNIFICA — só captura/fala. A
 * interpretação é do parser (`voiceIntent.ts`) e a execução é da camada de
 * comandos (`workoutCommands.ts`). O áudio nunca é exposto por esta porta:
 * o que atravessa é só o transcript.
 */

export interface VoiceEngineCapabilities {
  microphoneAvailable: boolean;
  speechRecognitionAvailable: boolean;
  /** Reconhecimento pt-BR on-device instalado neste aparelho — sondagem, nunca presumida. */
  onDevicePtBrAvailable: boolean;
  ttsAvailable: boolean;
}

export type VoicePermissionState = "granted" | "denied" | "prompt";

export interface VoiceListenResult {
  transcript: string;
  /** 0..1 quando o motor informa confiança; `null` quando não. */
  confidence: number | null;
}

export type VoiceEngineErrorKind =
  | "permission_denied"
  | "no_microphone"
  | "recognizer_unavailable"
  | "recognizer_busy"
  | "empty_audio"
  | "timeout"
  | "unavailable";

export class VoiceEngineError extends Error {
  readonly kind: VoiceEngineErrorKind;
  constructor(kind: VoiceEngineErrorKind, message?: string) {
    super(message ?? kind);
    this.kind = kind;
  }
}

export interface VoiceEngine {
  /** Sonda o que este aparelho realmente suporta — nunca presumir. */
  getCapabilities(): Promise<VoiceEngineCapabilities>;
  checkPermissions(): Promise<VoicePermissionState>;
  requestPermissions(): Promise<VoicePermissionState>;
  /** Captura UM comando (janela curta, ≤ 6s) e devolve o transcript reconhecido. */
  listenOnce(): Promise<VoiceListenResult>;
  /** Fala uma confirmação curta. Nunca lança — TTS é best-effort. */
  speak(text: string): Promise<void>;
  /** Ativa o modo de voz (Android: soma o tipo `microphone` ao foreground service). */
  enable(): Promise<void>;
  disable(): Promise<void>;
}

import {
  VoiceEngineError,
  type VoiceEngine,
  type VoiceEngineCapabilities,
  type VoiceListenResult,
  type VoicePermissionState,
} from "./VoiceEngine";

/** Tipagem mínima da Web Speech API — não padronizada, presente só em alguns navegadores. */
interface WebSpeechRecognitionResult {
  transcript: string;
  confidence: number;
}
interface WebSpeechRecognitionEvent {
  results: WebSpeechRecognitionResult[][];
}
interface WebSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
}

function getRecognitionCtor(): (new () => WebSpeechRecognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const JANELA_MS = 6000;

/**
 * `VoiceEngine` só para QA local em navegador (Chromium), pela receita
 * `qa-mobile-autenticado-local` — NUNCA usada no app empacotado. Nem a
 * WebView do Android nem a WKWebView do iOS expõem `SpeechRecognition`
 * confiável, e é exatamente por isso que existe uma implementação nativa
 * (`NativeVoiceEngine`) via plugin Capacitor local: no app real, é ela que
 * roda em Android e iOS.
 */
export class WebVoiceEngine implements VoiceEngine {
  async getCapabilities(): Promise<VoiceEngineCapabilities> {
    return {
      microphoneAvailable: typeof navigator !== "undefined" && !!navigator.mediaDevices,
      speechRecognitionAvailable: getRecognitionCtor() != null,
      onDevicePtBrAvailable: false,
      ttsAvailable: typeof window !== "undefined" && "speechSynthesis" in window,
    };
  }

  async checkPermissions(): Promise<VoicePermissionState> {
    return "prompt";
  }

  async requestPermissions(): Promise<VoicePermissionState> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return "granted";
    } catch {
      return "denied";
    }
  }

  async listenOnce(): Promise<VoiceListenResult> {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      throw new VoiceEngineError("recognizer_unavailable", "SpeechRecognition indisponível neste navegador");
    }
    return new Promise<VoiceListenResult>((resolve, reject) => {
      const recognizer = new Ctor();
      recognizer.lang = "pt-BR";
      recognizer.interimResults = false;
      recognizer.maxAlternatives = 1;

      const timeout = setTimeout(() => {
        try {
          recognizer.stop();
        } catch {
          /* já parado */
        }
        reject(new VoiceEngineError("timeout"));
      }, JANELA_MS);

      recognizer.onresult = (event) => {
        clearTimeout(timeout);
        const alt = event.results?.[0]?.[0];
        if (!alt?.transcript) {
          reject(new VoiceEngineError("empty_audio"));
          return;
        }
        resolve({ transcript: alt.transcript, confidence: alt.confidence ?? null });
      };
      recognizer.onerror = () => {
        clearTimeout(timeout);
        reject(new VoiceEngineError("recognizer_unavailable"));
      };
      recognizer.start();
    });
  }

  async speak(text: string): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "pt-BR";
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }

  async enable(): Promise<void> {
    /* nada a ligar no navegador — captura é por chamada */
  }

  async disable(): Promise<void> {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }
}

import { registerPlugin } from "@capacitor/core";
import type { WakeWordCapabilities, WakeWordDetector } from "./WakeWordDetector";

interface WakeWordPluginApi {
  getCapabilities(): Promise<WakeWordCapabilities>;
  start(): Promise<void>;
  stop(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  addListener(
    eventName: "detected",
    listener: (data: { keywordIndex: number }) => void,
  ): Promise<{ remove: () => void }>;
  addListener(eventName: "error", listener: (data: { reason: string }) => void): Promise<{ remove: () => void }>;
}

const WakeWord = registerPlugin<WakeWordPluginApi>("WakeWord");

const CAPABILITIES_INDISPONIVEIS: WakeWordCapabilities = {
  available: false,
  onDevice: true,
  provider: null,
};

/**
 * `WakeWordDetector` sobre o plugin nativo "WakeWord" (P5C — spike aberto,
 * SEM fornecedor definitivo — ver
 * `docs/produto/voice_workout_wake_word_spike_onnx.md`).
 *
 * Nome histórico (herdado de quando só existia o motor Picovoice
 * Porcupine) — hoje a classe é agnóstica de fornecedor: o lado nativo
 * escolhe entre Porcupine e o motor ONNX estilo openWakeWord em avaliação
 * via `WAKE_WORD_ENGINE` (build time), e reporta qual está ativo em
 * `getCapabilities().provider`.
 *
 * Só existe implementação Android nesta fase. No iOS o plugin não existe
 * ainda — cada chamada rejeita, e esta classe converte isso em
 * "indisponível", nunca uma exceção que derruba a tela (mesma degradação
 * graciosa de `NativeVoiceEngine`).
 */
export class PorcupineWakeWordDetector implements WakeWordDetector {
  private removerDetected: (() => void) | null = null;
  private removerError: (() => void) | null = null;

  async getCapabilities(): Promise<WakeWordCapabilities> {
    try {
      return await WakeWord.getCapabilities();
    } catch {
      return CAPABILITIES_INDISPONIVEIS;
    }
  }

  async start(): Promise<void> {
    await WakeWord.start();
  }

  async stop(): Promise<void> {
    await WakeWord.stop().catch(() => {});
  }

  async suspend(): Promise<void> {
    await WakeWord.suspend().catch(() => {});
  }

  async resume(): Promise<void> {
    await WakeWord.resume().catch(() => {});
  }

  onDetected(callback: (keywordIndex: number) => void): () => void {
    let removido = false;
    void WakeWord.addListener("detected", (data) => callback(data.keywordIndex)).then((handle) => {
      if (removido) {
        void handle.remove();
        return;
      }
      this.removerDetected = () => void handle.remove();
    });
    return () => {
      removido = true;
      this.removerDetected?.();
      this.removerDetected = null;
    };
  }

  onError(callback: (reason: string) => void): () => void {
    let removido = false;
    void WakeWord.addListener("error", (data) => callback(data.reason)).then((handle) => {
      if (removido) {
        void handle.remove();
        return;
      }
      this.removerError = () => void handle.remove();
    });
    return () => {
      removido = true;
      this.removerError?.();
      this.removerError = null;
    };
  }
}

import { registerPlugin } from "@capacitor/core";
import {
  VoiceEngineError,
  type VoiceEngine,
  type VoiceEngineCapabilities,
  type VoiceListenResult,
  type VoicePermissionState,
} from "./VoiceEngine";

interface VoiceWorkoutPluginApi {
  getCapabilities(): Promise<VoiceEngineCapabilities>;
  checkPermissions(): Promise<{ microphone: VoicePermissionState }>;
  requestPermissions(): Promise<{ microphone: VoicePermissionState }>;
  listenOnce(): Promise<{ transcript: string; confidence: number | null }>;
  speak(opts: { text: string }): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
}

const VoiceWorkout = registerPlugin<VoiceWorkoutPluginApi>("VoiceWorkout");

const CAPABILITIES_INDISPONIVEIS: VoiceEngineCapabilities = {
  microphoneAvailable: false,
  speechRecognitionAvailable: false,
  onDevicePtBrAvailable: false,
  ttsAvailable: false,
};

/**
 * `VoiceEngine` sobre o plugin Capacitor local "VoiceWorkout" (P5A).
 *
 * Só o Android tem implementação nativa nesta fase (ver
 * `android/.../workout/VoiceWorkoutPlugin.java`). No iOS o plugin não existe
 * ainda — cada chamada rejeita, e esta classe converte isso em capacidades
 * "tudo indisponível" / erro `recognizer_unavailable`, nunca uma exceção
 * que derruba a tela. É a mesma degradação graciosa que o resto do app usa
 * quando uma plataforma não tem paridade (`WebWorkoutLiveSurface`).
 */
export class NativeVoiceEngine implements VoiceEngine {
  async getCapabilities(): Promise<VoiceEngineCapabilities> {
    try {
      return await VoiceWorkout.getCapabilities();
    } catch {
      return CAPABILITIES_INDISPONIVEIS;
    }
  }

  async checkPermissions(): Promise<VoicePermissionState> {
    try {
      const r = await VoiceWorkout.checkPermissions();
      return r.microphone;
    } catch {
      return "denied";
    }
  }

  async requestPermissions(): Promise<VoicePermissionState> {
    try {
      const r = await VoiceWorkout.requestPermissions();
      return r.microphone;
    } catch {
      return "denied";
    }
  }

  async listenOnce(): Promise<VoiceListenResult> {
    try {
      return await VoiceWorkout.listenOnce();
    } catch (err) {
      throw new VoiceEngineError(
        "recognizer_unavailable",
        err instanceof Error ? err.message : "listenOnce falhou",
      );
    }
  }

  async speak(text: string): Promise<void> {
    try {
      await VoiceWorkout.speak({ text });
    } catch {
      // TTS é best-effort: falhar aqui não pode travar o comando já executado.
    }
  }

  async enable(): Promise<void> {
    await VoiceWorkout.enable().catch(() => {});
  }

  async disable(): Promise<void> {
    await VoiceWorkout.disable().catch(() => {});
  }
}

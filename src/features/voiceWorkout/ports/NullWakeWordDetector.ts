import type { WakeWordCapabilities, WakeWordDetector } from "./WakeWordDetector";

/**
 * `WakeWordDetector` no-op — web (QA em navegador) e iOS (P5C é
 * Android-first; ver a decisão registrada). `available: false` sempre, para
 * o resto do produto cair em push-to-talk sem precisar saber por quê.
 */
export class NullWakeWordDetector implements WakeWordDetector {
  async getCapabilities(): Promise<WakeWordCapabilities> {
    return { available: false, onDevice: true, provider: null };
  }
  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async suspend(): Promise<void> {}
  async resume(): Promise<void> {}
  onDetected(): () => void {
    return () => {};
  }
  onError(): () => void {
    return () => {};
  }
}

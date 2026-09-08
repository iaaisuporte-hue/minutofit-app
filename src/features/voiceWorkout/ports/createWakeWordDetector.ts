import { getPlatform } from "../../../lib/platform";
import { NullWakeWordDetector } from "./NullWakeWordDetector";
import { PorcupineWakeWordDetector } from "./PorcupineWakeWordDetector";
import type { WakeWordDetector } from "./WakeWordDetector";

/**
 * P5C é Android-first (spike técnico) — só Android tenta o detector real.
 * iOS e web sempre caem no no-op, que reporta `available: false` e deixa o
 * resto do produto em push-to-talk sem tratamento especial.
 */
export function createWakeWordDetector(): WakeWordDetector {
  return getPlatform() === "android" ? new PorcupineWakeWordDetector() : new NullWakeWordDetector();
}

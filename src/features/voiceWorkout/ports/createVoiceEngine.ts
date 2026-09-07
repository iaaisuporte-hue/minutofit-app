import { getPlatform } from "../../../lib/platform";
import { NativeVoiceEngine } from "./NativeVoiceEngine";
import { WebVoiceEngine } from "./WebVoiceEngine";
import type { VoiceEngine } from "./VoiceEngine";

/**
 * Android e iOS passam pelo plugin nativo (mesmo sem implementação Swift
 * ainda — `NativeVoiceEngine` degrada para "indisponível" com segurança).
 * Só a web usa a Web Speech API, e só para QA local em Chromium.
 */
export function createVoiceEngine(): VoiceEngine {
  return getPlatform() === "web" ? new WebVoiceEngine() : new NativeVoiceEngine();
}

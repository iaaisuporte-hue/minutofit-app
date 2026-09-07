export const VOICE_WORKOUT_ACK_KEY = "corefit:workout:voiceDisclosureAck";

export function hasVoiceWorkoutAck(): boolean {
  try {
    return localStorage.getItem(VOICE_WORKOUT_ACK_KEY) === "1";
  } catch {
    return false;
  }
}

export function setVoiceWorkoutAck(): void {
  try {
    localStorage.setItem(VOICE_WORKOUT_ACK_KEY, "1");
  } catch {
    /* modo privado — o aviso reaparece na próxima sessão, o que é aceitável */
  }
}

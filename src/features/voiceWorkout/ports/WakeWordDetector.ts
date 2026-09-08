/**
 * Porta de detecção de wake word.
 *
 * P5C entrega uma implementação real, `PorcupineWakeWordDetector` — nome
 * histórico, hoje genérica: fala com o plugin nativo "WakeWord", que por
 * baixo escolhe em build time entre o motor Picovoice Porcupine e um motor
 * ONNX estilo openWakeWord em avaliação (`WAKE_WORD_ENGINE`, ver
 * `docs/produto/voice_workout_wake_word_spike_onnx.md`, repo pai) —
 * **spike aberto, nenhum fornecedor definitivo**. Nenhum outro lado do
 * produto sabe que existe um fornecedor: a máquina de estados
 * (`wakeWordStateMachine.ts`) e o resto do Voice Workout falam só com esta
 * interface. Se nenhum spike validar (ou o fornecedor mudar), só a
 * implementação concreta é trocada — mesmo padrão de `VoiceEngine`/
 * `WorkoutLiveSurface`.
 */

export type WakeWordCapabilities = {
  available: boolean;
  /** Sempre `true` na promessa do produto — nenhum provedor que envie áudio contínuo à nuvem deve ser aprovado (P5C.4/§40). */
  onDevice: boolean;
  provider: string | null;
};

export interface WakeWordDetector {
  /** Começa a ouvir a keyword. Deve ser chamado só com o app visível (mesma regra do FGS de microfone). */
  start(): Promise<void>;
  /** Encerra de vez — libera o microfone. */
  stop(): Promise<void>;
  /** Pausa temporária (durante STT/TTS) sem largar o setup — retomada é rápida. */
  suspend(): Promise<void>;
  resume(): Promise<void>;
  /**
   * Chamado quando uma keyword é reconhecida. `keywordIndex` distingue QUAL
   * variante ("S2CORE" = 0, "Ei S2CORE" = 1) — o protocolo de teste em
   * aparelho real compara as duas sob a mesma sessão. Devolve a função de
   * cancelamento da inscrição.
   */
  onDetected(callback: (keywordIndex: number) => void): () => void;
  /** Erro do detector (AccessKey ausente, falha ao iniciar…) — nunca conteúdo de áudio. */
  onError(callback: (reason: string) => void): () => void;
  getCapabilities(): Promise<WakeWordCapabilities>;
}

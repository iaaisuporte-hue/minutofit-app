/**
 * Porta de detecção de wake word (P5C).
 *
 * Nenhuma implementação real nesta fase — ver a "Wake Word Decision" em
 * `docs/produto/voice_workout_wake_word_decision.md` (repo pai) para o
 * porquê: o fornecedor de referência (Picovoice/Porcupine) encerrou o plano
 * gratuito em 30/06/2026, e a alternativa livre (openWakeWord) exige um
 * spike de treino próprio sem garantia de qualidade em pt-BR — nenhum dos
 * dois está aprovado para produção. Esta porta existe para a máquina de
 * estados (`wakeWordStateMachine.ts`) e o resto do produto poderem ser
 * construídos e testados agora, sem amarrar nada a um SDK específico —
 * quando um fornecedor for aprovado, a implementação real entra aqui,
 * seguindo o mesmo padrão de `VoiceEngine`/`WorkoutLiveSurface`.
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
  /** Chamado quando a keyword é reconhecida. Devolve a função de cancelamento da inscrição. */
  onDetected(callback: () => void): () => void;
  getCapabilities(): Promise<WakeWordCapabilities>;
}

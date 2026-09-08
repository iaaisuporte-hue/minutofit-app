package com.s2core.app.workout;

/**
 * Contrato comum entre motores de wake word (P5C — spike aberto: Picovoice
 * Porcupine e um motor ONNX estilo openWakeWord estão sendo avaliados lado a
 * lado, nenhum é definitivo — ver `docs/produto/voice_workout_wake_word_spike_onnx.md`
 * no repo pai).
 *
 * `WorkoutForegroundService` só conhece esta interface, nunca a classe
 * concreta — o motor ativo é escolhido em build time via
 * `BuildConfig.WAKE_WORD_ENGINE` (`wakeword.properties`, mesmo padrão de
 * `keystore.properties`/`picovoice.properties`). Extraída de
 * `PorcupineWakeWordController` sem mudar seu comportamento.
 */
interface WakeWordEngine {

    interface Callback {
        /** `keywordIndex`: 0 = "S2CORE", 1 = "Ei S2CORE". */
        void onWakeWordDetected(int keywordIndex);
        void onError(String reason);
    }

    void iniciar();
    void suspender();
    void retomar();
    void parar();
}

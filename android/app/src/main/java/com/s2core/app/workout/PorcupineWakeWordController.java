package com.s2core.app.workout;

import android.content.Context;
import android.util.Log;

import com.s2core.app.BuildConfig;

import ai.picovoice.porcupine.PorcupineException;
import ai.picovoice.porcupine.PorcupineManager;
import ai.picovoice.porcupine.PorcupineManagerCallback;

/**
 * Wrapper fino sobre o `PorcupineManager` da Picovoice (P5C — spike técnico
 * de 7 dias, SEM fornecedor definitivo — ver a decisão registrada em
 * `docs/produto/voice_workout_wake_word_decision.md`, repo pai).
 *
 * Só esta classe conhece o SDK da Picovoice. `WorkoutForegroundService`
 * conhece apenas `iniciar`/`suspender`/`retomar`/`parar` — se o spike não
 * validar o fornecedor (a decisão pode ir para outro caminho, ou para
 * nenhum), só esta classe muda; o resto do app nunca soube que ela existiu.
 * Mesma disciplina de abstração do `VoiceEngine` para STT/TTS.
 *
 * Duas keywords carregadas ao mesmo tempo — "S2CORE" (índice 0) e
 * "Ei S2CORE" (índice 1) — porque o protocolo de teste em aparelho real
 * (`docs/produto/voice_workout_wake_word_test_protocol.md`) precisa
 * comparar as duas sob as MESMAS condições de sessão, não em testes
 * separados que podem não ser comparáveis.
 *
 * `PorcupineManager` possui o próprio `AudioRecord` internamente — esta
 * classe nunca grava PCM em disco, nunca envia áudio a lugar nenhum; o
 * único dado que sai é o índice da keyword detectada.
 */
class PorcupineWakeWordController {

    interface Callback {
        /** `keywordIndex`: 0 = "S2CORE", 1 = "Ei S2CORE" (ver `KEYWORD_ASSET_PATHS`). */
        void onWakeWordDetected(int keywordIndex);
        void onError(String reason);
    }

    private static final String TAG = "S2CoreWakeWord";

    /**
     * Nomes fixos esperados dentro de `assets/porcupine/` — arquivos
     * treinados no Picovoice Console (idioma Português) e baixados
     * manualmente para este projeto, o único passo que exige uma conta
     * Picovoice. Ver `assets/porcupine/README.md`.
     */
    private static final String[] KEYWORD_ASSET_PATHS = {
            "porcupine/keyword_s2core.ppn",
            "porcupine/keyword_ei_s2core.ppn",
    };
    private static final String MODEL_ASSET_PATH = "porcupine/porcupine_params_pt.pv";

    /**
     * Ponto de partida para o protocolo de teste em aparelho real (P5C.12),
     * não um valor validado. Mesma sensibilidade para as duas keywords de
     * propósito — o teste real decide se alguma precisa de ajuste
     * individual, e partir igual deixa a comparação limpa.
     */
    private static final float SENSITIVITY = 0.6f;

    private final Context context;
    private final Callback callback;
    private PorcupineManager manager;
    private volatile boolean suspenso = false;

    PorcupineWakeWordController(Context context, Callback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    /**
     * Checagem ESTÁTICA (sem tentar carregar o modelo): só confirma que o
     * AccessKey foi compilado. Não confirma que os dois `.ppn` existem nos
     * assets — isso só se sabe tentando `iniciar()`, que já degrada para
     * `onError` sem derrubar o serviço.
     */
    static boolean accessKeyConfigurado() {
        return BuildConfig.PICOVOICE_ACCESS_KEY != null && !BuildConfig.PICOVOICE_ACCESS_KEY.isEmpty();
    }

    synchronized void iniciar() {
        if (manager != null) return; // já iniciado — chamada repetida é no-op, não erro
        if (!accessKeyConfigurado()) {
            callback.onError("access_key_missing");
            return;
        }
        try {
            manager = new PorcupineManager.Builder()
                    .setAccessKey(BuildConfig.PICOVOICE_ACCESS_KEY)
                    .setKeywordPaths(KEYWORD_ASSET_PATHS)
                    .setModelPath(MODEL_ASSET_PATH)
                    .setSensitivities(new float[]{SENSITIVITY, SENSITIVITY})
                    .build(context, new PorcupineManagerCallback() {
                        @Override
                        public void invoke(int keywordIndex) {
                            // Descartar detecção tardia: se já suspendemos (por
                            // exemplo, o comando anterior ainda está em
                            // processamento) um evento que estava em voo não
                            // pode reabrir um segundo ciclo por cima do primeiro.
                            if (suspenso) return;
                            callback.onWakeWordDetected(keywordIndex);
                        }
                    });
            manager.start();
            suspenso = false;
        } catch (PorcupineException e) {
            // Cobre AccessKey inválido, arquivo de keyword ausente (usuário
            // ainda não treinou/colocou os .ppn) e modelo incompatível com a
            // versão do SDK — todos os casos em que o spike não está
            // configurado ainda, sem derrubar o app.
            Log.w(TAG, "Falha ao iniciar Porcupine: " + e.getMessage());
            manager = null;
            callback.onError("start_failed");
        }
    }

    synchronized void suspender() {
        if (manager == null || suspenso) return;
        try {
            manager.stop();
            suspenso = true;
        } catch (PorcupineException e) {
            Log.w(TAG, "Falha ao suspender Porcupine: " + e.getMessage());
        }
    }

    synchronized void retomar() {
        if (manager == null || !suspenso) return;
        try {
            manager.start();
            suspenso = false;
        } catch (PorcupineException e) {
            Log.w(TAG, "Falha ao retomar Porcupine: " + e.getMessage());
            callback.onError("resume_failed");
        }
    }

    synchronized void parar() {
        if (manager == null) return;
        try {
            manager.stop();
        } catch (PorcupineException e) {
            Log.w(TAG, "Falha ao parar Porcupine: " + e.getMessage());
        }
        manager.delete();
        manager = null;
        suspenso = false;
    }
}

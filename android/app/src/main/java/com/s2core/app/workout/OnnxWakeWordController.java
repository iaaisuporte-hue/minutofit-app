package com.s2core.app.workout;

import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.FloatBuffer;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicBoolean;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

/**
 * Motor de wake word ONNX estilo openWakeWord (P5C — spike aberto, SEM
 * fornecedor definitivo — ver `docs/produto/voice_workout_wake_word_spike_onnx.md`
 * no repo pai). Pipeline de 3 estágios (mel → embedding → classificador),
 * mesma arquitetura do projeto openWakeWord (Apache-2.0,
 * github.com/dscripka/openWakeWord) — `melspectrogram.onnx` e
 * `embedding_model.onnx` são os artefatos oficiais do projeto (genéricos,
 * sem palavra treinada, redistribuídos aqui). Os DOIS classificadores
 * ("S2CORE" e "Ei S2CORE") são treinados por nós com gravações reais em
 * pt-BR — ver `tools/wakeword/` no repo pai — e NÃO estão neste repositório
 * até serem treinados (ver `assets/wakeword/README.md`).
 *
 * Estrutura de captura/inferência adaptada, como REFERÊNCIA de arquitetura
 * (não copiada literalmente), de `alfiedennen/mr-graves`
 * (github.com/alfiedennen/mr-graves, MIT) — um deploy Android de referência
 * do mesmo pipeline. Diferenças estruturais deliberadas: aqui NÃO existe um
 * `Service` próprio, notificação própria, nem broadcast/full-screen-intent —
 * `WorkoutForegroundService` já possui o foreground service, a notificação e
 * o ciclo de vida; este controller só entrega captura + inferência +
 * detecção, no mesmo contrato de `PorcupineWakeWordController`
 * (`WakeWordEngine`). Dois classificadores compartilham as MESMAS sessões
 * de mel/embedding e os MESMOS buffers — só o estágio final diverge por
 * keyword, o que `mr-graves`/`docs/known-limits.md` já antecipa como
 * extensão direta ("pass an array of classifiers, run inference on each").
 *
 * Só esta classe conhece ONNX Runtime — `WorkoutForegroundService` conhece
 * apenas `iniciar/suspender/retomar/parar` (`WakeWordEngine`). Nenhum PCM é
 * gravado em disco ou enviado a lugar nenhum; o único dado que sai é o
 * índice do classificador que disparou.
 */
class OnnxWakeWordController implements WakeWordEngine {

    private static final String TAG = "S2CoreWakeWordOnnx";

    private static final String ASSET_MEL = "wakeword/melspectrogram.onnx";
    private static final String ASSET_EMBED = "wakeword/embedding_model.onnx";
    /** Índice 0 = "S2CORE", índice 1 = "Ei S2CORE" — mesma convenção do Porcupine. */
    private static final String[] ASSET_CLASSIFIERS = {
            "wakeword/classifier_s2core.onnx",
            "wakeword/classifier_ei_s2core.onnx",
    };

    private static final int SAMPLE_RATE = 16_000;
    private static final int CHUNK_SAMPLES = 1280; // 80 ms @ 16 kHz — hop do openWakeWord
    private static final int MEL_BINS = 32;
    private static final int EMBEDDING_INPUT_FRAMES = 76; // ~1,28 s de mel
    private static final int EMBEDDING_DIM = 96;
    private static final int CLASSIFIER_INPUT_EMBEDDINGS = 16;

    /**
     * Ponto de partida, NÃO validado em aparelho real — mr-graves recomenda
     * 0.85 em produção (default de treino é 0.5; 0.85 já incorpora a lição
     * documentada no postmortem deles: modelo com métrica de teste boa mas
     * que dispara a cada poucos segundos em ambiente real). O protocolo de
     * teste (`docs/produto/voice_workout_wake_word_spike_protocol.md`)
     * decide o valor final para cada uma das duas keywords.
     */
    private static final float DEFAULT_THRESHOLD = 0.85f;
    private static final int TRIGGER_FRAMES_REQUIRED = 1;
    private static final long REFRACTORY_MS = 1500L;

    private final Context context;
    private final WakeWordEngine.Callback callback;

    private final AtomicBoolean running = new AtomicBoolean(false);
    /** Espelha `suspender()/retomar()` do Porcupine — libera o AudioRecord sem derrubar as sessões ONNX. */
    private final AtomicBoolean escutaAtiva = new AtomicBoolean(true);
    private Thread threadCaptura;

    private OrtEnvironment ortEnv;
    private OrtSession melSession;
    private OrtSession embedSession;
    /** Um por keyword — `null` se o arquivo do classificador ainda não existe nos assets (não treinado). */
    private final OrtSession[] classifierSessions = new OrtSession[ASSET_CLASSIFIERS.length];

    private final ArrayDeque<float[]> melBuffer = new ArrayDeque<>();
    private final ArrayDeque<float[]> embedBuffer = new ArrayDeque<>();
    private final int[] consecutiveAbove = new int[ASSET_CLASSIFIERS.length];
    private final long[] lastFireMs = new long[ASSET_CLASSIFIERS.length];

    OnnxWakeWordController(Context context, WakeWordEngine.Callback callback) {
        this.context = context.getApplicationContext();
        this.callback = callback;
    }

    @Override
    public synchronized void iniciar() {
        if (running.get()) return; // já iniciado — chamada repetida é no-op, mesmo contrato do Porcupine

        try {
            ortEnv = OrtEnvironment.getEnvironment();
            melSession = abrirSessao(ASSET_MEL);
            embedSession = abrirSessao(ASSET_EMBED);
            boolean algumClassificador = false;
            for (int i = 0; i < ASSET_CLASSIFIERS.length; i++) {
                try {
                    classifierSessions[i] = abrirSessao(ASSET_CLASSIFIERS[i]);
                    algumClassificador = true;
                } catch (IOException | OrtException e) {
                    // Esperado até o classificador ser treinado (tools/wakeword/) e
                    // colocado em assets/wakeword/ — degrada sem derrubar o serviço,
                    // mesmo tratamento do Porcupine para .ppn ausente.
                    Log.w(TAG, "Classificador ausente/inválido: " + ASSET_CLASSIFIERS[i] + " — " + e.getMessage());
                    classifierSessions[i] = null;
                }
            }
            if (!algumClassificador) {
                Log.w(TAG, "Nenhum classificador treinado encontrado em assets/wakeword/");
                fecharTudo();
                callback.onError("model_missing");
                return;
            }
        } catch (IOException | OrtException e) {
            Log.w(TAG, "Falha ao carregar mel/embedding (assets/wakeword/): " + e.getMessage());
            fecharTudo();
            callback.onError("start_failed");
            return;
        }

        running.set(true);
        escutaAtiva.set(true);
        threadCaptura = new Thread(this::loopCaptura, "s2core-wakeword-onnx");
        threadCaptura.setPriority(Thread.MAX_PRIORITY);
        threadCaptura.start();
    }

    @Override
    public synchronized void suspender() {
        // Não derruba a thread nem as sessões — só libera o AudioRecord, o
        // mesmo efeito de `PorcupineManager.stop()`, mas sem recarregar os
        // modelos ONNX ao retomar (mais barato). A thread de captura
        // observa `escutaAtiva` e libera o AudioRecord sozinha.
        escutaAtiva.set(false);
    }

    @Override
    public synchronized void retomar() {
        if (!running.get()) return;
        escutaAtiva.set(true);
    }

    @Override
    public synchronized void parar() {
        running.set(false);
        Thread t = threadCaptura;
        threadCaptura = null;
        if (t != null) t.interrupt();
        fecharTudo();
    }

    private void fecharTudo() {
        fecharSilenciosamente(melSession);
        fecharSilenciosamente(embedSession);
        for (OrtSession s : classifierSessions) fecharSilenciosamente(s);
        melSession = null;
        embedSession = null;
        java.util.Arrays.fill(classifierSessions, null);
        melBuffer.clear();
        embedBuffer.clear();
        java.util.Arrays.fill(consecutiveAbove, 0);
    }

    private static void fecharSilenciosamente(OrtSession s) {
        if (s == null) return;
        try {
            s.close();
        } catch (OrtException e) {
            Log.w(TAG, "Falha ao fechar sessão ONNX: " + e.getMessage());
        }
    }

    private OrtSession abrirSessao(String assetPath) throws IOException, OrtException {
        byte[] modelBytes = carregarAsset(assetPath);
        OrtSession.SessionOptions opts = new OrtSession.SessionOptions();
        try {
            opts.addNnapi();
        } catch (OrtException | RuntimeException e) {
            // NNAPI pode não estar disponível no aparelho/emulador — cai para
            // CPU automaticamente, mesmo comportamento documentado pelo
            // onnxruntime-react-native usado no exemplo mobile do Heed e
            // pelo mr-graves (delegate "falls back to CPU silently").
            Log.w(TAG, "NNAPI indisponível para " + assetPath + ", usando CPU: " + e.getMessage());
        }
        return ortEnv.createSession(modelBytes, opts);
    }

    private byte[] carregarAsset(String path) throws IOException {
        try (InputStream in = context.getAssets().open(path)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    // ── Captura + inferência ────────────────────────────────────────────

    private void loopCaptura() {
        int minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        int bufBytes = Math.max(minBuf, CHUNK_SAMPLES * 2 * 4);

        short[] pcm = new short[CHUNK_SAMPLES];
        float[] pcmFloat = new float[CHUNK_SAMPLES];
        AudioRecord rec = null;

        try {
            while (running.get() && !Thread.currentThread().isInterrupted()) {
                if (!escutaAtiva.get()) {
                    if (rec != null) {
                        rec = liberarAudioRecord(rec);
                    }
                    try {
                        Thread.sleep(200);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                    continue;
                }
                if (rec == null) {
                    rec = adquirirAudioRecord(bufBytes);
                    if (rec == null) {
                        try {
                            Thread.sleep(500);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                        continue;
                    }
                }

                int lidos = rec.read(pcm, 0, CHUNK_SAMPLES, AudioRecord.READ_BLOCKING);
                if (lidos <= 0) continue;
                // openWakeWord espera PCM cru (NÃO normalizado para [-1,1]) — o
                // próprio modelo de mel já embute a escala esperada. Mesma nota
                // de `mr-graves` (`float(x)` sem `/32768`), confirmada contra o
                // pipeline de referência do projeto upstream.
                for (int i = 0; i < lidos; i++) pcmFloat[i] = pcm[i];

                float[][] melFrames = inferirMel(pcmFloat);
                if (melFrames == null) continue;
                for (float[] frame : melFrames) melBuffer.addLast(frame);
                while (melBuffer.size() > EMBEDDING_INPUT_FRAMES + 32) melBuffer.removeFirst();
                if (melBuffer.size() < EMBEDDING_INPUT_FRAMES) continue;

                float[] embed = inferirEmbedding();
                if (embed == null) continue;
                embedBuffer.addLast(embed);
                while (embedBuffer.size() > CLASSIFIER_INPUT_EMBEDDINGS + 8) embedBuffer.removeFirst();
                if (embedBuffer.size() < CLASSIFIER_INPUT_EMBEDDINGS) continue;

                for (int idx = 0; idx < classifierSessions.length; idx++) {
                    if (classifierSessions[idx] == null) continue;
                    Float score = inferirClassificador(idx);
                    if (score != null) tratarScore(idx, score);
                }
            }
        } finally {
            liberarAudioRecord(rec);
        }
    }

    private AudioRecord adquirirAudioRecord(int bufBytes) {
        try {
            @SuppressWarnings("MissingPermission")
            AudioRecord r = new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufBytes);
            if (r.getState() != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "AudioRecord não inicializado");
                r.release();
                return null;
            }
            r.startRecording();
            return r;
        } catch (SecurityException e) {
            // Permissão RECORD_AUDIO revogada entre a checagem do plugin e a
            // captura de fato — degrada sem derrubar o serviço.
            Log.w(TAG, "RECORD_AUDIO negado: " + e.getMessage());
            callback.onError("permission_denied");
            return null;
        }
    }

    private AudioRecord liberarAudioRecord(AudioRecord rec) {
        if (rec == null) return null;
        try {
            rec.stop();
        } catch (IllegalStateException ignored) {
        }
        rec.release();
        // Limpa os buffers ao pausar — evita casar um "Ei S2CORE" dito ao
        // retomar contra fragmentos de mel/embedding de antes da pausa
        // (mesma nota de `mr-graves`).
        melBuffer.clear();
        embedBuffer.clear();
        java.util.Arrays.fill(consecutiveAbove, 0);
        return null;
    }

    private float[][] inferirMel(float[] pcmFloat) {
        try (OnnxTensor tensor = OnnxTensor.createTensor(ortEnv, FloatBuffer.wrap(pcmFloat), new long[]{1, CHUNK_SAMPLES})) {
            String inputName = melSession.getInputNames().iterator().next();
            try (OrtSession.Result out = melSession.run(Collections.singletonMap(inputName, tensor))) {
                // Saída (1, 1, MEL_FRAMES_PER_HOP, 32) — squeeze das duas dims
                // unitárias + escala padrão do openWakeWord: (x/10)+2.
                float[][][][] raw = (float[][][][]) out.get(0).getValue();
                float[][] frames = raw[0][0];
                float[][] escalado = new float[frames.length][];
                for (int i = 0; i < frames.length; i++) {
                    float[] f = frames[i];
                    float[] g = new float[f.length];
                    for (int j = 0; j < f.length; j++) g[j] = (f[j] / 10f) + 2f;
                    escalado[i] = g;
                }
                return escalado;
            }
        } catch (OrtException e) {
            Log.w(TAG, "Falha na inferência do mel: " + e.getMessage());
            return null;
        }
    }

    private float[] inferirEmbedding() {
        int start = melBuffer.size() - EMBEDDING_INPUT_FRAMES;
        float[] flat = new float[EMBEDDING_INPUT_FRAMES * MEL_BINS];
        int p = 0;
        int i = 0;
        for (float[] frame : melBuffer) {
            if (i++ < start) continue;
            System.arraycopy(frame, 0, flat, p, frame.length);
            p += frame.length;
        }
        try (OnnxTensor tensor = OnnxTensor.createTensor(ortEnv, FloatBuffer.wrap(flat),
                new long[]{1, EMBEDDING_INPUT_FRAMES, MEL_BINS, 1})) {
            String inputName = embedSession.getInputNames().iterator().next();
            try (OrtSession.Result out = embedSession.run(Collections.singletonMap(inputName, tensor))) {
                float[][][][] raw = (float[][][][]) out.get(0).getValue();
                return raw[0][0][0];
            }
        } catch (OrtException e) {
            Log.w(TAG, "Falha na inferência do embedding: " + e.getMessage());
            return null;
        }
    }

    private Float inferirClassificador(int idx) {
        int start = embedBuffer.size() - CLASSIFIER_INPUT_EMBEDDINGS;
        float[] flat = new float[CLASSIFIER_INPUT_EMBEDDINGS * EMBEDDING_DIM];
        int p = 0;
        int i = 0;
        for (float[] v : embedBuffer) {
            if (i++ < start) continue;
            System.arraycopy(v, 0, flat, p, v.length);
            p += v.length;
        }
        OrtSession sess = classifierSessions[idx];
        try (OnnxTensor tensor = OnnxTensor.createTensor(ortEnv, FloatBuffer.wrap(flat),
                new long[]{1, CLASSIFIER_INPUT_EMBEDDINGS, EMBEDDING_DIM})) {
            String inputName = sess.getInputNames().iterator().next();
            try (OrtSession.Result out = sess.run(Collections.singletonMap(inputName, tensor))) {
                Object v = out.get(0).getValue();
                // A maioria dos classificadores openWakeWord emite (1,1); o
                // exato shape depende do export do treino (tools/wakeword/) —
                // aceitar as duas formas mais comuns em vez de assumir uma.
                if (v instanceof float[][]) return ((float[][]) v)[0][0];
                if (v instanceof float[]) return ((float[]) v)[0];
                Log.w(TAG, "Shape de saída do classificador inesperado: " + v.getClass());
                return null;
            }
        } catch (OrtException e) {
            Log.w(TAG, "Falha na inferência do classificador " + idx + ": " + e.getMessage());
            return null;
        }
    }

    private void tratarScore(int idx, float score) {
        if (score > DEFAULT_THRESHOLD) {
            consecutiveAbove[idx]++;
        } else {
            consecutiveAbove[idx] = 0;
        }
        if (consecutiveAbove[idx] < TRIGGER_FRAMES_REQUIRED) return;
        long agora = System.currentTimeMillis();
        if (agora - lastFireMs[idx] < REFRACTORY_MS) return;
        lastFireMs[idx] = agora;
        consecutiveAbove[idx] = 0;
        Log.i(TAG, "WAKE idx=" + idx + " score=" + score);
        callback.onWakeWordDetected(idx);
    }
}

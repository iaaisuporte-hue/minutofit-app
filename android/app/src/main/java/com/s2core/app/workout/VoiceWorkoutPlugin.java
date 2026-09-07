package com.s2core.app.workout;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.Locale;

/**
 * Ponte do Voice Workout (P5A) — push-to-talk sobre o `SpeechRecognizer` do
 * sistema (pt-BR, com preferência por reconhecimento offline quando o
 * aparelho tiver) e confirmação falada via `TextToSpeech`, com audio focus
 * TRANSITÓRIO para só abaixar (nunca pausar) a música durante a fala.
 *
 * MVP sem wake word — P5C decide fornecedor (ver plano). O gatilho é sempre
 * explícito: `listenOnce()` chamado pela tela ou pela ação "Falar" da
 * notificação do Live Workout (`WorkoutForegroundService.ACTION_LISTEN`).
 *
 * `enable()`/`disable()` NÃO sobem um serviço próprio — somam/tiram o tipo
 * `microphone` do MESMO `WorkoutForegroundService` do treino (P1D), então
 * ligar a voz nunca duplica a notificação persistente.
 *
 * Contrato minimalista de propósito: `getCapabilities`, `checkPermissions`/
 * `requestPermissions` (auto-gerados pelo Capacitor a partir do `@Permission`
 * abaixo), `listenOnce`, `speak`, `enable`, `disable`. Nenhuma regra de
 * INTERPRETAÇÃO mora aqui — o transcript cru atravessa para o web, que faz o
 * parsing (`voiceIntent.ts`) e decide o comando (`workoutCommands.ts`).
 * Nenhum áudio é persistido: o `SpeechRecognizer` processa em memória e o
 * plugin nunca grava PCM em disco.
 */
@CapacitorPlugin(
        name = "VoiceWorkout",
        permissions = {
                @Permission(alias = VoiceWorkoutPlugin.ALIAS_MICROFONE, strings = { Manifest.permission.RECORD_AUDIO })
        }
)
public class VoiceWorkoutPlugin extends Plugin implements TextToSpeech.OnInitListener {

    static final String ALIAS_MICROFONE = "microphone";

    private SpeechRecognizer reconhecedor;
    private TextToSpeech tts;
    private volatile boolean ttsPronto = false;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequestApi26;
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> { };

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        tts = new TextToSpeech(getContext(), this);
        // A ação "Falar" da notificação chama isto sem PluginCall associado
        // (ver `WorkoutForegroundService.ACTION_LISTEN`).
        WorkoutForegroundService.setOuvirCallback(this::escutarSemChamadaWeb);
    }

    @Override
    protected void handleOnDestroy() {
        WorkoutForegroundService.setOuvirCallback(null);
        limparReconhecedor();
        if (tts != null) tts.shutdown();
        super.handleOnDestroy();
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(new Locale("pt", "BR"));
            ttsPronto = true;
        }
    }

    // ── capacidades ────────────────────────────────────────────────────────

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject r = new JSObject();
        r.put("microphoneAvailable", getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_MICROPHONE));
        r.put("speechRecognitionAvailable", SpeechRecognizer.isRecognitionAvailable(getContext()));
        // Sondagem honesta (P5A): não há API estável para confirmar o pacote
        // pt-BR ON-DEVICE instalado neste aparelho — `EXTRA_PREFER_OFFLINE`
        // é só uma preferência, sem garantia. Reportar `false` é mais seguro
        // que presumir suporte que pode não existir (plano §6/§9 — "nunca
        // presumir offline").
        r.put("onDevicePtBrAvailable", false);
        r.put("ttsAvailable", ttsPronto);
        call.resolve(r);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        if (!temPermissaoMicrofone()) {
            call.reject("permission_denied");
            return;
        }
        WorkoutForegroundService.ativarTipoMicrofone(getContext());
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        WorkoutForegroundService.desativarTipoMicrofone(getContext());
        pararEscuta();
        call.resolve();
    }

    // ── captura (push-to-talk) ────────────────────────────────────────────

    @PluginMethod
    public void listenOnce(PluginCall call) {
        if (!temPermissaoMicrofone()) {
            // Guarda a chamada e retoma no callback — resolver/rejeitar na
            // mesma chamada devolveria "negado" antes de a pessoa responder
            // ao diálogo do sistema (mesmo padrão do `BackgroundLocationPlugin`).
            requestPermissionForAlias(ALIAS_MICROFONE, call, "aposPermissao");
            return;
        }
        iniciarEscuta(call);
    }

    @PermissionCallback
    private void aposPermissao(PluginCall call) {
        if (!temPermissaoMicrofone()) {
            call.reject("permission_denied");
            return;
        }
        iniciarEscuta(call);
    }

    /**
     * Disparado pela ação "Falar" da notificação — sem `PluginCall`, então o
     * resultado só chega ao web pelo evento `transcript`/`error` (a UI da
     * tela, quando existe, escuta os dois caminhos).
     */
    private void escutarSemChamadaWeb() {
        if (!temPermissaoMicrofone()) return;
        new Handler(Looper.getMainLooper()).post(() -> iniciarEscuta(null));
    }

    private void iniciarEscuta(PluginCall call) {
        new Handler(Looper.getMainLooper()).post(() -> {
            if (reconhecedor != null) {
                // Já há uma captura em andamento — recusa a nova em vez de
                // atropelar a que está rodando (comando duplicado por eco de
                // toque, ou notificação + tela quase juntas).
                concluirComErro(call, "recognizer_busy");
                return;
            }
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                concluirComErro(call, "recognizer_unavailable");
                return;
            }

            reconhecedor = SpeechRecognizer.createSpeechRecognizer(getContext());
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
            // Dica, não garantia (§6 do plano) — o sistema cai para rede
            // quando não há pacote offline instalado.
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

            reconhecedor.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rmsdB) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onPartialResults(Bundle partialResults) { }
                @Override public void onEvent(int eventType, Bundle params) { }

                @Override
                public void onError(int error) {
                    limparReconhecedor();
                    concluirComErro(call, motivoDoErro(error));
                }

                @Override
                public void onResults(Bundle results) {
                    limparReconhecedor();
                    ArrayList<String> textos = results == null
                            ? null
                            : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (textos == null || textos.isEmpty() || textos.get(0).trim().isEmpty()) {
                        concluirComErro(call, "empty_audio");
                        return;
                    }
                    float[] scores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);
                    JSObject r = new JSObject();
                    r.put("transcript", textos.get(0));
                    if (scores != null && scores.length > 0) {
                        r.put("confidence", scores[0]);
                    } else {
                        r.put("confidence", JSObject.NULL);
                    }
                    if (call != null) call.resolve(r);
                }
            });

            reconhecedor.startListening(intent);
        });
    }

    private String motivoDoErro(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_NO_MATCH:
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:
                return "empty_audio";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "permission_denied";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "recognizer_busy";
            default:
                return "recognizer_unavailable";
        }
    }

    private void concluirComErro(PluginCall call, String motivo) {
        if (call != null) call.reject(motivo);
    }

    private void limparReconhecedor() {
        if (reconhecedor != null) {
            reconhecedor.destroy();
            reconhecedor = null;
        }
    }

    private void pararEscuta() {
        new Handler(Looper.getMainLooper()).post(this::limparReconhecedor);
    }

    private boolean temPermissaoMicrofone() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    // ── fala ──────────────────────────────────────────────────────────────

    @PluginMethod
    public void speak(PluginCall call) {
        String texto = call.getString("text");
        if (texto == null || texto.trim().isEmpty() || tts == null || !ttsPronto) {
            // TTS é best-effort (ver `NativeVoiceEngine.speak` no web) —
            // nunca rejeita, só resolve sem falar nada.
            call.resolve();
            return;
        }
        pedirAudioFocusTransitorio();
        String utteranceId = "s2core-voice-" + System.currentTimeMillis();
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { }

            @Override
            public void onDone(String utteranceId) {
                devolverAudioFocus();
                call.resolve();
            }

            @Override
            public void onError(String utteranceId) {
                devolverAudioFocus();
                call.resolve();
            }
        });
        tts.speak(texto, TextToSpeech.QUEUE_FLUSH, null, utteranceId);
    }

    private void pedirAudioFocusTransitorio() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes atributos = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
            focusRequestApi26 = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(atributos)
                    .setOnAudioFocusChangeListener(focusListener)
                    .build();
            audioManager.requestAudioFocus(focusRequestApi26);
        } else {
            audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
        }
    }

    private void devolverAudioFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequestApi26 != null) {
            audioManager.abandonAudioFocusRequest(focusRequestApi26);
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
    }
}

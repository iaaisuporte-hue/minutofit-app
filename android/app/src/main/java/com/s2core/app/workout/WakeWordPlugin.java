package com.s2core.app.workout;

import android.Manifest;
import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Ponte do wake word (P5C — spike técnico de 7 dias, SEM fornecedor
 * definitivo; ver `docs/produto/voice_workout_wake_word_decision.md` no
 * repo pai).
 *
 * Mesma divisão de responsabilidade do `VoiceWorkoutPlugin`: nenhuma regra
 * mora aqui, só repassa para `WorkoutForegroundService`, que é quem
 * realmente possui o `PorcupineWakeWordController` e arbitra o microfone
 * entre wake word e captura de comando.
 *
 * Eventos emitidos: `detected` ({keywordIndex: 0|1}) e `error`
 * ({reason: string}) — nunca áudio, nunca transcript.
 */
@CapacitorPlugin(
        name = "WakeWord",
        permissions = {
                @Permission(alias = WakeWordPlugin.ALIAS_MICROFONE, strings = { Manifest.permission.RECORD_AUDIO })
        }
)
public class WakeWordPlugin extends Plugin {

    static final String ALIAS_MICROFONE = "microphone";

    @Override
    public void load() {
        WorkoutForegroundService.setWakeWordCallback(new WorkoutForegroundService.WakeWordCallback() {
            @Override
            public void onDetected(int keywordIndex) {
                JSObject data = new JSObject();
                data.put("keywordIndex", keywordIndex);
                notifyListeners("detected", data);
            }

            @Override
            public void onError(String reason) {
                JSObject data = new JSObject();
                data.put("reason", reason);
                notifyListeners("error", data);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        WorkoutForegroundService.setWakeWordCallback(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", WorkoutForegroundService.wakeWordDisponivel());
        r.put("onDevice", true);
        // Motor decidido em build time (P5C — spike aberto, SEM fornecedor
        // definitivo; ver WAKE_WORD_ENGINE em app/build.gradle).
        r.put("provider", com.s2core.app.BuildConfig.WAKE_WORD_ENGINE);
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!temPermissaoMicrofone()) {
            // Mesmo padrão do `BackgroundLocationPlugin`/`VoiceWorkoutPlugin`:
            // guarda a chamada e retoma no callback do sistema.
            requestPermissionForAlias(ALIAS_MICROFONE, call, "aposPermissao");
            return;
        }
        WorkoutForegroundService.iniciarWakeWord(getContext());
        call.resolve();
    }

    @PermissionCallback
    private void aposPermissao(PluginCall call) {
        if (!temPermissaoMicrofone()) {
            call.reject("permission_denied");
            return;
        }
        WorkoutForegroundService.iniciarWakeWord(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        WorkoutForegroundService.pararWakeWord(getContext());
        call.resolve();
    }

    /** Chamado antes de abrir STT/TTS — a wake word nunca pode disputar o microfone com eles (P5C.9). */
    @PluginMethod
    public void suspend(PluginCall call) {
        WorkoutForegroundService.suspenderWakeWord(getContext());
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        WorkoutForegroundService.retomarWakeWord(getContext());
        call.resolve();
    }

    private boolean temPermissaoMicrofone() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }
}

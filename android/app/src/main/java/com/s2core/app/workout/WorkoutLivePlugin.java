package com.s2core.app.workout;

import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ponte entre a execução de treino (React) e o serviço de primeiro plano do
 * treino (P1D).
 *
 * Sem `@Permission`: `dataSync` não pede nada em tempo de execução — a única
 * permissão em jogo (`POST_NOTIFICATIONS`) já é declarada e tratada em
 * `capacitor.config`/no restante do app desde antes da P1B. Contrato bem
 * menor que o `BackgroundLocationPlugin`: sem localização envolvida, não há
 * pause/resume de coleta nem fila para drenar — só start/update/stop.
 */
@CapacitorPlugin(name = "WorkoutLive")
public class WorkoutLivePlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        enviarAcao(WorkoutForegroundService.ACTION_START, call.getString("title"), call.getString("text"));
        call.resolve();
    }

    /**
     * Guardado por `estaAtivo()`: mesma cautela do `updateState` do tracker —
     * um `update` atrasado chegando depois de `stop()` não deve reviver o
     * serviço; só `start()` faz isso.
     */
    @PluginMethod
    public void update(PluginCall call) {
        if (!WorkoutForegroundService.estaAtivo()) {
            call.resolve();
            return;
        }
        enviarAcao(WorkoutForegroundService.ACTION_UPDATE, call.getString("title"), call.getString("body"));
        call.resolve();
    }

    /**
     * Parar um serviço que NÃO está em primeiro plano não pode passar por `startForegroundService`.
     *
     * Desde o Android 8 todo `startForegroundService` obriga o serviço a chamar `startForeground()` em segundos; senão o
     * sistema lança `ForegroundServiceDidNotStartInTimeException` e derruba o PROCESSO inteiro (o app "fecha sozinho").
     * O "Encerrar treino" do card de treino pendente chama `stop` justamente quando o processo já morreu e o serviço não
     * existe mais (`estaAtivo()` é falso) — o caminho em que o `ACTION_STOP` nunca subia o serviço para o primeiro plano.
     * Sem serviço ativo, basta `stopService` (não cria nada, não tem contrato de `startForeground`).
     */
    @PluginMethod
    public void stop(PluginCall call) {
        if (!WorkoutForegroundService.estaAtivo()) {
            try {
                getContext().stopService(new Intent(getContext(), WorkoutForegroundService.class));
            } catch (Exception ignorado) {
                // Parar o que não existe nunca pode derrubar o app nem falhar o fluxo de abandono.
            }
            call.resolve();
            return;
        }
        enviarAcao(WorkoutForegroundService.ACTION_STOP, null, null);
        call.resolve();
    }

    private void enviarAcao(String acao, String titulo, String texto) {
        Intent i = new Intent(getContext(), WorkoutForegroundService.class);
        i.setAction(acao);
        if (titulo != null) i.putExtra(WorkoutForegroundService.EXTRA_TITLE, titulo);
        if (texto != null) i.putExtra(WorkoutForegroundService.EXTRA_TEXT, texto);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), i);
        } else {
            getContext().startService(i);
        }
    }
}

package com.s2core.app.tracker;

import android.Manifest;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

/**
 * Ponte entre o Tracker (React) e o serviço de primeiro plano.
 *
 * O contrato é deliberadamente pequeno — `start`, `pause`, `resume`, `stop`,
 * `drain` e um evento `location`. Tudo que é regra de negócio (filtro de
 * trajetória, distância, pace, pausa, rascunho, recuperação) continua do lado
 * web, onde já está implementado e testado. O nativo resolve UMA coisa: manter
 * o GPS entregando quando o WebView está suspenso.
 *
 * `drain` é a metade que costuma faltar em integrações assim. Enquanto o
 * WebView dorme, evento emitido não chega a ninguém; o serviço acumula e o web
 * puxa quando acorda. Sem isso, todo o trecho com a tela apagada se perderia
 * mesmo com o serviço funcionando perfeitamente.
 */
@CapacitorPlugin(
        name = "BackgroundLocation",
        permissions = {
                @Permission(
                        alias = BackgroundLocationPlugin.ALIAS_LOCALIZACAO,
                        strings = {
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                        }
                )
        }
)
public class BackgroundLocationPlugin extends Plugin {

    static final String ALIAS_LOCALIZACAO = "location";

    /** Instância viva, para o serviço emitir sem conhecer o Capacitor. */
    private static volatile BackgroundLocationPlugin instancia;

    @Override
    public void load() {
        instancia = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (instancia == this) instancia = null;
        super.handleOnDestroy();
    }

    /** Chamado pelo serviço a cada ponto. Silencioso se ninguém está escutando. */
    static void emitirAoVivo(LocationForegroundService.PontoNativo p) {
        BackgroundLocationPlugin plugin = instancia;
        if (plugin == null) return;
        plugin.notifyListeners("location", paraJs(p));
    }

    private static JSObject paraJs(LocationForegroundService.PontoNativo p) {
        JSObject o = new JSObject();
        o.put("lat", p.lat);
        o.put("lng", p.lng);
        // `JSObject.put(String, Object)` no Android NÃO grava JSON null para um
        // valor null — ele REMOVE a chave (é `org.json.JSONObject` puro por
        // baixo, diferente do que a assinatura sugere). Quando o aparelho não
        // informa precisão/altitude, a chave chega ausente do lado web, não
        // `null`. Inofensivo aqui: toda leitura do lado TypeScript usa `!= null`
        // ou `??`, que tratam ausente e null da mesma forma — mas documentado
        // para não confundir quem for depurar o payload cru.
        o.put("accuracy", p.accuracy);
        o.put("altitude", p.altitude);
        o.put("timestamp", p.timestamp);
        o.put("sequence", p.sequencia);
        return o;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", true);
        r.put("running", LocationForegroundService.estaAtivo());
        r.put("paused", LocationForegroundService.estaPausado());
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!temPermissao()) {
            // Guardamos a chamada e a retomamos no callback: pedir e resolver na
            // mesma chamada devolveria "negado" antes de a pessoa responder.
            requestPermissionForAlias(ALIAS_LOCALIZACAO, call, "aposPermissao");
            return;
        }
        iniciarServico(call.getString("title"), call.getString("text"));
        call.resolve();
    }

    @PermissionCallback
    private void aposPermissao(PluginCall call) {
        if (!temPermissao()) {
            call.reject("location_permission_denied");
            return;
        }
        iniciarServico(call.getString("title"), call.getString("text"));
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        enviarAcao(LocationForegroundService.ACTION_PAUSE, null, null);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        enviarAcao(LocationForegroundService.ACTION_RESUME, null, null);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        enviarAcao(LocationForegroundService.ACTION_STOP, null, null);
        LocationForegroundService.limparFila();
        call.resolve();
    }

    /**
     * Devolve E remove os pontos acumulados enquanto o WebView esteve suspenso.
     *
     * Remover é intencional: o lado web grava cada ponto no rascunho assim que o
     * recebe, então devolver o mesmo ponto duas vezes viraria distância
     * inventada. O `sequence` acompanha para o consumidor conseguir detectar
     * buraco ou repetição se algo der errado.
     */
    @PluginMethod
    public void drain(PluginCall call) {
        List<LocationForegroundService.PontoNativo> pontos = LocationForegroundService.drenar();
        JSArray arr = new JSArray();
        for (LocationForegroundService.PontoNativo p : pontos) arr.put(paraJs(p));
        JSObject r = new JSObject();
        r.put("points", arr);
        r.put("running", LocationForegroundService.estaAtivo());
        call.resolve(r);
    }

    // ── Internos ────────────────────────────────────────────────────────────

    private boolean temPermissao() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == android.content.pm.PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
                == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private void iniciarServico(String titulo, String texto) {
        LocationForegroundService.limparFila();
        enviarAcao(LocationForegroundService.ACTION_START, titulo, texto);
    }

    private void enviarAcao(String acao, String titulo, String texto) {
        Intent i = new Intent(getContext(), LocationForegroundService.class);
        i.setAction(acao);
        if (titulo != null) i.putExtra(LocationForegroundService.EXTRA_TITLE, titulo);
        if (texto != null) i.putExtra(LocationForegroundService.EXTRA_TEXT, texto);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(getContext(), i);
        } else {
            getContext().startService(i);
        }
    }
}

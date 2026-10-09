package com.s2core.app;

import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.s2core.app.tracker.BackgroundLocationPlugin;
import com.s2core.app.workout.VoiceWorkoutPlugin;
import com.s2core.app.workout.WakeWordPlugin;
import com.s2core.app.workout.WorkoutLivePlugin;

public class MainActivity extends BridgeActivity {
    /**
     * Plugins que moram NESTE módulo precisam de registro explícito.
     * `capacitor.plugins.json`, gerado pelo `cap sync`, só lista os que vêm de
     * `node_modules` — um plugin local nunca aparece lá e, sem esta linha,
     * `registerPlugin("BackgroundLocation")` no lado web resolve para um objeto
     * que rejeita toda chamada com "not implemented".
     *
     * O registro vai ANTES de `super.onCreate`: é ele que constrói a ponte, e
     * um plugin registrado depois não entra.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackgroundLocationPlugin.class);
        registerPlugin(WorkoutLivePlugin.class);
        registerPlugin(VoiceWorkoutPlugin.class);
        registerPlugin(WakeWordPlugin.class);
        super.onCreate(savedInstanceState);
        applyEdgeToEdgeMarginsWithKeyboard();
    }

    /**
     * Por que isto existe: no Android 15+ o edge-to-edge é imposto, e com ele
     * `adjustResize` deixa de encolher a janela — o teclado passa a chegar só
     * como inset `ime()`. O listener que o Capacitor 7 registra na WebView
     * (`CapacitorWebView.edgeToEdgeHandler`, com `adjustMarginsForEdgeToEdge:
     * 'auto'`) aplica apenas `systemBars() | displayCutout()` e devolve
     * `CONSUMED`, então o inset do teclado é descartado: a WebView nunca
     * encolhe, `innerHeight`/`visualViewport` não mudam, `--kb-inset` fica em
     * 0 e a barra de lançamento de série some atrás do teclado.
     *
     * Uma View só tem UM listener de insets, então registrar aqui (depois de
     * `super.onCreate`, onde o Capacitor já registrou o dele de forma síncrona)
     * SUBSTITUI o do Capacitor em vez de competir com ele. Topo e laterais são
     * idênticos ao original; só a margem inferior passa a ser o maior entre
     * barras do sistema e teclado (o inset do IME já é medido a partir da borda
     * da tela, ou seja, inclui a barra de navegação).
     *
     * A mesma condição do Capacitor decide se aplica: em Android ≤14 (ou com a
     * config em "disable") nada é registrado e o `adjustResize` do manifesto
     * continua fazendo o trabalho, como antes.
     */
    private void applyEdgeToEdgeMarginsWithKeyboard() {
        Bridge bridge = getBridge();
        if (bridge == null) return; // layout da WebView falhou; não há o que ajustar
        WebView webView = bridge.getWebView();
        if (webView == null || !capacitorAppliesEdgeToEdgeMargins(bridge)) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            // Mesmo contrato do listener original: não repassa os insets aos filhos.
            return WindowInsetsCompat.CONSUMED;
        });
        // Força um novo dispatch para o listener novo valer já na primeira tela.
        ViewCompat.requestApplyInsets(webView);
    }

    /** Espelho da decisão de `CapacitorWebView.edgeToEdgeHandler` (Capacitor 7.6.7). */
    private boolean capacitorAppliesEdgeToEdgeMargins(Bridge bridge) {
        String mode = bridge.getConfig().adjustMarginsForEdgeToEdge();
        if ("force".equals(mode)) return true;
        if (!"auto".equals(mode) || Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            return false;
        }
        TypedValue value = new TypedValue();
        boolean foundOptOut = getTheme().resolveAttribute(
            android.R.attr.windowOptOutEdgeToEdgeEnforcement, value, true
        );
        return !(foundOptOut && value.data != 0);
    }
}

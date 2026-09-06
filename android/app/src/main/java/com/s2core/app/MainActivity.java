package com.s2core.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.s2core.app.tracker.BackgroundLocationPlugin;

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
        super.onCreate(savedInstanceState);
    }
}

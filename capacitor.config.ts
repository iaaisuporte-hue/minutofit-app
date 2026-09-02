import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.s2core.app',
  appName: 'S2Core',
  webDir: 'dist',
  android: {
    // WebView serve os assets em https://localhost — precisa estar liberado no CORS
    // do backend (allowlist explícita). Sem conteúdo misto (tudo https).
    allowMixedContent: false,
    /**
     * Áreas seguras no Android 15+ (SPEC mobile §7).
     *
     * A partir do targetSdk 35 o Android IMPÕE edge-to-edge e ignora
     * `windowOptOutEdgeToEdgeEnforcement` — e este app já está em targetSdk 36
     * por exigência da Play Store. Sem esta linha, o padrão do Capacitor é
     * "disable": a WebView ocupa a tela inteira, o conteúdo passa POR BAIXO da
     * status bar e da barra de gestos, e `env(safe-area-inset-*)` não salva —
     * numa WebView Android ele reporta o recorte do display (notch), não as
     * barras do sistema, então volta 0 justamente onde a sobreposição acontece.
     *
     * "auto" aplica as margens de `systemBars() | displayCutout()` à WebView só
     * quando o aparelho é 15+ e o tema não optou por sair. Em Android 14 e
     * abaixo nada muda, porque lá o edge-to-edge não é imposto.
     */
    adjustMarginsForEdgeToEdge: 'auto',
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

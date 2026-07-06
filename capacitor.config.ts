import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.s2core.app',
  appName: 'S2Core',
  webDir: 'dist',
  android: {
    // WebView serve os assets em https://localhost — precisa estar liberado no CORS
    // do backend (allowlist explícita). Sem conteúdo misto (tudo https).
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;

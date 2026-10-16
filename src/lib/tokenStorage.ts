import { Preferences } from "@capacitor/preferences";
import { isNativeApp } from "./platform";

/**
 * Onde a sessão do usuário mora — a única camada que decide isso.
 *
 * ## O defeito que isto corrige
 *
 * Na web o token sempre viveu em `localStorage`, e continua vivendo: o
 * comportamento web NÃO muda aqui. O problema é o app empacotado: dentro da
 * WKWebView o `localStorage` faz parte do `WKWebsiteDataStore`, que o iOS pode
 * esvaziar sob pressão de armazenamento. O usuário abre o app e está deslogado
 * sem ter pedido nada — algo que não acontece no Android, com o mesmo código.
 * É bug de paridade entre plataformas, não hardening opcional.
 *
 * ## Escolha do armazenamento nativo: `@capacitor/preferences`
 *
 * Decisão consciente e provisória. `@capacitor/preferences` NÃO é Keychain: no
 * iOS grava em `NSUserDefaults` e no Android em `SharedPreferences` — texto
 * claro dentro do sandbox do app, mesma exposição de hoje. O que ele resolve é
 * exatamente o defeito acima: sai do store da WebView, que o sistema purga,
 * para um armazenamento do app, que o sistema não purga.
 *
 * Ficou como interino porque um plugin de Keychain de verdade (ex.
 * `@aparajita/capacitor-secure-storage`) é dependência NATIVA nova, e este
 * trabalho foi feito sem macOS/Xcode e sem device — não havia como compilar nem
 * validar, e uma falha de runtime derrubaria também o Android, que já está em
 * produção. `@capacitor/preferences` é plugin oficial do Capacitor, é o que a
 * Required Reason API `CA92.1` do `PrivacyInfo.xcprivacy` já declara, e a troca
 * futura por Keychain acontece só aqui dentro: nenhum chamador conhece a fonte.
 *
 * ## Por que os getters continuam síncronos
 *
 * `getAccessToken()` é chamado em dezenas de pontos, inclusive no `useState`
 * inicial do `AuthProvider`. A API nativa é assíncrona, então a leitura vem de
 * um cache em memória hidratado no boot por `hydrateTokenStorage()` — que
 * `main.tsx` aguarda ANTES de renderizar quando está no app empacotado. Sem
 * esse await o app subiria com o cache vazio e mandaria para o login alguém que
 * tem sessão válida.
 *
 * Senha do usuário nunca é persistida — em lugar nenhum, em nenhuma camada.
 */

export const TOKEN_KEY = "corefit_token";
export const REFRESH_TOKEN_KEY = "corefit_refresh_token";
/** Chave antiga, ainda lida por compatibilidade e sempre limpa no logout. */
export const LEGACY_TOKEN_KEY = "token";

/** Espelho em memória do storage nativo. Ignorado na web. */
const cache: { access: string | null; refresh: string | null } = {
  access: null,
  refresh: null,
};

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAccessToken(): string | null {
  if (isNativeApp()) return cache.access;
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (isNativeApp()) return cache.refresh;
  if (!hasLocalStorage()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  if (isNativeApp()) {
    cache.access = accessToken;
    if (refreshToken) cache.refresh = refreshToken;
    // Fire-and-forget: o cache já responde às leituras seguintes; a gravação só
    // precisa estar lá no próximo boot.
    void Preferences.set({ key: TOKEN_KEY, value: accessToken }).catch(() => {});
    if (refreshToken) {
      void Preferences.set({ key: REFRESH_TOKEN_KEY, value: refreshToken }).catch(() => {});
    }
    return;
  }

  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(LEGACY_TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  cache.access = null;
  cache.refresh = null;

  // Limpa os dois lados sempre. No app empacotado pode haver resquício de uma
  // versão anterior a esta migração, e logout tem que deixar zero rastro.
  if (hasLocalStorage()) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  if (isNativeApp()) {
    void Preferences.remove({ key: TOKEN_KEY }).catch(() => {});
    void Preferences.remove({ key: REFRESH_TOKEN_KEY }).catch(() => {});
  }
}

/**
 * Carrega a sessão do storage nativo para o cache e, na primeira vez, migra o
 * que estiver em `localStorage` — sem exigir login novo de quem já estava logado
 * na versão anterior do app.
 *
 * No-op na web (lá o `localStorage` é a fonte, lida direto).
 */
export async function hydrateTokenStorage(): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const [access, refresh] = await Promise.all([
      Preferences.get({ key: TOKEN_KEY }),
      Preferences.get({ key: REFRESH_TOKEN_KEY }),
    ]);
    cache.access = access.value ?? null;
    cache.refresh = refresh.value ?? null;
  } catch {
    cache.access = null;
    cache.refresh = null;
  }

  if (cache.access) return;
  await migrateFromLocalStorage();
}

async function migrateFromLocalStorage(): Promise<void> {
  if (!hasLocalStorage()) return;

  const legacyAccess =
    localStorage.getItem(TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
  if (!legacyAccess) return;
  const legacyRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);

  try {
    await Preferences.set({ key: TOKEN_KEY, value: legacyAccess });
    if (legacyRefresh) {
      await Preferences.set({ key: REFRESH_TOKEN_KEY, value: legacyRefresh });
    }
  } catch {
    // Gravação falhou: mantém o `localStorage` como está e segue com o cache em
    // memória. Apagar a origem antes de confirmar o destino perderia a sessão.
    cache.access = legacyAccess;
    cache.refresh = legacyRefresh;
    return;
  }

  cache.access = legacyAccess;
  cache.refresh = legacyRefresh;

  // Só agora: manter cópia no store da WebView anularia o motivo da migração.
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

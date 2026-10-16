/**
 * Ponto de entrada histórico da sessão. A implementação vive em
 * `lib/tokenStorage.ts` desde que o app empacotado passou a guardar o token
 * fora do `localStorage` da WebView — este arquivo continua existindo porque é
 * o que a dúzia de chamadores importa, e trocá-los todos não acrescentaria
 * nada.
 */
export {
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  LEGACY_TOKEN_KEY,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "../lib/tokenStorage";

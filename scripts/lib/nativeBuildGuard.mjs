/**
 * Regras puras do build de distribuição nativo (Android/iOS).
 *
 * Separadas do script (`scripts/build-native.mjs`) para serem testadas pelo
 * Vitest sem rodar build. Duas perguntas, nada além:
 *
 *  1. A VITE_API_URL recebida serve para um app distribuído? (https, host que
 *     não seja da máquina/rede local)
 *  2. O bundle gerado ainda carrega alguma referência a API local?
 *
 * Por que a 2 existe mesmo com a 1: a 1 valida a variável que o script viu; a
 * 2 valida o que de fato foi empacotado. Foi a diferença entre as duas que
 * deixou o projeto iOS com `http://localhost:3000/api` embutido.
 */

const HOST_LOCAL =
  /^(localhost|0\.0\.0\.0|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|\[::1\]|::1)$|\.(local|localhost|internal|lan)$/i;

/**
 * Referências que só fazem sentido apontando para uma API local. Um bundle de
 * produção legítimo contém a string "localhost" (ex.: lista de subdomínios
 * reservados do tenant, base de `new URL` em SSR) — por isso o padrão exige
 * PORTA ou caminho `/api` colado ao host, e não a palavra solta.
 */
const REFERENCIAS_LOCAIS = [
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2|\[::1\])(?::\d+)/gi,
  /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2)\/api\b/gi,
];

/**
 * @param {string | undefined} raw
 * @returns {{ ok: true, url: string } | { ok: false, motivo: string }}
 */
export function validarApiDeDistribuicao(raw) {
  const valor = (raw ?? "").trim();
  if (!valor) {
    return {
      ok: false,
      motivo:
        "VITE_API_URL ausente no ambiente do processo. O .env versionado não conta: " +
        "passe a URL explicitamente (ex.: VITE_API_URL=https://api.exemplo.com/api npm run build:native:ios).",
    };
  }

  let url;
  try {
    url = new URL(valor);
  } catch {
    return { ok: false, motivo: `VITE_API_URL não é uma URL válida: ${valor}` };
  }

  if (url.protocol !== "https:") {
    return {
      ok: false,
      motivo: `VITE_API_URL precisa ser https em build de distribuição (recebido ${url.protocol}).`,
    };
  }

  if (HOST_LOCAL.test(url.hostname)) {
    return {
      ok: false,
      motivo: `VITE_API_URL aponta para um host local (${url.hostname}) — o app instalado não alcança essa máquina.`,
    };
  }

  return { ok: true, url: valor.replace(/\/+$/, "") };
}

/**
 * @param {string} texto conteúdo de um arquivo do bundle
 * @returns {string[]} referências locais encontradas (sem repetição)
 */
export function encontrarReferenciasLocais(texto) {
  const achados = new Set();
  for (const padrao of REFERENCIAS_LOCAIS) {
    for (const m of texto.matchAll(padrao)) achados.add(m[0]);
  }
  return [...achados];
}

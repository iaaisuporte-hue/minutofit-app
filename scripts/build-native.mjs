/**
 * Build de distribuição do app nativo (Capacitor) com a API de produção.
 *
 *   VITE_API_URL=https://<api>/api npm run build:native:ios
 *   VITE_API_URL=https://<api>/api npm run build:native:android
 *   ... -- --sync          também roda `npx cap sync <plataforma>` e confere a cópia
 *   ... -- --check-only    só confere o dist/ (e a cópia nativa) já gerado
 *
 * Mesmo mecanismo do workflow Android (`android-internal-release.yml`): a URL
 * chega pelo AMBIENTE DO PROCESSO, que no Vite vence qualquer arquivo `.env`.
 * O que este script acrescenta é recusar o que antes passava calado:
 *
 *  1. VITE_API_URL ausente, não-https ou de host local → aborta ANTES do build;
 *  2. depois do build, varre dist/ (e a cópia em ios/ ou android/ com --sync)
 *     atrás de API local e confirma que a URL pedida foi de fato embutida.
 *
 * Nenhum valor de ambiente é gravado em arquivo versionado.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { encontrarReferenciasLocais, validarApiDeDistribuicao } from "./lib/nativeBuildGuard.mjs";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const COPIA_NATIVA = {
  ios: join(RAIZ, "ios/App/App/public"),
  android: join(RAIZ, "android/app/src/main/assets/public"),
};

const args = process.argv.slice(2);
const plataforma = args.find((a) => !a.startsWith("--"));
const sincronizar = args.includes("--sync");
const soConferir = args.includes("--check-only");

function falhar(mensagem) {
  console.error(`\n[build-native] FALHOU: ${mensagem}\n`);
  process.exit(1);
}

function arquivosDoBundle(dir) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      // MediaPipe é binário/WASM de terceiro copiado no prebuild — não carrega a API.
      if (nome === "mediapipe") continue;
      saida.push(...arquivosDoBundle(caminho));
    } else if (/\.(js|mjs|html)$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

function conferirBundle(dir, apiUrl) {
  if (!existsSync(dir)) falhar(`pasta do bundle não existe: ${relative(RAIZ, dir)}`);
  const arquivos = arquivosDoBundle(dir);
  let embutida = false;
  const problemas = [];
  for (const arquivo of arquivos) {
    const texto = readFileSync(arquivo, "utf8");
    if (texto.includes(apiUrl)) embutida = true;
    for (const ref of encontrarReferenciasLocais(texto)) {
      problemas.push(`${relative(RAIZ, arquivo)}: ${ref}`);
    }
  }
  if (problemas.length) {
    falhar(`referência a API local no bundle (${relative(RAIZ, dir)}):\n  ${problemas.join("\n  ")}`);
  }
  if (!embutida) {
    falhar(`a VITE_API_URL pedida (${apiUrl}) não aparece em ${relative(RAIZ, dir)} — o build não a usou.`);
  }
  console.log(`[build-native] ok: ${relative(RAIZ, dir)} — ${arquivos.length} arquivos, API ${apiUrl}, nenhuma referência local.`);
}

if (plataforma !== "ios" && plataforma !== "android") {
  falhar('informe a plataforma: "ios" ou "android".');
}

const api = validarApiDeDistribuicao(process.env.VITE_API_URL);
if (!api.ok) falhar(api.motivo);

if (!soConferir) {
  console.log(`[build-native] build de distribuição ${plataforma} com API ${api.url}`);
  execFileSync("npm", ["run", "build"], { cwd: RAIZ, stdio: "inherit", env: process.env });
}

conferirBundle(join(RAIZ, "dist"), api.url);

if (sincronizar) {
  execFileSync("npx", ["cap", "sync", plataforma], { cwd: RAIZ, stdio: "inherit", env: process.env });
}

if (sincronizar || (soConferir && existsSync(COPIA_NATIVA[plataforma]))) {
  conferirBundle(COPIA_NATIVA[plataforma], api.url);
}

if (!sincronizar && !soConferir) {
  console.log(`[build-native] próximo passo: npx cap sync ${plataforma}  (ou rode de novo com -- --sync)`);
}

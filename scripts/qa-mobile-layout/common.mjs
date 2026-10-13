/**
 * Utilidades compartilhadas pelos scripts de QA mobile (Onda 0).
 *
 * Escopo: SÓ QA. Nada daqui é importado pelo app.
 */
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

/** Falha de infraestrutura (ambiente indisponível/inseguro). O runner sai com código 2. */
export class InfraError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InfraError';
  }
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalUrl(u) {
  try {
    return LOCAL_HOSTS.has(new URL(u).hostname);
  } catch {
    return false;
  }
}

/** O QA escreve dados (compliance, fichas, rascunhos). Só roda contra máquina local. */
export function assertLocalUrl(label, u) {
  if (!isLocalUrl(u)) {
    throw new InfraError(
      `${label} (${u}) não é local. A Onda 0 só roda contra localhost: ela cria contas e grava dados.`,
    );
  }
}

export function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new InfraError(`Não consegui ler ${file}: ${err.message}`);
  }
}

/** playwright-core não é dependência do SPA (não instalamos nada): procura cópias já existentes. */
export async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const candidates = [];
  if (process.env.QA_PLAYWRIGHT_CORE) candidates.push(process.env.QA_PLAYWRIGHT_CORE);
  candidates.push('playwright-core');
  const npx = path.join(homedir(), '.npm', '_npx');
  if (existsSync(npx)) {
    for (const d of readdirSync(npx)) {
      const p = path.join(npx, d, 'node_modules', 'playwright-core');
      if (existsSync(path.join(p, 'package.json'))) candidates.push(p);
    }
  }
  candidates.push(path.join(homedir(), '.claude', 'skills', 'gstack', 'node_modules', 'playwright-core'));

  const found = [];
  for (const c of candidates) {
    try {
      const mod = require(c);
      const pkgPath = c === 'playwright-core' ? require.resolve('playwright-core/package.json') : path.join(c, 'package.json');
      found.push({ mod, version: JSON.parse(readFileSync(pkgPath, 'utf8')).version, from: c });
    } catch {
      /* próxima candidata */
    }
  }
  if (!found.length) {
    throw new InfraError('playwright-core não encontrado. Defina QA_PLAYWRIGHT_CORE=/caminho/para/playwright-core.');
  }
  // A mais nova costuma casar com o Chromium mais novo do cache.
  found.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return found[0];
}

export function findChrome() {
  if (process.env.QA_CHROME) return process.env.QA_CHROME;
  const root = path.join(homedir(), '.cache', 'ms-playwright');
  if (!existsSync(root)) throw new InfraError('~/.cache/ms-playwright não existe. Defina QA_CHROME.');
  const dirs = readdirSync(root)
    .filter((d) => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    const p = path.join(root, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new InfraError('Nenhum Chromium em ~/.cache/ms-playwright. Defina QA_CHROME.');
}

/** PNG sólido gerado em memória (sem dependência). Serve de placeholder determinístico. */
export function solidPng(width, height, [r, g, b]) {
  const crcTable = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
  });
  const crc = (buf) => {
    let c = -1;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export async function apiCall(api, pathname, { method = 'GET', token, body } = {}) {
  const res = await fetch(api.replace(/\/$/, '') + pathname, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

export async function apiLogin(api, { email, password }) {
  const r = await apiCall(api, '/auth/login', { method: 'POST', body: { email, password } });
  const token = r.json?.data?.accessToken;
  if (r.status !== 200 || !token) {
    throw new InfraError(`Login falhou para ${email} (HTTP ${r.status}).`);
  }
  return token;
}

/**
 * Contexto de navegador "celular" — fábrica ÚNICA (runner e selftest usam a mesma).
 *
 * Por que `isMobile: false` + `hasTouch: true` e não `isMobile: true`:
 * com `isMobile: true` o Chromium emula "shrink to fit" e EXPANDE a viewport de
 * layout quando o conteúdo estoura — `innerWidth` vira a largura do conteúdo
 * (600 num celular de 390) e as barras `position: fixed` migram para baixo da
 * tela. Resultado: `document.scrollWidth <= innerWidth` passa a ser verdadeiro
 * POR CONSTRUÇÃO, ou seja, o próprio emulador esconde o defeito que se quer
 * medir. Com `isMobile: false` a viewport fica exata, e `hasTouch: true` mantém
 * `(pointer: coarse)` e `(hover: none)` verdadeiros — que é o que o CSS do app lê.
 */
export async function newMobileContext(browser, opts) {
  const {
    width,
    height,
    storageState,
    permissions,
    geolocation,
    dpr = 2,
    reducedMotion = 'reduce',
  } = opts;
  const major = String(browser.version?.() ?? '151').split('.')[0];
  return browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: dpr,
    isMobile: false,
    hasTouch: true,
    userAgent: `Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    // Sem animação a medição não pega elemento no meio de uma transição.
    reducedMotion,
    // um SW contornaria context.route (vazamento externo + shell em cache)
    serviceWorkers: 'block',
    storageState,
    permissions,
    geolocation,
  });
}

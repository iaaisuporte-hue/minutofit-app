#!/usr/bin/env node
/**
 * Runner da matriz de QA mobile (Onda 0) — mede, NÃO corrige.
 *
 *   node scripts/qa-mobile-layout.mjs --creds <creds.json> [opções]
 *
 * Pré-requisitos (ver plans/qa_mobile_layout_2026-10-12.md e a memória
 * `qa-mobile-autenticado-local`): banco DESCARTÁVEL, backend local com
 * QA_SAFE_MODE=1, SPA em dev server apontando para esse backend, fixtures.
 * O runner recusa qualquer URL que não seja localhost: ele cria contas e grava
 * rascunhos.
 *
 * Opções:
 *   --base <url>        SPA                         (padrão http://localhost:5174)
 *   --api <url>         API                         (padrão http://localhost:3101/api)
 *   --creds <arquivo>   { student, personal, nutri, patient } com email/password/id
 *   --out <dir>         raiz dos relatórios         (padrão <repo>/.gstack/qa-reports)
 *   --roles a,b         public,student,personal,nutri
 *   --viewports a,b     ex.: 390x844,844x390
 *   --states a,b        ex.: default,cookie
 *   --only a,b          só cenários cujo id contenha algum dos trechos
 *   --workers <n>       contextos em paralelo       (padrão 3)
 *   --shots all|issues|none                         (padrão all)
 *   --label <texto>     sufixo da pasta de saída
 *
 * Códigos de saída: 0 = matriz executada (achados NÃO reprovam; é baseline)
 *                   1 = reservado (--strict, não usado na Onda 0)
 *                   2 = falha de INFRAESTRUTURA (ambiente fora do ar, inseguro,
 *                       auth impossível, detector cego no canário, >50% de erro)
 */
import { mkdirSync, rmSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLayoutReport, annotateBoxes } from './qa-mobile-layout/detectors.mjs';
import {
  InfraError,
  apiCall,
  apiLogin,
  assertLocalUrl,
  findChrome,
  isLocalUrl,
  loadPlaywright,
  newMobileContext,
  readJson,
  solidPng,
} from './qa-mobile-layout/common.mjs';
import { writeBaseline, printTable } from './qa-mobile-layout/classify-cli.mjs';
import { Blocked, CHROME, COOKIE_KEY, PAGE_LAYERS, touchSwipe, SCENARIOS, VIEWPORTS, clickSelector, clickText, insetsFor, waitVisible } from './qa-mobile-layout/scenarios.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ───────────────────────── CLI ─────────────────────────
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    a[k] = v;
  }
  return a;
}
const ARGS = parseArgs(process.argv.slice(2));
const CFG = {
  base: ARGS.base ?? process.env.QA_BASE ?? 'http://localhost:5174',
  api: ARGS.api ?? process.env.QA_API ?? 'http://localhost:3101/api',
  creds: ARGS.creds ?? process.env.QA_CREDS_FILE,
  out: ARGS.out ?? path.resolve(__dirname, '../../..', '.gstack', 'qa-reports'),
  roles: (ARGS.roles ?? 'public,student,personal,nutri').split(','),
  viewports: ARGS.viewports ? ARGS.viewports.split(',') : null,
  states: ARGS.states ? ARGS.states.split(',') : null,
  only: ARGS.only ?? null,
  workers: Math.max(1, Number(ARGS.workers ?? 3)),
  shots: ARGS.shots ?? 'all',
  label: ARGS.label ?? '',
};

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);
const slug = (s) => s.replace(/[^a-zA-Z0-9._-]+/g, '_');

// ───────────────────────── política de rede (hermética) ─────────────────────────
async function installPolicy(ctx, env) {
  await ctx.route('**/*', (route) => {
    const req = route.request();
    let u;
    try {
      u = new URL(req.url());
    } catch {
      return route.continue();
    }
    if (isLocalUrl(u.origin) || !/^https?:$/.test(u.protocol)) return route.continue();
    env.blockedHosts.set(u.host, (env.blockedHosts.get(u.host) ?? 0) + 1);
    // Imagens externas (GIFs do catálogo, tiles do mapa): placeholder determinístico.
    if (req.method() === 'GET' && req.resourceType() === 'image') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: env.placeholderPng });
    }
    // Qualquer outra coisa externa (scripts de CDN, fontes, escritas): bloqueada.
    return route.abort('blockedbyclient');
  });
}

/**
 * Guarda de escrita: a matriz NÃO grava no banco. Toda requisição não-GET para a API (exceto login/refresh) é
 * interceptada, registrada em `writes` e respondida com um sucesso sintético.
 *
 * Por quê: um cenário (o fim de vídeo do player) registrava uma sessão por execução e, a cada rodada, o dado
 * de teste mudava (a timeline do personal foi afogada por ~70 "Treino registrado") — o baseline deixava de ser
 * reproduzível. Com a guarda, o estado do banco é o do seed, sempre.
 */
async function installWriteGuard(ctx, writes) {
  await ctx.route('**/api/**', (route) => {
    const req = route.request();
    const m = req.method();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.fallback();
    const u = new URL(req.url());
    if (!isLocalUrl(u.origin)) return route.fallback();
    // Escritas de SESSÃO (devolvem o token que o app passa a usar): sem elas a sessão se perde. Não são dado de negócio.
    if (/\/auth\/(login|refresh|switch-academy)$/.test(u.pathname)) return route.fallback();
    writes.push(`${m} ${u.pathname}`);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 0, streak: 1, xp: 0, duplicate: false } }) });
  });
}

async function settle(page, waitSel) {
  if (waitSel) await page.locator(waitSel).first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"], [class*="skeleton" i]'), null, { timeout: 4000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(450);
}

const consentInit = ({ key, mode }) => {
  try {
    if (mode === 'remove') localStorage.removeItem(key);
    else if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false }));
    }
  } catch {
    /* storage indisponível */
  }
};

// ───────────────────────── preflight / auth ─────────────────────────
async function preflight() {
  assertLocalUrl('SPA', CFG.base);
  assertLocalUrl('API', CFG.api);
  if (!CFG.creds) throw new InfraError('Informe --creds <arquivo.json> (ou QA_CREDS_FILE).');
  const creds = readJson(CFG.creds);
  for (const k of ['student', 'personal', 'nutri']) {
    if (!creds[k]?.email || !creds[k]?.password) throw new InfraError(`creds.${k} sem email/password.`);
    // Contas de fixture usam o TLD reservado .invalid: não existem em produção. É a única prova de que o
    // banco por trás da API é descartável (o /health não expõe QA_SAFE_MODE) — recusa credencial "de verdade".
    if (!/\.invalid$/i.test(creds[k].email)) throw new InfraError(`creds.${k}.email não termina em .invalid: o runner só aceita contas de fixture.`);
  }
  let health;
  try {
    health = await apiCall(CFG.api, '/health');
  } catch (err) {
    throw new InfraError(`API fora do ar em ${CFG.api}: ${err.message}`);
  }
  if (health.status !== 200 || health.json?.checks?.db !== 'ok') {
    throw new InfraError(`API não saudável (HTTP ${health.status}): ${JSON.stringify(health.json?.checks ?? health.json)}`);
  }
  try {
    const r = await fetch(CFG.base + '/');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  } catch (err) {
    throw new InfraError(`SPA fora do ar em ${CFG.base}: ${err.message}`);
  }
  return creds;
}

async function canary(env) {
  // Um runner que devolve zero problemas pode estar cego: prova positiva antes de medir.
  const ctx = await newMobileContext(env.browser, { width: 390, height: 844 });
  try {
    const page = await ctx.newPage();
    await page.setContent(
      '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}</style><div class="appShell" style="overflow-x:clip"><button style="width:600px;height:48px">Canário</button></div>',
    );
    const r = await page.evaluate(collectLayoutReport, {});
    const media = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, hoverNone: matchMedia('(hover: none)').matches, w: innerWidth }));
    if (!media.coarse || !media.hoverNone || media.w !== 390) {
      throw new InfraError(`Canário de emulação falhou: ${JSON.stringify(media)} (esperado pointer:coarse, hover:none, innerWidth=390).`);
    }
    if (!r.findings.some((f) => f.type === 'clipped-x')) {
      throw new InfraError('Canário falhou: o detector não acusou um botão cortado por overflow:clip. Rode selftest.mjs.');
    }
    // Controle positivo do P1: um draggable CORRETO, arrastado por toque (CDP), dispara dragstart neste emulador?
    // Se não disparar, "o toque não reordena" no builder seria artefato do emulador, não do app.
    await page.setContent('<!doctype html><div id="d" draggable="true" style="width:200px;height:80px;margin:40px;background:#ccc;user-select:none">arraste</div><script>window.ds=0;document.getElementById("d").addEventListener("dragstart",()=>window.ds++)</script>');
    await touchSwipe(page, { x: 100, y: 80 }, { x: 100, y: 260 }, { steps: 12, holdMs: 500 });
    await page.waitForTimeout(300);
    env.touchDragControl = (await page.evaluate(() => window.ds)) > 0;
  } finally {
    await ctx.close();
  }
}

async function loginRole(env, role, cred, attempt = 1) {
  const ctx = await newMobileContext(env.browser, { width: 390, height: 844 });
  let rateLimited = false;
  try {
    await installPolicy(ctx, env);
    await ctx.addInitScript(consentInit, { key: COOKIE_KEY, mode: 'set' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);
    const apiOrigins = new Set();
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/api/')) apiOrigins.add(u.origin);
    });
    page.on('response', (r) => {
      if (r.url().includes('/auth/login') && r.status() === 429) rateLimited = true;
    });
    await page.goto(`${CFG.base}/login`, { waitUntil: 'domcontentloaded' });
    await page.fill('#email', cred.email);
    await page.fill('#password', cred.password);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/app\//, { timeout: 20000 });
    await page.waitForTimeout(1200);
    const bad = [...apiOrigins].filter((o) => !isLocalUrl(o));
    if (bad.length) throw new InfraError(`O SPA chamou uma API NÃO local (${bad.join(', ')}). Abortando: VITE_API_URL aponta para fora?`);
    const file = path.join(env.tmpDir, `${role}.state.json`);
    await ctx.storageState({ path: file });
    return { file, landing: new URL(page.url()).pathname };
  } catch (err) {
    // O backend limita login a 5/min por IP: espera a janela e tenta de novo (no máx. 3 vezes).
    if (rateLimited && attempt < 3) {
      log(`login ${role}: limite de tentativas (429); aguardando 65s (tentativa ${attempt}/3)`);
      await ctx.close().catch(() => {});
      await new Promise((r) => setTimeout(r, 65000));
      return loginRole(env, role, cred, attempt + 1);
    }
    throw err;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/** Token de acesso guardado no storageState (evita um login a mais, que consome o limite de 5/min). */
function tokenFromState(file) {
  try {
    const st = readJson(file);
    for (const o of st.origins ?? []) {
      const t = (o.localStorage ?? []).find((x) => x.name === 'token' || x.name === 'corefit_token');
      if (t) return t.value;
    }
  } catch {
    /* sem token */
  }
  return null;
}

/** Estado "treino em andamento" obtido pelo FLUXO REAL (nada de editar DOM nem localStorage à mão). */
async function buildActiveWorkoutState(env) {
  const ctx = await newMobileContext(env.browser, { width: 390, height: 844, storageState: env.auth.student.file });
  try {
    await installPolicy(ctx, env);
    await ctx.addInitScript(consentInit, { key: COOKIE_KEY, mode: 'set' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${CFG.base}/app/user/ficha`, { waitUntil: 'domcontentloaded' });
    await settle(page, '.main');
    await clickText(page, 'Iniciar treino');
    await waitVisible(page, '.ws-root');
    await clickText(page, 'Concluir série', { within: '.ws-action-bar' });
    await waitVisible(page, '.ws-rest');
    await clickSelector(page, 'button[aria-label="Sair"]');
    await clickText(page, 'Sair (salvar progresso)');
    await page.waitForTimeout(800);
    await page.goto(`${CFG.base}/app/user/today`, { waitUntil: 'domcontentloaded' });
    await settle(page, '.main');
    await waitVisible(page, '.wmp', 8000);
    const file = path.join(env.tmpDir, 'student-active.state.json');
    await ctx.storageState({ path: file });
    return { file };
  } finally {
    await ctx.close();
  }
}

// ───────────────────────── execução de uma célula ─────────────────────────
function expandRoute(route, ids) {
  return route.replace(/\{(\w+)\}/g, (_, k) => {
    if (ids[k] == null) throw new Blocked(`id "${k}" indisponível para montar a rota`);
    return ids[k];
  });
}

const FAMILY_COVER = new Set(['covered', 'partly-covered', 'unreachable']);

async function runCell(env, cell) {
  const { scenario: sc, vp, state } = cell;
  const out = {
    cell: cell.key,
    scenario: sc.id,
    role: sc.role,
    route: sc.route,
    viewport: vp.name,
    orientation: vp.orientation,
    state,
    status: 'ok',
    startedAt: new Date().toISOString(),
  };
  const t0 = Date.now();
  let ctx;
  const consoleErrors = [];
  const writesRef = { list: [] };
  try {
    const storage =
      sc.role === 'public' ? undefined : state === 'workout-active' ? env.auth.studentActive?.file : env.auth[sc.role]?.file;
    if (sc.role !== 'public' && !storage) throw new Blocked(state === 'workout-active' ? 'estado workout-active não pôde ser montado' : `login do perfil ${sc.role} indisponível`);

    ctx = await newMobileContext(env.browser, { width: vp.w, height: vp.h, storageState: storage, ...(sc.ctxOptions ?? {}) });
    await installPolicy(ctx, env);
    await installWriteGuard(ctx, writesRef.list);
    await ctx.addInitScript(consentInit, { key: COOKIE_KEY, mode: state === 'cookie' ? 'remove' : 'set' });
    const page = await ctx.newPage();
    page.setDefaultTimeout(10000);
    page.on('console', (m) => {
      if (m.type() === 'error' && consoleErrors.length < 6) consoleErrors.push(m.text().slice(0, 200));
    });
    page.on('pageerror', (e) => {
      if (consoleErrors.length < 6) consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`);
    });

    let insets = null;
    if (state === 'safe-area') {
      insets = insetsFor(vp);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
    }

    const route = expandRoute(sc.route, env.ids);
    await page.goto(CFG.base + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await settle(page, sc.wait);

    const finalPath = new URL(page.url()).pathname;
    out.finalPath = finalPath;
    const expectedPath = route.split('?')[0];
    if (finalPath !== expectedPath) out.routeMismatch = true;
    if (sc.role !== 'public' && /^\/login/.test(finalPath)) throw new Blocked('redirecionado para /login (sessão não reconhecida)');
    if (sc.role !== 'public' && finalPath === '/') throw new Blocked('redirecionado para a raiz');

    // ── preparação comum do cenário (consentimentos, abas, fluxo real até a tela alvo) ──
    if (sc.prep) await sc.prep(page, env);

    // ── preparação do estado ──
    let scopeSelector = null;
    let expectOverlay = false;
    if (state === 'offline') {
      await ctx.setOffline(true);
      await page.waitForTimeout(700);
    } else if (state === 'keyboard') {
      const field = sc.keyboardField
        ? page.locator(sc.keyboardField).first()
        : page.locator('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea').filter({ visible: true }).first();
      try {
        await field.waitFor({ state: 'visible', timeout: 5000 });
        await field.focus();
      } catch {
        throw new Blocked('nenhum campo de texto visível para focar (estado keyboard)');
      }
      const kbH = Math.round(vp.h * (vp.orientation === 'landscape' ? 0.55 : 0.42));
      await page.setViewportSize({ width: vp.w, height: vp.h - kbH });
      await page.waitForTimeout(350);
      out.keyboard = { simulated: true, method: 'viewport-resize', keyboardHeight: kbH, note: 'não exercita o --kb-inset do app (IME inset/iOS): confirmar no WebView' };
      out.keyboard.fieldRect = await field.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { t: Math.round(r.top), b: Math.round(r.bottom), visibleInViewport: r.top >= 0 && r.bottom <= window.innerHeight };
      });
    } else if (state.startsWith('overlay:')) {
      const name = state.slice('overlay:'.length);
      const ov = sc.overlays?.[name];
      if (!ov) throw new Blocked(`overlay "${name}" não declarado`);
      await ov.open(page, env);
      await page.waitForTimeout(450);
      scopeSelector = ov.scope ?? null;
      expectOverlay = true;
    }

    // custom steps (medições específicas de um achado); `after:true` roda depois da medição de layout
    const runSteps = async (phase) => {
      if (!sc.steps) return;
      out.custom ??= {};
      for (const [name, fn] of Object.entries(sc.steps)) {
        if (!!fn.after !== (phase === 'after')) continue;
        if (fn.states && !fn.states.includes(state)) continue;
        if (fn.viewports && !fn.viewports.includes(vp.name)) continue;
        try {
          out.custom[name] = await fn.run(page, { env, vp, state });
        } catch (err) {
          out.custom[name] = { error: String(err.message).split('\n')[0], blocked: err instanceof Blocked };
        }
      }
    };
    await runSteps('before');

    // captura CRUA antes de medir: a medição rola contêineres e não pode contaminar a evidência
    if (CFG.shots !== 'none') {
      const f = path.join(env.dirs.shots, `${slug(cell.key)}.jpg`);
      await page.screenshot({ path: f, type: 'jpeg', quality: 55 }).catch(() => {});
      out.screenshot = path.relative(env.runDir, f);
    }

    // ── medição ──
    const report = await page.evaluate(collectLayoutReport, { chrome: CHROME, pageLayers: PAGE_LAYERS, scopeSelector, expectOverlay, insets, maxPerType: 60 });
    out.report = report;
    out.consoleErrors = consoleErrors;
    if (expectOverlay && !scopeSelector && !report.overlayRoots.length) {
      out.status = 'blocked';
      out.reason = 'overlay aberto pelo fluxo mas nenhuma camada modal foi detectada na página';
    }
    // modal de tela cheia aberto sem ninguém ter pedido (ex.: consentimento): o fundo medido é o de trás
    if (!expectOverlay) {
      const full = report.overlayRoots.filter((o) => o.cover >= 0.8 && !/cookie-consent/.test(o.root));
      if (full.length) out.unexpectedOverlay = full.map((o) => o.root);
    }

    await runSteps('after');

    // ── dismiss (overlay) ──
    // O app trata o botão voltar do Android pelo listener nativo do Capacitor → fecharCamadaAberta()
    // (overlayStack/useDismissable), NÃO por popstate. O mesmo hook que registra o overlay na pilha também
    // escuta Escape: overlay que NÃO fecha com Escape comprovadamente não está na pilha do botão voltar.
    // (Fechar com Escape não prova o registro: pode ser handler próprio — por isso vira "não se aplica".)
    if (expectOverlay && sc.overlays?.[state.slice('overlay:'.length)]?.dismiss && (sc.dismissViewports ?? ['390x844']).includes(vp.name)) {
      const y0 = await page.evaluate(() => window.scrollY);
      await page.mouse.move(vp.w / 2, vp.h / 2);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(150);
      const y1 = await page.evaluate(() => window.scrollY);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(450);
      const stillOpen = await page.evaluate((s) => !!(s ? document.querySelector(s) : document.querySelector('[role=dialog],[aria-modal="true"]')), scopeSelector);
      out.dismiss = { escapeClosesOverlay: !stillOpen, backgroundScrolledUnderOverlay: y1 !== y0, pageBehindScrollable: report.doc.scrollsY, method: 'Escape (proxy do registro em overlayStack; o botão físico do Android só em aparelho)' };
    }

    // ── evidência ──
    await captureEvidence(page, out, report, cell, env);
  } catch (err) {
    if (err instanceof Blocked) {
      out.status = 'blocked';
      out.reason = err.message;
    } else if (err instanceof InfraError) {
      throw err;
    } else {
      out.status = 'error';
      out.reason = String(err.message).split('\n')[0];
    }
    out.consoleErrors = consoleErrors;
  } finally {
    out.durationMs = Date.now() - t0;
    if (writesRef.list.length) {
      out.stubbedWrites = [...new Set(writesRef.list)];
      for (const w of writesRef.list) env.stubbedWrites.set(w, (env.stubbedWrites.get(w) ?? 0) + 1);
    }
    await ctx?.close().catch(() => {});
  }
  return out;
}

async function captureEvidence(page, out, report, cell, env) {
  if (CFG.shots === 'none') return;
  const base = slug(cell.key);
  const worst = report.findings.some((f) => f.severity === 'P1' || f.severity === 'P2');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  if (!worst) return;
  // 1) achados estáticos (rect válido em scrollY=0)
  const boxes = report.findings
    .filter((x) => x.rect && !FAMILY_COVER.has(x.type) && (x.severity === 'P1' || x.severity === 'P2') && (x.sy ?? 0) === 0)
    .slice(0, 25)
    .map((x) => ({ l: x.rect.l, t: x.rect.t, w: x.rect.w, h: x.rect.h, color: x.severity === 'P1' ? '#e11d48' : '#f59e0b' }));
  if (boxes.length) {
    await page.evaluate(annotateBoxes, boxes);
    const f = path.join(env.dirs.evidence, `${base}.png`);
    await page.screenshot({ path: f }).catch(() => {});
    out.evidence = [path.relative(env.runDir, f)];
    await page.evaluate(() => document.querySelector('[data-qa-annotation]')?.remove());
  }
  // 2) cobertura/inalcançável: volta à rolagem do instante da medição (até 3)
  const cov = report.findings.filter((x) => FAMILY_COVER.has(x.type) && x.rect).slice(0, 3);
  for (let i = 0; i < cov.length; i++) {
    const x = cov[i];
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), x.sy ?? 0);
    const b = [{ l: x.rect.l, t: x.rect.t, w: x.rect.w, h: x.rect.h, color: '#e11d48' }];
    if (x.coveredBy?.rect) b.push({ l: x.coveredBy.rect.l, t: x.coveredBy.rect.t, w: x.coveredBy.rect.w, h: x.coveredBy.rect.h, color: '#2563eb' });
    await page.evaluate(annotateBoxes, b);
    const f = path.join(env.dirs.evidence, `${base}.cov${i + 1}.png`);
    await page.screenshot({ path: f }).catch(() => {});
    (out.evidence ??= []).push(path.relative(env.runDir, f));
    await page.evaluate(() => document.querySelector('[data-qa-annotation]')?.remove());
  }
}

// ───────────────────────── matriz ─────────────────────────
function buildCells() {
  const vpByName = new Map(VIEWPORTS.map((v) => [v.name, v]));
  const cells = [];
  for (const sc of SCENARIOS) {
    if (!CFG.roles.includes(sc.role)) continue;
    if (CFG.only && !CFG.only.split(',').some((t) => sc.id.includes(t.trim()))) continue;
    const vps = (sc.viewports === 'all' ? VIEWPORTS.map((v) => v.name) : sc.viewports).filter((n) => !CFG.viewports || CFG.viewports.includes(n));
    const overlayStates = Object.keys(sc.overlays ?? {}).map((n) => `overlay:${n}`);
    const states = [...sc.states, ...overlayStates].filter((s) => !CFG.states || CFG.states.includes(s) || CFG.states.includes(s.split(':')[0]));
    for (const state of states) {
      for (const name of vps) {
        const vp = vpByName.get(name);
        if (!vp) continue;
        // Teclado em paisagem: o Android usa o modo "extraído" (tela cheia) e a simulação por viewport reduzida
        // deixa ~190px — artefato, não achado. Só retrato.
        if (state === 'keyboard' && vp.orientation === 'landscape') continue;
        cells.push({ key: `${sc.id}|${vp.name}|${state}`, scenario: sc, vp, state });
      }
    }
  }
  return cells;
}

async function main() {
  const startedAt = new Date();
  const creds = await preflight();
  const { mod: pw, version: pwVersion } = await loadPlaywright();
  const chromePath = findChrome();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(CFG.out, `mobile-layout-${stamp}${CFG.label ? `-${slug(CFG.label)}` : ''}`);
  const dirs = { shots: path.join(runDir, 'shots'), evidence: path.join(runDir, 'evidence') };
  mkdirSync(dirs.shots, { recursive: true });
  mkdirSync(dirs.evidence, { recursive: true });
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'qa-mobile-layout-'));

  const browser = await pw.chromium.launch({ executablePath: chromePath });
  const env = {
    browser,
    base: CFG.base,
    runDir,
    dirs,
    tmpDir,
    auth: {},
    ids: { studentId: creds.student.id, patientId: creds.patient?.id ?? null, planId: null },
    blockedHosts: new Map(),
    stubbedWrites: new Map(),
    placeholderPng: solidPng(320, 240, [214, 218, 224]),
  };
  const meta = { startedAt: startedAt.toISOString(), browser: browser.version(), playwrightCore: pwVersion, base: CFG.base, api: CFG.api, chrome: chromePath };

  try {
    log(`browser ${meta.browser} · playwright-core ${pwVersion}`);
    await canary(env);
    meta.touchDragControl = env.touchDragControl;
    log(`canário OK (o detector enxerga um botão cortado por overflow:clip) · controle de arrasto por toque: ${env.touchDragControl ? 'dragstart dispara' : 'dragstart NÃO dispara (P1 ficará com ressalva)'}`);

    // login dos perfis pedidos
    const needed = new Set(CFG.roles.filter((r) => r !== 'public'));
    const authErrors = {};
    for (const role of needed) {
      try {
        env.auth[role] = await loginRole(env, role, creds[role]);
        log(`login ${role}: ok → ${env.auth[role].landing}`);
      } catch (err) {
        if (err instanceof InfraError) throw err;
        authErrors[role] = String(err.message).split('\n')[0];
        log(`login ${role}: FALHOU — ${authErrors[role]}`);
      }
    }
    if (needed.size && !Object.keys(env.auth).length) throw new InfraError(`nenhum login funcionou: ${JSON.stringify(authErrors)}`);
    meta.authErrors = authErrors;

    // id da ficha do aluno (para a rota /treino/:planId/:dia)
    if (env.auth.personal) {
      try {
        const tok = tokenFromState(env.auth.personal.file) ?? (await apiLogin(CFG.api, creds.personal));
        const plans = await apiCall(CFG.api, `/personal/students/${creds.student.id}/workout-plans`, { token: tok });
        env.ids.planId = plans.json?.data?.[0]?.id ?? null;
      } catch {
        /* a rota da sessão ficará bloqueada */
      }
    }

    const cells = buildCells();
    if (cells.some((c) => c.state === 'workout-active') && env.auth.student) {
      try {
        env.auth.studentActive = await buildActiveWorkoutState(env);
        log('estado workout-active montado pelo fluxo real (mini-player visível)');
      } catch (err) {
        meta.workoutActiveError = String(err.message).split('\n')[0];
        log(`estado workout-active BLOQUEADO — ${meta.workoutActiveError}`);
      }
    }

    log(`${cells.length} células · ${CFG.workers} workers`);
    const results = new Array(cells.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < cells.length) {
        const i = next++;
        results[i] = await runCell(env, cells[i]);
        done++;
        if (done % 25 === 0 || done === cells.length) {
          const bad = results.filter((r) => r && r.status !== 'ok').length;
          log(`${done}/${cells.length} (bloqueadas/erro: ${bad})`);
        }
      }
    };
    await Promise.all(Array.from({ length: CFG.workers }, worker));

    meta.finishedAt = new Date().toISOString();
    meta.blockedExternalHosts = Object.fromEntries(env.blockedHosts);
    meta.stubbedWrites = Object.fromEntries(env.stubbedWrites); // escritas que a matriz TENTOU fazer e que foram interceptadas
    const errors = results.filter((r) => r.status === 'error').length;
    const payload = { meta, ids: env.ids, cells: results };
    writeFileSync(path.join(runDir, 'report.json'), JSON.stringify(payload, null, 1));
    log(`relatório: ${path.join(runDir, 'report.json')}`);
    const { out: baselineFile, result: classified } = writeBaseline(path.join(runDir, 'report.json'));
    printTable(classified);
    log(`baseline: ${baselineFile}`);
    const by = (s) => results.filter((r) => r.status === s).length;
    log(`ok=${by('ok')} bloqueadas=${by('blocked')} erro=${by('error')}`);
    if (errors > results.length * 0.5) throw new InfraError(`${errors}/${results.length} células com erro — ambiente instável`);
    process.exitCode = 0;
    return runDir;
  } finally {
    await browser.close().catch(() => {});
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(`[qa-mobile-layout] ${err.name}: ${err.message}`);
  process.exit(err instanceof InfraError ? 2 : 1);
}).then(() => process.exit(process.exitCode ?? 0));

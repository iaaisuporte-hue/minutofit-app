#!/usr/bin/env node
/**
 * Onda 1C — overlays, safe-area e foco em Chromium (simulação). Asserções DINÂMICAS medidas no navegador.
 *
 *   node scripts/qa-mobile-layout/combined-1c.mjs --student <storage.json> --active <storage-treino-ativo.json> [--out r.json]
 *
 * O QUE ISTO NÃO PROVA: o botão voltar do Android (Capacitor `backButton`) e o `env()` real do iOS/Android
 * só existem em aparelho. Aqui, "voltar" é coberto por teste unitário da pilha (`overlayStack`) e Escape no browser.
 * Contexto somente-leitura: toda escrita não-GET da API é interceptada.
 */
import { writeFileSync } from 'node:fs';
import { findChrome, loadPlaywright, newMobileContext } from './common.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const BASE = a.base ?? 'http://localhost:5174';
const KEY = 'corefit_cookie_consent_v1';
const VPS = [
  { name: '320x568', w: 320, h: 568 },
  { name: '390x844', w: 390, h: 844, insets: { top: 47, bottom: 34, left: 0, right: 0 } },
  { name: '844x390', w: 844, h: 390, insets: { top: 0, bottom: 21, left: 47, right: 47 } },
];
const results = [];
const check = (scenario, vp, name, ok, detail) => results.push({ scenario, vp: vp.name, name, ok: !!ok, detail });

async function mk(browser, vp, storage, { consent }) {
  const ctx = await newMobileContext(browser, { width: vp.w, height: vp.h, storageState: storage });
  await ctx.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || /\/auth\/(login|refresh|switch-academy)/.test(req.url())) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.addInitScript(([k, set]) => { try { set ? localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })) : localStorage.removeItem(k); } catch {} }, [KEY, consent]);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
  return { ctx, page };
}

const hitOk = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
  e.scrollIntoView({ block: 'nearest' });
  const b = e.getBoundingClientRect();
  const h = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1));
  return { t: (e.textContent || '').trim().slice(0, 20), ok: !!h && (e === h || e.contains(h)) };
}), sel);

async function openProfile(page) {
  await page.goto(`${BASE}/app/user/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

async function scenarioConfirm(browser) {
  for (const vp of VPS) {
    const { ctx, page } = await mk(browser, vp, a.student, { consent: true });
    const S = 'S1 ConfirmDialog (Sair da conta)';
    try {
      await openProfile(page);
      const trigger = page.getByRole('button', { name: /Sair da conta/ }).first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.focus();
      await trigger.click();
      await page.waitForSelector('[role=dialog]');
      const m = await page.evaluate(() => {
        const d = document.querySelector('[role=dialog]').getBoundingClientRect();
        return { top: d.top, bottom: d.bottom, left: d.left, right: d.right, ih: innerHeight, iw: innerWidth, overflow: document.body.style.overflow };
      });
      check(S, vp, 'diálogo cabe na área visível', m.top >= 0 && m.bottom <= m.ih && m.left >= 0 && m.right <= m.iw, JSON.stringify(m));
      check(S, vp, 'scroll lock ativo', m.overflow === 'hidden', m.overflow);
      const hits = await hitOk(page, '[role=dialog][aria-modal=true] button');
      check(S, vp, 'todos os botões recebem o toque (não cobertos)', hits.length >= 2 && hits.every((h) => h.ok), JSON.stringify(hits));
      const safeBottom = vp.insets?.bottom ?? 0;
      const gap = await page.evaluate(() => { const bs = [...document.querySelectorAll('[role=dialog] button')]; return innerHeight - Math.max(...bs.map((b) => b.getBoundingClientRect().bottom)); });
      check(S, vp, 'ações acima do home indicator', gap >= safeBottom, `gap=${gap} inset=${safeBottom}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(S, vp, 'Escape fecha o diálogo', (await page.locator('[role=dialog]').count()) === 0, '');
      check(S, vp, 'scroll lock liberado', (await page.evaluate(() => document.body.style.overflow)) !== 'hidden', await page.evaluate(() => document.body.style.overflow));
      const focusBack = await page.evaluate(() => /Sair da conta/.test(document.activeElement?.textContent || ''));
      check(S, vp, 'foco devolvido ao gatilho', focusBack, await page.evaluate(() => document.activeElement?.tagName + ':' + (document.activeElement?.textContent || '').slice(0, 20)));
    } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
    await ctx.close();
  }
}

async function scenarioModalLayers(browser) {
  // Modal "Editar perfil" com cookie + mini-player + nav simultâneos, e viewport encolhida (teclado simulado).
  for (const vp of VPS) {
    const { ctx, page } = await mk(browser, vp, a.active, { consent: false });
    const S = 'S2 modal + cookie + mini-player';
    try {
      await openProfile(page);
      await page.waitForSelector('.wmp', { timeout: 6000 }).catch(() => {});
      // A página ainda cresce enquanto os dados chegam: espera estabilizar e centraliza o botão antes de tocar.
      await page.waitForTimeout(1500);
      // Varre a rolagem até achar uma posição em que "Editar" recebe o toque (prova de alcance) e toca nela.
      const pos = await page.evaluate(async () => {
        const e = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Editar');
        const max = document.documentElement.scrollHeight;
        for (let y = 0; y <= max; y += 30) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 40));
          const b = e.getBoundingClientRect();
          if (b.top < 0 || b.bottom > innerHeight) continue;
          const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
          if (h && (e === h || e.contains(h))) return { x: b.left + b.width / 2, y: b.top + b.height / 2, scroll: y };
        }
        return null;
      });
      check(S, vp, '"Editar" alcançável por rolagem com banner + mini-player + nav', !!pos, JSON.stringify(pos));
      if (!pos) { await ctx.close(); continue; }
      await page.mouse.click(pos.x, pos.y);
      await page.waitForSelector('[role=dialog]');
      const hits = await hitOk(page, '[role=dialog][aria-modal=true] button');
      check(S, vp, 'botões do modal acima do banner, do mini-player e da nav', hits.length >= 2 && hits.every((h) => h.ok), JSON.stringify(hits));
      // teclado simulado: viewport muito mais baixa
      const kbH = Math.round(vp.h * 0.55);
      await page.setViewportSize({ width: vp.w, height: kbH });
      await page.waitForTimeout(300);
      const panel = await page.evaluate(() => { const d = document.querySelector('[role=dialog][aria-modal=true]'); const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ih: innerHeight, scrolls: d.scrollHeight > d.clientHeight }; });
      check(S, vp, 'com viewport reduzida (teclado) o painel segue dentro da tela', panel.top >= -1 && panel.bottom <= panel.ih + 1, JSON.stringify(panel));
      const save = page.locator('[role=dialog] button').filter({ hasText: /^Salvar$/ }).first();
      await save.scrollIntoViewIfNeeded();
      const reach = await hitOk(page, '[role=dialog][aria-modal=true] button');
      check(S, vp, 'Salvar/Cancelar alcançáveis após rolar o painel (viewport reduzida)', reach.some((h) => /Salvar/.test(h.t) && h.ok), JSON.stringify(reach));
    } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
    await ctx.close();
  }
}

async function scenarioSheet(browser) {
  for (const vp of VPS) {
    const { ctx, page } = await mk(browser, vp, a.student, { consent: true });
    const S = 'S3 sheet do treino livre';
    try {
      await page.goto(`${BASE}/app/user/treino-livre`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);
      const add = page.getByRole('button', { name: /Adicionar exercício/ }).first();
      await add.scrollIntoViewIfNeeded();
      await add.click();
      await page.waitForSelector('[role=dialog]');
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const p = document.querySelector('.fw-sheet') || document.querySelector('[role=dialog]');
        const r = p.getBoundingClientRect();
        const head = document.querySelector('.fw-sheet-head')?.getBoundingClientRect();
        const close = document.querySelector('.fw-sheet-close');
        const cb = close?.getBoundingClientRect();
        const h = close ? document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2) : null;
        return { top: r.top, bottom: r.bottom, ih: innerHeight, headTop: head?.top ?? null, closeHit: !!h && (close === h || close.contains(h)) };
      });
      check(S, vp, 'sheet dentro da viewport (topo e base visíveis)', m.top >= -1 && m.bottom <= m.ih + 1, JSON.stringify(m));
      check(S, vp, 'cabeçalho e botão fechar acessíveis', (m.headTop ?? 0) >= -1 && m.closeHit, JSON.stringify(m));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      check(S, vp, 'Escape fecha o sheet', (await page.locator('[role=dialog]').count()) === 0, '');
    } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
    await ctx.close();
  }
}

async function scenarioWorkoutSafeArea(browser) {
  const vp = VPS.find((v) => v.name === '844x390');
  const { ctx, page } = await mk(browser, vp, a.active, { consent: true });
  const S = 'S4 Modo Treino safe-area paisagem';
  try {
    await openProfile(page);
    await page.waitForSelector('.wmp__body', { timeout: 6000 });
    await page.locator('.wmp__body').click();
    await page.waitForSelector('.ws-root', { timeout: 8000 });
    await page.waitForTimeout(800);
    const L = vp.insets.left, R = vp.insets.right;
    const m = await page.evaluate(() => {
      const f = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const b = e.getBoundingClientRect(); return { t: (e.textContent || '').trim().slice(0, 14), l: Math.round(b.left), r: Math.round(b.right) }; });
      return { top: f('.ws-top button, .ws-top a'), bar: f('.ws-action-bar button, .ws-rest button'), iw: innerWidth };
    });
    const within = (arr) => arr.length > 0 && arr.every((x) => x.l >= L - 1 && x.r <= m.iw - R + 1);
    check(S, vp, 'controles do topo (Sair) fora do recorte lateral', within(m.top), JSON.stringify(m.top));
    check(S, vp, 'controles da barra de ações fora do recorte lateral', within(m.bar), JSON.stringify(m.bar));
  } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
  await ctx.close();
}

const { mod } = await loadPlaywright();
const browser = await mod.chromium.launch({ executablePath: findChrome() });
try {
  await scenarioConfirm(browser);
  await scenarioModalLayers(browser);
  await scenarioSheet(browser);
  await scenarioWorkoutSafeArea(browser);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} asserções OK`);
for (const f of failed) console.log(`FALHA [${f.scenario}] ${f.vp} — ${f.name} :: ${String(f.detail).slice(0, 260)}`);
if (a.out) writeFileSync(a.out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);

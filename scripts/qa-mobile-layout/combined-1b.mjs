#!/usr/bin/env node
/**
 * Onda 1B — cenários combinados com asserções DINÂMICAS (alturas e reservas
 * medidas no navegador, nunca "a variável CSS existe").
 *
 *   node scripts/qa-mobile-layout/combined-1b.mjs --student <storage.json> --active <storage-treino-ativo.json> \
 *        --base http://localhost:5174 [--out resultado.json]
 *
 * Só leitura (a única escrita possível é a que o app faria; a guarda de
 * escrita da matriz principal não é necessária aqui porque nenhum cenário salva).
 */
import { writeFileSync } from 'node:fs';
import { findChrome, loadPlaywright, newMobileContext } from './common.mjs';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const BASE = a.base ?? 'http://localhost:5174';
const VPS = [
  { name: '320x568', w: 320, h: 568 },
  { name: '390x844', w: 390, h: 844 },
  { name: '844x390', w: 844, h: 390, insets: { top: 0, bottom: 21, left: 47, right: 47 } },
  { name: '768x1024', w: 768, h: 1024 },
];
const KEY = 'corefit_cookie_consent_v1';
const results = [];
/** Contexto com guarda de escrita: nenhuma chamada não-GET da API chega ao backend (exceto auth). */
async function mk(browser, opts) {
  const ctx = await newMobileContext(browser, opts);
  await ctx.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || /\/auth\/(login|refresh|switch-academy)/.test(req.url())) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return ctx;
}
const check = (scenario, vp, name, ok, detail) => results.push({ scenario, vp: vp.name, name, ok: !!ok, detail });

const rectOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, display: cs.display, z: cs.zIndex };
  }, sel);

const cssVar = (page, n) => page.evaluate((v) => document.documentElement.style.getPropertyValue(v), n);

/** Último elemento interativo do conteúdo, depois de rolar até o fim: precisa ficar livre de qualquer camada fixa. */
async function lastActionIsReachable(page, vp, scenario) {
  // A página cresce enquanto os dados chegam: rola até a altura estabilizar.
  let prev = -1;
  for (let i = 0; i < 6; i++) {
    const sh = await page.evaluate(() => { window.scrollTo(0, 1e7); return document.documentElement.scrollHeight; });
    await page.waitForTimeout(350);
    if (sh === prev) break;
    prev = sh;
  }
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.main a[href], .main button, .main [role=button], .main input, .main select')].filter((e) => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && e.checkVisibility?.() !== false;
    });
    const last = els.sort((x, y) => y.getBoundingClientRect().bottom - x.getBoundingClientRect().bottom)[0];
    if (!last) return null;
    const b = last.getBoundingClientRect();
    const px = Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1);
    const py = Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1);
    const hit = document.elementFromPoint(px, py);
    return { label: (last.textContent || last.getAttribute('aria-label') || last.tagName).trim().slice(0, 30), bottom: b.bottom, ih: innerHeight, free: !!hit && (last === hit || last.contains(hit) || hit.contains(last)), hit: hit?.className?.toString().slice(0, 40) };
  });
  check(scenario, vp, 'último elemento interativo alcançável (não coberto)', r?.free, JSON.stringify(r));
}

async function scenarioCookieNav(browser) {
  for (const vp of VPS) {
    const ctx = await mk(browser, { width: vp.w, height: vp.h, storageState: a.student });
    await ctx.addInitScript((k) => { try { localStorage.removeItem(k); } catch {} }, KEY);
    const page = await ctx.newPage();
    if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
    await page.goto(`${BASE}/app/user/today`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.cookie-consent__inner', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const S = 'S1 cookie+bottom nav';
    const nav = await rectOf(page, '.mobileBottomNav');
    const ck = await rectOf(page, '.cookie-consent');
    check(S, vp, 'nav visível no shell', nav && nav.display !== 'none', JSON.stringify(nav));
    check(S, vp, 'cookie banner visível', ck && ck.h > 0, JSON.stringify(ck));
    if (nav && ck) {
      check(S, vp, 'banner termina acima da nav (sem sobreposição)', ck.bottom <= nav.top + 1, `ck.bottom=${ck.bottom} nav.top=${nav.top}`);
      const hits = await page.evaluate(() => [...document.querySelectorAll('.mobileBottomNav a, .mobileBottomNav button')].map((e) => {
        const b = e.getBoundingClientRect();
        const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!h && (e === h || e.contains(h));
      }));
      check(S, vp, 'todos os itens da nav recebem o toque', hits.length > 0 && hits.every(Boolean), `${hits.filter(Boolean).length}/${hits.length}`);
      const hv = Number.parseFloat(await cssVar(page, '--cookie-consent-h'));
      check(S, vp, '--cookie-consent-h = altura medida do banner', Math.abs(hv - ck.h) <= 1, `var=${hv} medido=${ck.h}`);
      const pb = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.main')).paddingBottom));
      check(S, vp, 'reserva do .main >= nav + banner', pb >= nav.h + ck.h - 1, `padding-bottom=${pb} nav=${nav.h} banner=${ck.h}`);
    }
    await lastActionIsReachable(page, vp, S);
    // dispensar o banner: reserva residual deve zerar
    await page.getByRole('button', { name: /Recusar opcionais/ }).click().catch(() => {});
    await page.waitForTimeout(400);
    check(S, vp, 'sem reserva residual após aceitar', (await cssVar(page, '--cookie-consent-h')) === '', await cssVar(page, '--cookie-consent-h'));
    await ctx.close();
  }
}

async function scenarioMini(browser, withCookie) {
  for (const vp of VPS) {
    const ctx = await mk(browser, { width: vp.w, height: vp.h, storageState: a.active });
    await ctx.addInitScript(([k, rm]) => { try { rm ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })); } catch {} }, [KEY, withCookie]);
    const page = await ctx.newPage();
    if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
    await page.goto(`${BASE}/app/user/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.wmp', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    const S = withCookie ? 'S2 cookie+mini-player+nav' : 'S3 mini-player+último botão';
    const nav = await rectOf(page, '.mobileBottomNav');
    const mp = await rectOf(page, '.wmp');
    const ck = withCookie ? await rectOf(page, '.cookie-consent') : null;
    check(S, vp, 'mini-player visível', mp && mp.h > 0, JSON.stringify(mp));
    if (mp && nav) {
      check(S, vp, 'mini-player termina acima da nav', mp.bottom <= nav.top + 1, `mp.bottom=${mp.bottom} nav.top=${nav.top}`);
      const hv = Number.parseFloat(await cssVar(page, '--mini-player-h'));
      check(S, vp, '--mini-player-h = altura medida', Math.abs(hv - mp.h) <= 1, `var=${hv} medido=${mp.h}`);
    }
    if (withCookie && ck && mp) {
      check(S, vp, 'banner termina acima do mini-player', ck.bottom <= mp.top + 1, `ck.bottom=${ck.bottom} mp.top=${mp.top}`);
      const pb = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.main')).paddingBottom));
      check(S, vp, 'reserva do .main >= nav + mini + banner', pb >= nav.h + mp.h + ck.h - 1, `padding-bottom=${pb} (${nav.h}+${mp.h}+${ck.h})`);
    }
    await lastActionIsReachable(page, vp, S);
    await ctx.close();
  }
}

async function scenarioOffline(browser) {
  for (const vp of VPS) {
    const ctx = await mk(browser, { width: vp.w, height: vp.h, storageState: a.student });
    await ctx.addInitScript((k) => { try { localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })); } catch {} }, KEY);
    const page = await ctx.newPage();
    if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
    await page.goto(`${BASE}/app/user/today`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mobileTopBar', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForSelector('.offline-banner', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);
    const S = 'S4 offline+top bar';
    const ob = await rectOf(page, '.offline-banner');
    const tb = await rectOf(page, '.mobileTopBar');
    check(S, vp, 'banner offline visível', ob && ob.h > 0, JSON.stringify(ob));
    if (ob && tb) {
      check(S, vp, 'top bar começa abaixo do banner (sem sobreposição)', tb.top >= ob.bottom - 1, `tb.top=${tb.top} ob.bottom=${ob.bottom}`);
      const hits = await page.evaluate(() => [...document.querySelectorAll('.mobileTopBar a, .mobileTopBar button')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
        const b = e.getBoundingClientRect();
        const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return !!h && (e === h || e.contains(h));
      }));
      check(S, vp, 'controles da top bar recebem o toque', hits.length > 0 && hits.every(Boolean), `${hits.filter(Boolean).length}/${hits.length}`);
      const alpha = await page.evaluate(() => {
        const el = document.querySelector('.offline-banner');
        const cs = getComputedStyle(el);
        return { image: cs.backgroundImage.slice(0, 60), color: cs.backgroundColor };
      });
      check(S, vp, 'fundo composto sobre superfície opaca (gradiente + cor sólida)', /gradient/.test(alpha.image) && /rgb\(|rgba\(.*,\s*1\)/.test(alpha.color), JSON.stringify(alpha));
      const hv = Number.parseFloat(await cssVar(page, '--offline-banner-h'));
      check(S, vp, '--offline-banner-h = altura medida', Math.abs(hv - ob.h) <= 1, `var=${hv} medido=${ob.h}`);
      const mainTop = await page.evaluate(() => document.querySelector('.main .container')?.getBoundingClientRect().top ?? 0);
      check(S, vp, 'conteúdo começa abaixo da top bar', mainTop >= tb.bottom - 1, `container.top=${mainTop} tb.bottom=${tb.bottom}`);
    }
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForTimeout(300);
    check(S, vp, 'sem reserva residual ao voltar online', (await cssVar(page, '--offline-banner-h')) === '', await cssVar(page, '--offline-banner-h'));
    await ctx.close();
  }
}

async function scenarioToastModal(browser) {
  for (const vp of VPS.filter((v) => v.w <= 844)) {
    const ctx = await mk(browser, { width: vp.w, height: vp.h, storageState: a.student });
    await ctx.addInitScript((k) => { try { localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })); } catch {} }, KEY);
    const page = await ctx.newPage();
    page.setDefaultTimeout(6000);
    if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
    await page.goto(`${BASE}/app/user/profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const S = 'S5 toast+modal';
    try {
      await page.locator('button').filter({ hasText: /^Editar$/ }).first().click();
      await page.waitForSelector('[role=dialog]');
      // Toast real do app: dispara o ToastContext pelo fluxo de validação do formulário (sem salvar nada).
      // Sem alterar nada o modal fecha sem toast: altera objetivo e nível e deixa a altura vazia → toast de validação.
      const sels = page.locator('[role=dialog] select');
      await sels.nth(0).selectOption({ index: 1 });
      await sels.nth(1).selectOption({ index: 1 });
      await page.locator('[role=dialog] button').filter({ hasText: /^Salvar$/ }).first().click();
      await page.waitForSelector('.toast-stack > *', { timeout: 3000 });
      await page.waitForTimeout(400);
      const t = await page.evaluate(() => {
        const st = document.querySelector('.toast-stack');
        const card = st?.firstElementChild;
        if (!card) return null;
        const b = card.getBoundingClientRect();
        const h = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1));
        const tb = document.querySelector('.mobileTopBar')?.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, onTop: !!h && card.contains(h), tbBottom: tb?.bottom ?? 0, iw: innerWidth };
      });
      check(S, vp, 'toast aparece com o modal aberto', !!t, JSON.stringify(t));
      if (t) {
        check(S, vp, 'toast fica ACIMA do modal (hit-test)', t.onTop, JSON.stringify(t));
        check(S, vp, 'toast abaixo da top bar / safe-area', t.top >= t.tbBottom - 1 && t.top >= (vp.insets?.top ?? 0), `top=${t.top} tbBottom=${t.tbBottom}`);
        check(S, vp, 'toast dentro da viewport e das safe-areas laterais', t.left >= (vp.insets?.left ?? 0) - 1 && t.right <= t.iw - (vp.insets?.right ?? 0) + 1, `l=${t.left} r=${t.right} iw=${t.iw}`);
      }
    } catch (e) {
      check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]);
    }
    await ctx.close();
  }
}

async function scenarioSafeArea(browser) {
  const vp = VPS.find((v) => v.name === '844x390');
  for (const cookie of [true, false]) {
    const ctx = await mk(browser, { width: vp.w, height: vp.h, storageState: a.active });
    await ctx.addInitScript(([k, rm]) => { try { rm ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })); } catch {} }, [KEY, cookie]);
    const page = await ctx.newPage();
    await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
    await page.goto(`${BASE}/app/user/today`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.wmp', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(700);
    const S = `S6 safe-area paisagem${cookie ? ' +cookie' : ''}`;
    const L = vp.insets.left, R = vp.insets.right;
    const inner = await page.evaluate(() => {
      const f = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; });
      return { nav: f('.mobileBottomNav__item'), topbar: f('.mobileTopBar a, .mobileTopBar button'), mini: f('.wmp__body'), ckInner: f('.cookie-consent__inner'), iw: innerWidth };
    });
    const within = (arr) => arr.length > 0 && arr.every((x) => x.l >= L - 1 && x.r <= inner.iw - R + 1);
    check(S, vp, 'itens da bottom nav dentro das safe-areas laterais', within(inner.nav), JSON.stringify(inner.nav.slice(0, 2)));
    check(S, vp, 'controles da top bar dentro das safe-areas laterais', within(inner.topbar), JSON.stringify(inner.topbar));
    if (inner.mini.length) check(S, vp, 'mini-player dentro das safe-areas laterais', within(inner.mini), JSON.stringify(inner.mini));
    if (cookie) check(S, vp, 'banner de cookies dentro das safe-areas laterais', within(inner.ckInner), JSON.stringify(inner.ckInner));
    await ctx.close();
  }
}

const { mod } = await loadPlaywright();
const browser = await mod.chromium.launch({ executablePath: findChrome() });
try {
  await scenarioCookieNav(browser);
  await scenarioMini(browser, true);
  await scenarioMini(browser, false);
  await scenarioOffline(browser);
  await scenarioToastModal(browser);
  await scenarioSafeArea(browser);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} asserções OK`);
for (const f of failed) console.log(`FALHA [${f.scenario}] ${f.vp} — ${f.name} :: ${f.detail}`);
if (a.out) writeFileSync(a.out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);

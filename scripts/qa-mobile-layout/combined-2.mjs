#!/usr/bin/env node
/**
 * Onda 2 (Aluno) — execução do treino e áreas úteis, medidas no navegador (Chromium, simulação).
 *
 *   node scripts/qa-mobile-layout/combined-2.mjs --active <student-active.state.json> [--base URL] [--out r.json]
 *
 * Mede, não supõe: altura visível do exercício entre o cabeçalho e a barra fixa, alcance (hit-test) das
 * ações essenciais, recuo lateral da safe-area e área útil com banner + mini-player + nav juntos.
 * Somente leitura (toda escrita não-GET da API é interceptada). Câmera/GPS/toque real: pendentes de aparelho.
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
  { name: '932x430', w: 932, h: 430, insets: { top: 0, bottom: 21, left: 47, right: 47 } },
];
const results = [];
const check = (scenario, vp, name, ok, detail) => results.push({ scenario, vp: vp.name, name, ok: !!ok, detail });

async function mk(browser, vp, { consent }) {
  const ctx = await newMobileContext(browser, { width: vp.w, height: vp.h, storageState: a.active });
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

const free = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  e.scrollIntoView({ block: 'nearest' });
  const b = e.getBoundingClientRect();
  const h = document.elementFromPoint(Math.min(Math.max(b.left + b.width / 2, 1), innerWidth - 1), Math.min(Math.max(b.top + b.height / 2, 1), innerHeight - 1));
  return !!h && (e === h || e.contains(h) || h.contains(e));
}, sel);

async function enterSession(page) {
  await page.goto(`${BASE}/app/user/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.wmp__body', { timeout: 8000 });
  await page.locator('.wmp__body').click();
  await page.waitForSelector('.ws-root', { timeout: 8000 });
  await page.waitForTimeout(900);
}

const geom = (page) => page.evaluate(() => {
  const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; };
  const bar = r('.ws-action-bar') ?? r('.ws-rest');
  const head = r('.ws-top');
  return { head, bar, ih: innerHeight, visible: bar && head ? bar.top - head.bottom : null, subH: document.querySelector('.ws-sub')?.getBoundingClientRect().height ?? null };
});

async function scenarioSession(browser) {
  for (const vp of VPS) {
    const { ctx, page } = await mk(browser, vp, { consent: true });
    const S = 'S1 Modo Treino (execução)';
    try {
      await enterSession(page);
      const g = await geom(page);
      const land = vp.w > vp.h;
      // Meta: o exercício precisa ter pelo menos 45% da altura da tela entre cabeçalho e barra (paisagem) / 38% (retrato curto).
      const min = land ? 0.45 : vp.h <= 700 ? 0.38 : 0.5;
      check(S, vp, `altura útil do exercício ≥ ${Math.round(min * 100)}% da tela (barra de ação)`, g.visible >= min * g.ih, `visible=${Math.round(g.visible)} ih=${g.ih} head=${Math.round(g.head.h)} bar=${Math.round(g.bar.h)}`);
      if (vp.w <= 380) check(S, vp, 'metadado do cabeçalho em uma linha (<= 20px)', g.subH <= 20, `subH=${g.subH}`);
      check(S, vp, '"Concluir série" alcançável (hit-test)', await free(page, '.ws-ab-done'), '');
      check(S, vp, '"Sair" alcançável (hit-test)', await free(page, '.ws-top .ws-icon-btn:last-child'), '');
      if (vp.insets) {
        const L = vp.insets.left, R = vp.insets.right;
        const m = await page.evaluate(() => ({ iw: innerWidth, els: [...document.querySelectorAll('.ws-top button, .ws-action-bar button, .ws-action-bar input')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; }) }));
        check(S, vp, 'controles fora do recorte lateral', m.els.length > 0 && m.els.every((x) => x.l >= L - 1 && x.r <= m.iw - R + 1), `n=${m.els.length}`);
      }
      // descanso: concluir uma série (só estado local) e medir a barra de descanso
      await page.locator('.ws-ab-done').click();
      await page.waitForSelector('.ws-rest', { timeout: 4000 });
      await page.waitForTimeout(500);
      const gr = await geom(page);
      const minR = land ? 0.4 : vp.h <= 700 ? 0.3 : 0.45;
      check(S, vp, `altura útil com descanso + RPE ≥ ${Math.round(minR * 100)}% da tela`, gr.visible >= minR * gr.ih, `visible=${Math.round(gr.visible)} ih=${gr.ih} rest=${Math.round(gr.bar.h)}`);
      const rpe = await page.evaluate(() => [...document.querySelectorAll('.ws-rest-rpe-btn, .ws-rest-rpe-skip, .ws-rest-btn-skip')].map((e) => { const b = e.getBoundingClientRect(); const cx = b.left + b.width / 2, cy = b.top + b.height / 2; let mn = 1e9, mx = -1e9, my0 = 1e9, my1 = -1e9; for (let y = Math.floor(b.top - 20); y <= b.bottom + 20; y += 2) for (let x = Math.floor(b.left - 20); x <= b.right + 20; x += 2) { const h = document.elementFromPoint(x, y); if (h && (e === h || e.contains(h))) { mn = Math.min(mn, x); mx = Math.max(mx, x); my0 = Math.min(my0, y); my1 = Math.max(my1, y); } } return { t: (e.textContent || '').trim().slice(0, 8), w: mx - mn + 2, h: my1 - my0 + 2, cx, cy }; }));
      check(S, vp, 'RPE por série, Ignorar e Pular com área tocável ≥ 44px', rpe.length >= 6 && rpe.every((x) => x.w >= 43 && x.h >= 43), JSON.stringify(rpe.map((x) => `${x.t}:${Math.round(x.w)}x${Math.round(x.h)}`)));
      const wide = await page.evaluate(() => { const r = document.querySelector('.ws-rest'); return r.scrollWidth - r.clientWidth; });
      check(S, vp, 'barra de descanso sem overflow horizontal', wide <= 1, `scrollW-clientW=${wide}`);
    } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
    await ctx.close();
  }
}

async function scenarioShellStack(browser) {
  // banner de cookies + mini-player + nav simultâneos (1º acesso com treino em andamento)
  for (const vp of VPS.filter((v) => v.w > v.h)) {
    const { ctx, page } = await mk(browser, vp, { consent: false });
    const S = 'S2 cookie + mini-player + nav (paisagem)';
    try {
      await page.goto(`${BASE}/app/user/profile`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.wmp', { timeout: 8000 });
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); const b = e?.getBoundingClientRect(); return b ? { top: b.top, bottom: b.bottom, h: b.height } : null; };
        const btn = [...document.querySelectorAll('.cookie-consent__btn')].map((b) => Math.round(b.getBoundingClientRect().height));
        return { top: r('.mobileTopBar'), ck: r('.cookie-consent'), nav: r('.mobileBottomNav'), mp: r('.wmp'), ih: innerHeight, btn };
      });
      const usable = m.ck.top - m.top.bottom;
      check(S, vp, 'área de conteúdo visível ≥ 30% da tela com os três elementos', usable >= 0.3 * m.ih, `usable=${Math.round(usable)} ih=${m.ih} top=${Math.round(m.top.h)} ck=${Math.round(m.ck.h)} mp=${Math.round(m.mp.h)} nav=${Math.round(m.nav.h)}`);
      check(S, vp, 'botões de consentimento com altura ≥ 44px e ambos presentes', m.btn.length === 2 && m.btn.every((h) => h >= 44), JSON.stringify(m.btn));
      check(S, vp, 'banner uma faixa só (≤ 100px)', m.ck.h <= 100, `ck=${Math.round(m.ck.h)}`);
      const navHits = await page.evaluate(() => [...document.querySelectorAll('.mobileBottomNav a, .mobileBottomNav button')].map((e) => { const b = e.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!h && (e === h || e.contains(h)) && b.height >= 44; }));
      check(S, vp, 'itens da nav tocáveis com altura ≥ 44px', navHits.length === 5 && navHits.every(Boolean), JSON.stringify(navHits));
    } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
    await ctx.close();
  }
}

const { mod } = await loadPlaywright();
const browser = await mod.chromium.launch({ executablePath: findChrome() });
try {
  await scenarioSession(browser);
  await scenarioShellStack(browser);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} asserções OK`);
for (const f of failed) console.log(`FALHA [${f.scenario}] ${f.vp} — ${f.name} :: ${String(f.detail).slice(0, 260)}`);
if (a.out) writeFileSync(a.out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);

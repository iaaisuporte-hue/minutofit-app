#!/usr/bin/env node
/**
 * Onda 3 (encerramento) — cenários dirigidos com asserções dinâmicas (Chromium, simulação).
 *
 *   node scripts/qa-mobile-layout/combined-3.mjs --student <s.json> --personal <p.json> --nutri <n.json> [--base URL] [--out r.json]
 *
 * Somente leitura (toda escrita não-GET da API é interceptada). Teclado é SIMULADO (viewport reduzida);
 * iOS, GPS, câmera, toque real e o botão voltar do Android seguem pendentes de aparelho.
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
const only = a.only ? a.only.split(',') : null;
const results = [];
const check = (scenario, vp, name, ok, detail) => results.push({ scenario, vp: vp.name, name, ok: !!ok, detail });

async function mk(browser, vp, storage) {
  const ctx = await newMobileContext(browser, { width: vp.w, height: vp.h, storageState: storage });
  await ctx.route('**/api/**', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || /\/auth\/(login|refresh|switch-academy)/.test(req.url())) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await ctx.addInitScript((k) => { try { localStorage.setItem(k, JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false })); } catch {} }, KEY);
  const page = await ctx.newPage();
  page.setDefaultTimeout(7000);
  if (vp.insets) await (await ctx.newCDPSession(page)).send('Emulation.setSafeAreaInsetsOverride', { insets: vp.insets });
  return { ctx, page };
}
const freeAt = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const b = e.getBoundingClientRect();
  if (b.top < 0 || b.bottom > innerHeight) return false;
  const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
  return !!h && (e === h || e.contains(h) || h.contains(e));
}, sel);

const SCEN = {
  // ── A7: composer do chat do aluno ──────────────────────────────────────────
  async a7(browser) {
    for (const vp of VPS) {
      const { ctx, page } = await mk(browser, vp, a.student);
      const S = 'A7 chat do aluno';
      try {
        await page.goto(`${BASE}/app/user/messages`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        const conv = page.getByText('QA Demo Personal').first();
        if (await conv.count()) { await conv.click(); await page.waitForTimeout(1200); }
        await page.waitForSelector('textarea', { timeout: 6000 });
        const geo = () => page.evaluate(() => {
          const ta = document.querySelector('textarea');
          const send = [...document.querySelectorAll('button')].find((b) => /^\s*(Enviar|Enviando)/.test(b.textContent || ''));
          const card = ta.closest('.um-chat-card');
          const msgs = card?.children[1];
          const nav = document.querySelector('.mobileBottomNav')?.getBoundingClientRect();
          const tb = send.getBoundingClientRect();
          const tab = ta.getBoundingClientRect();
          return { ih: innerHeight, sendTop: tb.top, sendBottom: tb.bottom, taTop: tab.top, taBottom: tab.bottom, navTop: nav?.top ?? innerHeight, msgsScroll: msgs ? msgs.scrollHeight - msgs.clientHeight : null, doc: document.documentElement.scrollHeight - innerHeight };
        });
        const g = await geo();
        check(S, vp, 'campo e Enviar visíveis sem rolar a página e acima da nav', g.taTop >= 0 && g.sendBottom <= g.navTop + 1, JSON.stringify(g));
        check(S, vp, 'Enviar recebe o toque (hit-test, não coberto)', await page.evaluate(() => { const s = [...document.querySelectorAll('button')].find((b) => /^\s*Enviar/.test(b.textContent || '')); const b = s.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!h && (s === h || s.contains(h)); }), '');
        check(S, vp, 'a página não vira um documento longo (≤ 80px de rolagem)', g.doc <= 80, `doc-ih=${g.doc}`);
        check(S, vp, 'a lista de mensagens rola por dentro', g.msgsScroll === null || g.msgsScroll >= 0, `msgsScroll=${g.msgsScroll}`);
        // teclado simulado: viewport reduzida a 55%
        await page.setViewportSize({ width: vp.w, height: Math.round(vp.h * 0.55) });
        await page.waitForTimeout(400);
        const k = await geo();
        check(S, vp, 'com o teclado (viewport 55%) o campo continua visível', k.taTop >= 0 && k.taBottom <= k.ih + 1, JSON.stringify(k));
      } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
      await ctx.close();
    }
  },
};

const { mod } = await loadPlaywright();
const browser = await mod.chromium.launch({ executablePath: findChrome() });
try {
  for (const [id, fn] of Object.entries(SCEN)) if (!only || only.includes(id)) await fn(browser);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length}/${results.length} asserções OK`);
for (const f of failed) console.log(`FALHA [${f.scenario}] ${f.vp} — ${f.name} :: ${String(f.detail).slice(0, 280)}`);
if (a.out) writeFileSync(a.out, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
process.exit(failed.length ? 1 : 0);

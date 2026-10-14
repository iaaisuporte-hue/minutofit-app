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

const SID = a.studentId ?? '11';
async function openBuilder(page) {
  await page.goto(`${BASE}/app/personal/students/${SID}/workouts/builder`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const adds = page.locator('button').filter({ hasText: /^\+$/ }).filter({ visible: true });
  if ((await adds.count()) < 3) throw new Error('menos de 3 botões + no catálogo');
  for (let i = 0; i < 3; i++) { await adds.nth(i).click(); await page.waitForTimeout(300); }
  await page.waitForSelector('[data-reorder="down-0"]');
}
const names = (page) => page.evaluate(() => [...document.querySelectorAll('[data-reorder^="down-"]')].map((b) => b.getAttribute('aria-label')));
const effArea = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let y = Math.floor(b.top - 24); y <= b.bottom + 24; y += 2) for (let x = Math.floor(b.left - 24); x <= b.right + 24; x += 2) { const h = document.elementFromPoint(x, y); if (h && (e === h || e.contains(h))) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } } return [x1 - x0 + 2, y1 - y0 + 2]; }, sel);

const SCEN = {
  // ── P1 + builder em paisagem ───────────────────────────────────────────────
  async p1(browser) {
    for (const vp of VPS) {
      const { ctx, page } = await mk(browser, vp, a.personal);
      const S = 'P1 builder: reordenar sem arrastar';
      try {
        await openBuilder(page);
        const before = await names(page);
        const [w, h] = await effArea(page, '[data-reorder="down-0"]');
        check(S, vp, 'botão ↓ com área tocável ≥ 44px', w >= 43 && h >= 43, `${w}x${h}`);
        check(S, vp, 'primeiro item não sobe / último não desce (desabilitados)', await page.evaluate(() => document.querySelector('[data-reorder="up-0"]').disabled && document.querySelector('[data-reorder="down-2"]').disabled), '');
        await page.locator('[data-reorder="down-0"]').tap();
        await page.waitForTimeout(300);
        const after = await names(page);
        check(S, vp, 'toque em ↓ troca o primeiro com o segundo', before.length === 3 && after[0].replace(/^Mover | para baixo$/g, '') === before[1].replace(/^Mover | para baixo$/g, ''), JSON.stringify({ before: before.map((x) => x?.slice(6, 24)), after: after.map((x) => x?.slice(6, 24)) }));
        check(S, vp, 'foco acompanha o item movido (teclado/leitor)', await page.evaluate(() => document.activeElement?.getAttribute('data-reorder') === 'down-1'), await page.evaluate(() => String(document.activeElement?.getAttribute('data-reorder'))));
        // Séries do primeiro exercício: alcançável (não sob a nav) e com o teclado simulado
        const sets = page.locator('label').filter({ hasText: /s[ée]ries/i }).locator('input').first();
        await sets.scrollIntoViewIfNeeded();
        const reach = async () => page.evaluate(() => { const inp = [...document.querySelectorAll('label')].filter((l) => /s[ée]ries/i.test(l.textContent || '')).map((l) => l.querySelector('input')).find(Boolean); inp.scrollIntoView({ block: 'center' }); const b = inp.getBoundingClientRect(); const nav = document.querySelector('.mobileBottomNav')?.getBoundingClientRect(); const h = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { free: !!h && (inp === h || inp.contains(h) || h.closest('label') === inp.closest('label')), aboveNav: !nav || b.bottom <= nav.top + 1, top: Math.round(b.top), bottom: Math.round(b.bottom), ih: innerHeight }; });
        const r1 = await reach();
        check(S, vp, 'campo "Séries" alcançável e acima da nav', r1.free && r1.aboveNav, JSON.stringify(r1));
        await page.setViewportSize({ width: vp.w, height: Math.round(vp.h * 0.6) });
        await page.waitForTimeout(300);
        const r2 = await reach();
        check(S, vp, 'com teclado simulado (viewport 60%) "Séries" segue alcançável', r2.free && r2.top >= 0 && r2.bottom <= r2.ih, JSON.stringify(r2));
      } catch (e) { check(S, vp, 'cenário executável', false, String(e.message).split('\n')[0]); }
      await ctx.close();
    }
  },

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

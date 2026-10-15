#!/usr/bin/env node
/**
 * Regressão da tela Alimentação (aluno) — defeitos de layout medidos em aparelho/simulação (Android, jul–out/2026):
 *  R1 largura da página (grid implícito do wrapper do aluno cresce até o min-content → margens assimétricas / corte)
 *  R2 marcas do eixo Y do gráfico cortadas pelo overflow do <svg> (margem esquerda negativa)
 *  R3 contraste do tooltip do gráfico (claro e escuro) < 4,5:1
 *  R4 barra superior não sangra até a borda (inset do padding do .main)
 *  R5 vazio excessivo no fim da página (reserva de rodapé dobrada)
 *  R6 rótulo "Alimentação" da bottom nav truncado em 390
 * Estado REAL da tela: precisa de um aluno com plano e registros no dia (fixtures de QA, nunca produção).
 *
 *   BASE_URL=http://localhost:5180 TOKEN=<access token> REFRESH=<refresh> node scripts/qa-mobile-layout/alimentacao-regressao.mjs
 *
 * Sai com código 1 se alguma checagem falhar (falha no código antigo, passa no corrigido). Só fala com localhost.
 */
import { chromium } from 'playwright-core';
import os from 'node:os';

const BASE = process.env.BASE_URL || 'http://localhost:5180';
const TOKEN = process.env.TOKEN; const REFRESH = process.env.REFRESH || TOKEN;
const CHROME = process.env.CHROME_PATH || `${os.homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`;
if (!TOKEN) { console.error('defina TOKEN (access token de um aluno de QA)'); process.exit(2); }
if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE)) { console.error('apenas localhost'); process.exit(2); }

const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);

const results = [];
const check = (id, name, ok, detail) => { results.push({ id, name, ok, detail }); console.log(`${ok ? 'PASSOU ' : 'FALHOU '} ${id} ${name}${ok ? '' : '  → ' + detail}`); };

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
async function open(w, h, { scheme = 'light', scale = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'pt-BR', colorScheme: scheme });
  await ctx.route((u) => !['localhost', '127.0.0.1'].includes(new URL(u).hostname), (r) => r.abort());
  await ctx.addInitScript(({ a, r }) => {
    localStorage.setItem('corefit_cookie_consent_v1', JSON.stringify({ version: 1, decidedAt: new Date().toISOString(), essential: true, analytics: false }));
    localStorage.setItem('corefit_token', a); localStorage.setItem('token', a); localStorage.setItem('corefit_refresh_token', r);
  }, { a: TOKEN, r: REFRESH });
  const page = await ctx.newPage();
  await page.goto(BASE + '/app/user/plano-alimentar', { waitUntil: 'networkidle' }); await page.waitForTimeout(1200);
  if (scheme === 'dark') await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  if (scale !== 1) await page.evaluate((k) => { for (const e of document.querySelectorAll('body *')) e.style.fontSize = parseFloat(getComputedStyle(e).fontSize) * k + 'px'; }, scale);
  await page.waitForTimeout(300);
  return { ctx, page };
}

// R1 — largura/margens da página + sem conteúdo além do viewport (inclui fonte ×1,3, aproximação do textZoom da WebView)
for (const [w, h, s] of [[320, 568, 1], [360, 740, 1], [390, 844, 1], [320, 568, 1.3]]) {
  const { ctx, page } = await open(w, h, { scale: s });
  const m = await page.evaluate(() => {
    const p = document.querySelector('.pageBottomSafe').getBoundingClientRect(); const vw = innerWidth;
    const out = [...document.querySelectorAll('.main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 0.5 && getComputedStyle(e).position !== 'fixed'; }).length;
    return { left: Math.round(p.left), right: Math.round(vw - p.right), out };
  });
  check('R1', `largura da página ${w}x${h} fonte×${s}: margens simétricas e nada além do viewport`, Math.abs(m.left - m.right) <= 2 && m.out === 0, JSON.stringify(m));
  await ctx.close();
}

// R2 — marcas do eixo Y dentro do <svg>
for (const [w, h] of [[390, 844], [320, 568]]) {
  const { ctx, page } = await open(w, h);
  await page.locator('.recharts-wrapper').first().scrollIntoViewIfNeeded();
  const m = await page.evaluate(() => { const svg = document.querySelector('.recharts-surface').getBoundingClientRect(); const bad = [...document.querySelector('.recharts-surface').querySelectorAll('text')].filter((t) => t.getBoundingClientRect().left < svg.left - 0.5).map((t) => t.textContent); return { clipped: bad }; });
  check('R2', `eixo Y do gráfico sem rótulos cortados ${w}x${h}`, m.clipped.length === 0, JSON.stringify(m));
  await ctx.close();
}

// R3 — contraste do tooltip (rótulo e item) nos dois temas
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await open(390, 844, { scheme });
  const c = page.locator('.recharts-wrapper').first(); await c.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  const box = await c.boundingBox(); await page.touchscreen.tap(box.x + box.width * 0.75, box.y + box.height * 0.5); await page.waitForTimeout(500);
  const t = await page.evaluate(() => { const w = document.querySelector('.recharts-tooltip-wrapper'); if (!w) return null; const i = w.firstElementChild; const g = (e) => e && getComputedStyle(e).color; return { bg: getComputedStyle(i).backgroundColor, label: g(i.querySelector('.recharts-tooltip-label')), item: g(i.querySelector('.recharts-tooltip-item')) }; });
  if (!t) check('R3', `tooltip (${scheme}) abre`, false, 'tooltip não apareceu');
  else { const bg = rgb(t.bg); const rl = ratio(rgb(t.label), bg), ri = ratio(rgb(t.item), bg); check('R3', `contraste do tooltip ${scheme}: rótulo ${rl.toFixed(2)}:1 item ${ri.toFixed(2)}:1 (≥4,5)`, rl >= 4.5 && ri >= 4.5, JSON.stringify(t)); }
  await ctx.close();
}

// R4 — barra superior sangra até as bordas
for (const [w, h] of [[390, 844], [844, 390]]) {
  const { ctx, page } = await open(w, h);
  const m = await page.evaluate(() => { const r = document.querySelector('.mobileTopBar').getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(innerWidth - r.right) }; });
  check('R4', `barra superior full-bleed ${w}x${h}`, m.left === 0 && m.right === 0, JSON.stringify(m));
  await ctx.close();
}

// R5 — fim da página: vazio entre o último conteúdo e a bottom nav
for (const [w, h] of [[390, 844], [320, 568]]) {
  const { ctx, page } = await open(w, h);
  const m = await page.evaluate(async () => {
    for (let i = 0; i < 4; i++) { scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => setTimeout(r, 300)); }
    const nav = document.querySelector('.mobileBottomNav').getBoundingClientRect();
    const last = document.querySelector('.pageBottomSafe').lastElementChild.getBoundingClientRect().bottom;
    return { gap: Math.round(nav.top - last) };
  });
  check('R5', `vazio no fim da página ≤ 120px (${w}x${h})`, m.gap >= 0 && m.gap <= 120, JSON.stringify(m));
  await ctx.close();
}

// R6 — rótulo da aba Alimentação em 390
{
  const { ctx, page } = await open(390, 844);
  const m = await page.evaluate(() => { const l = [...document.querySelectorAll('.mobileBottomNav__label')].find((e) => /Aliment/.test(e.textContent)); return { sw: l.scrollWidth, cw: l.clientWidth }; });
  check('R6', 'rótulo "Alimentação" completo em 390', m.sw <= m.cw, JSON.stringify(m));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passaram`);
process.exit(failed.length ? 1 : 0);

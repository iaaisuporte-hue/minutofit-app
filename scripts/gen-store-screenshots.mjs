/**
 * Captura os screenshots da ficha da Play Store no app real.
 *
 * Roda contra o dev server (localhost:5173) + backend local isolado, com a conta
 * de demonstração semeada. Viewport 1080x1920 (proporção 9:16), dentro das
 * regras do Play: PNG, lado menor >= 320, lado maior <= 3840.
 */
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const CHROME = '/home/feverton/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const OUT = '/home/feverton/projeto_metacore/minuto-app/docs/store/screenshots/';
const APP = 'http://localhost:5173';
/**
 * Credencial da conta de demonstração usada para as capturas.
 *
 * Vem do ambiente, nunca do arquivo: este script é versionado num repositório
 * remoto, e senha em texto claro vira histórico permanente do git — apagar
 * depois não desfaz, só esconde.
 *
 *   SHOTS_EMAIL=... SHOTS_PASSWORD=... node scripts/gen-store-screenshots.mjs
 */
const CRED = {
  email: process.env.SHOTS_EMAIL ?? '',
  password: process.env.SHOTS_PASSWORD ?? '',
};

if (!CRED.email || !CRED.password) {
  console.error(
    'Defina SHOTS_EMAIL e SHOTS_PASSWORD com a conta de demonstração.\n' +
      '  SHOTS_EMAIL=demo@exemplo.com SHOTS_PASSWORD=... node scripts/gen-store-screenshots.mjs',
  );
  process.exit(1);
}

const SHOTS = [
  { file: '01-hoje.png', path: '/app/user/today', wait: 3500 },
  // `/plano` mostra "Plano de treino em construção" enquanto não há personal —
  // estado vazio não serve para a loja. O treino sugerido é a saída do motor
  // adaptativo, que é justamente o argumento do produto.
  { file: '02-treino.png', path: '/app/user/suggested-training', wait: 4000 },
  { file: '03-estado-metabolico.png', path: '/app/user/estado-metabolico', wait: 3000 },
  { file: '04-evolucao.png', path: '/app/user/evolucao', wait: 3000 },
  { file: '05-equipe.png', path: '/app/user/equipe', wait: 2500 },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME });
// 360x800 CSS px = layout MÓVEL de verdade (o app troca para bottom nav abaixo
// de 720px; a 1080 CSS px ele renderiza a sidebar de desktop). A densidade 3x
// entrega uma imagem de 1080x2400, dentro do limite de 3840 do Play.
const ctx = await browser.newContext({
  viewport: { width: 360, height: 800 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
});
const page = await ctx.newPage();

// Consentimento de cookies e dispensa do card de push já decididos: nas capturas
// eles só ocupariam espaço e o banner cobre o rodapé.
await ctx.addInitScript(() => {
  try {
    // Formato exato de CookieConsentRecord: sem `essential: true` o app rejeita
    // o registro e reexibe o banner a cada navegação.
    localStorage.setItem(
      'corefit_cookie_consent_v1',
      JSON.stringify({
        version: 1,
        decidedAt: new Date().toISOString(),
        essential: true,
        analytics: false,
      }),
    );
    localStorage.setItem('corefit:push:optin-dismissed', '1');
    localStorage.setItem('corefit:pwa:install-dismissed', '1');
  } catch {
    /* contexto sem storage — segue */
  }
});

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 160)));

// ── Login ──────────────────────────────────────────────────────────────────
await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', CRED.email);
await page.fill('input[type="password"]', CRED.password);
await page.click('button[type="submit"]');
await page.waitForURL(/\/app\//, { timeout: 25000 });
console.log('login OK →', page.url());

// Decide o banner de cookies clicando de verdade: o addInitScript sozinho não
// bastou (o componente decide antes de a chave ser lida).
const cookieBtn = page.getByRole('button', { name: 'Salvar preferências' });
if (await cookieBtn.count().then((n) => n > 0).catch(() => false)) {
  await cookieBtn.first().click().catch(() => {});
  await page.waitForTimeout(600);
}
const stillThere = await page.getByText('Cookies e privacidade').count().catch(() => 0);
console.log('banner de cookies visível após dispensar:', stillThere > 0 ? 'SIM (revisar)' : 'não');

// ── Capturas ───────────────────────────────────────────────────────────────
for (const shot of SHOTS) {
  await page.goto(`${APP}${shot.path}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(shot.wait);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + shot.file });
  const title = await page.title();
  console.log(`  ${shot.file}  ${shot.path}  (${title})`);
}

if (errors.length) {
  console.log('\nerros de console:', [...new Set(errors)].slice(0, 5).join(' | '));
}

await browser.close();
console.log('\nOK →', OUT);

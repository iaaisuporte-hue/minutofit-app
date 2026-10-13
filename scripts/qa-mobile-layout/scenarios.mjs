/**
 * Catálogo de cenários da Onda 0: o QUE medir (rotas × estados × perfis).
 *
 * Conhecimento específico do app mora aqui (rotas, seletores de chrome, fluxos
 * reais para abrir modais). `detectors.mjs` não sabe nada do S2Core.
 *
 * Regra: um passo que não acha o elemento LANÇA `Blocked` — o cenário vira
 * BLOQUEADO com a razão, nunca "passou". Ausência de achado só vale se o
 * cenário de fato executou.
 */

export class Blocked extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'Blocked';
  }
}

export const VIEWPORTS = [
  { name: '320x568', w: 320, h: 568, label: 'Mobile compacto', orientation: 'portrait' },
  { name: '360x740', w: 360, h: 740, label: 'Mobile pequeno', orientation: 'portrait' },
  { name: '375x667', w: 375, h: 667, label: 'Mobile padrão', orientation: 'portrait' },
  { name: '390x844', w: 390, h: 844, label: 'Mobile moderno', orientation: 'portrait' },
  { name: '412x915', w: 412, h: 915, label: 'Mobile grande', orientation: 'portrait' },
  { name: '430x932', w: 430, h: 932, label: 'Mobile grande XL', orientation: 'portrait' },
  { name: '844x390', w: 844, h: 390, label: 'Paisagem 1', orientation: 'landscape' },
  { name: '932x430', w: 932, h: 430, label: 'Paisagem 2', orientation: 'landscape' },
  { name: '768x1024', w: 768, h: 1024, label: 'Tablet retrato', orientation: 'portrait' },
];

/** Safe-areas típicas de iPhone com notch / ilha: retrato e paisagem. */
export function insetsFor(vp) {
  return vp.orientation === 'landscape' ? { top: 0, bottom: 21, left: 47, right: 47 } : { top: 47, bottom: 34, left: 0, right: 0 };
}

/** Seletores do "chrome" do app (barras, navegação, banners) — alimentam os detectores. */
export const CHROME = {
  topBar: '.mobileTopBar',
  bottomNav: '.mobileBottomNav',
  sidebar: '.sidebar',
  miniPlayer: '.wmp',
  main: '.main',
  cookie: '.cookie-consent',
  wsTop: '.ws-top',
  wsActionBar: '.ws-action-bar',
  wsRest: '.ws-rest',
  leaflet: '.leaflet-container',
};

/** Camadas de tela cheia que SÃO a página (não modais): o escopo da medição passa a ser a camada. */
export const PAGE_LAYERS = ['.ws-root'];

export const COOKIE_KEY = 'corefit_cookie_consent_v1';

// ───────────────────────── helpers de ação ─────────────────────────

/** Clica no primeiro elemento VISÍVEL com esse texto; bloqueia se não existir. */
export async function clickText(page, text, { within = 'body', role = null, exact = false, timeout = 6000 } = {}) {
  const base = page.locator(within);
  const esc = String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const loc = role
    ? base.getByRole(role, { name: text, exact })
    : base.locator('button, a, [role=button], [role=tab], summary').filter({ hasText: exact ? new RegExp(`^\\s*${esc}\\s*$`) : text });
  const target = loc.filter({ visible: true }).first();
  try {
    await target.waitFor({ state: 'visible', timeout });
    await target.click({ timeout });
  } catch (err) {
    throw new Blocked(`não encontrei/cliquei "${text}" em ${within}: ${String(err.message).split('\n')[0]}`);
  }
}

export async function clickSelector(page, selector, { timeout = 6000 } = {}) {
  const target = page.locator(selector).filter({ visible: true }).first();
  try {
    await target.waitFor({ state: 'visible', timeout });
    await target.click({ timeout });
  } catch (err) {
    throw new Blocked(`não encontrei/cliquei ${selector}: ${String(err.message).split('\n')[0]}`);
  }
}

export async function waitVisible(page, selector, timeout = 6000) {
  try {
    await page.locator(selector).filter({ visible: true }).first().waitFor({ state: 'visible', timeout });
  } catch {
    throw new Blocked(`${selector} não ficou visível em ${timeout}ms`);
  }
}

/** Toque real (CDP) arrastando de um ponto a outro. Usado para provar o que o dedo faz. */
export async function touchSwipe(page, from, to, { steps = 10, holdMs = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    if (holdMs) await page.waitForTimeout(holdMs);
    for (let i = 1; i <= steps; i++) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach().catch(() => {});
  }
}

/** Fecha o diálogo de "ver demonstração"/etc. via Escape sem depender do app. */
export async function pressEscape(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}

// ───────────────────────── passos específicos (medições de achados) ─────────────────────────

const ALL = 'all';
const PORTRAIT = ['320x568', '360x740', '375x667', '390x844', '412x915', '430x932'];

/** Passos que medem DADO vindo da API esperam o elemento (até 7s); sem ele, "não se aplica" com razão — nunca "passou". */
async function waitData(page, selector, what) {
  try {
    await page.locator(selector).filter({ visible: true }).first().waitFor({ state: 'visible', timeout: 7000 });
    await page.waitForTimeout(250);
    return null;
  } catch {
    return { applicable: false, reason: `${what} não apareceu em 7s (dado não carregou ou não existe)` };
  }
}

/** Tenta clicar; não bloqueia se o elemento não existir (consentimentos que só aparecem na 1ª vez). */
async function tryClickText(page, text, opts) {
  try {
    await clickText(page, text, { timeout: 2500, ...opts });
    return true;
  } catch {
    return false;
  }
}

/** A1 — o mapa Leaflet pinta por cima da nav / top bar / modais? Mede por hit-test com o mapa rolado até as barras. */
const stepMapUnderChrome = {
  run: (page) =>
    page.evaluate(() => {
      const map = document.querySelector('.leaflet-container');
      if (!map) return { applicable: false, reason: 'sem .leaflet-container' };
      const H = innerHeight;
      const hit = (el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < 0 || x > innerWidth || y < 0 || y > H) return { tested: false };
        const e = document.elementFromPoint(x, y);
        const ok = !!e && (e === el || el.contains(e));
        return { tested: true, ok, by: ok ? null : String(e?.className?.toString?.() || e?.tagName).slice(0, 70), byLeaflet: !!e?.closest?.('.leaflet-container') };
      };
      const r0 = map.getBoundingClientRect();
      const docTop = r0.top + scrollY;
      const out = { applicable: true, mapHeight: Math.round(r0.height), viewportHeight: H };
      const measure = (name, scrollTo, selector, overlaps) => {
        window.scrollTo(0, scrollTo);
        const mr = map.getBoundingClientRect();
        const items = [...document.querySelectorAll(selector)].filter((el) => el.checkVisibility?.());
        out[name] = { scrollY: Math.round(scrollY), mapRect: [Math.round(mr.top), Math.round(mr.bottom)], overlapsZone: overlaps(mr), items: items.map(hit) };
      };
      const nav = document.querySelector('.mobileBottomNav');
      if (nav && nav.checkVisibility?.()) {
        const navTop = nav.getBoundingClientRect().top;
        measure('bottomNav', docTop - (navTop - 120), '.mobileBottomNav a', (mr) => mr.top < navTop && mr.bottom > navTop);
      } else out.bottomNav = { overlapsZone: false, items: [], reason: 'sem bottom nav neste viewport' };
      const top = document.querySelector('.mobileTopBar');
      if (top && top.checkVisibility?.()) {
        const topBottom = top.getBoundingClientRect().bottom;
        measure('topBar', docTop + r0.height - (topBottom + 80), '.mobileTopBar a, .mobileTopBar button', (mr) => mr.bottom > topBottom - 1 && mr.top < topBottom);
      } else out.topBar = { overlapsZone: false, items: [], reason: 'sem top bar neste viewport' };
      window.scrollTo(0, 0);
      return out;
    }),
};

/** A9 — o dedo que começa no mapa rola a página? Toque real via CDP; controle começando fora do mapa. */
const stepMapSwipe = {
  run: async (page) => {
    const place = () =>
      page.evaluate(() => {
        const map = document.querySelector('.leaflet-container');
        if (!map) return null;
        const H = innerHeight;
        const r = map.getBoundingClientRect();
        const docTop = r.top + scrollY;
        window.scrollTo(0, Math.max(0, docTop + r.height / 2 - H / 2));
        const r2 = map.getBoundingClientRect();
        const se = document.scrollingElement;
        return { cx: Math.round(r2.left + r2.width / 2), cy: Math.round(r2.top + r2.height / 2), mapH: Math.round(r2.height), H, y0: Math.round(scrollY), room: Math.round(se.scrollHeight - H - scrollY), scrolls: se.scrollHeight > H + 1 };
      });
    const g = await place();
    if (!g) return { applicable: false, reason: 'sem mapa' };
    if (!g.scrolls) return { applicable: false, reason: 'a página não rola neste viewport', mapHeightFraction: g.mapH / g.H };
    const down = g.room > 120; // há conteúdo abaixo: dedo sobe
    const dy = down ? -150 : 150;
    await touchSwipe(page, { x: g.cx, y: g.cy - dy / 2 }, { x: g.cx, y: g.cy + dy / 2 });
    await page.waitForTimeout(250);
    const onMap = await page.evaluate(() => Math.round(scrollY));
    const g2 = await place();
    // controle: mesmo gesto começando na margem da página (fora do mapa)
    await touchSwipe(page, { x: 4, y: g2.cy - dy / 2 }, { x: 4, y: g2.cy + dy / 2 });
    await page.waitForTimeout(250);
    const offMap = await page.evaluate(() => Math.round(scrollY));
    return { applicable: true, mapHeightFraction: Math.round((g.mapH / g.H) * 100) / 100, startedOnMap: { before: g.y0, after: onMap, pageScrolled: Math.abs(onMap - g.y0) > 20 }, startedOffMap: { before: g2.y0, after: offMap, pageScrolled: Math.abs(offMap - g2.y0) > 20 }, direction: down ? 'content-down' : 'content-up' };
  },
};

/** P1 — reordenar exercício no builder: dedo (toque real) vs. mouse (controle) vs. botões alternativos. */
const stepBuilderReorder = {
  states: ['default'],
  viewports: ['390x844', '320x568', '844x390'],
  run: async (page, { vp }) => {
    const names = () => page.evaluate(() => [...document.querySelectorAll('[draggable]')].map((c) => (c.textContent || '').trim().slice(0, 26)));
    const before = await names();
    if (before.length < 2) return { applicable: false, reason: `só ${before.length} exercício(s) no builder` };
    const findGrip = () =>
      page.evaluate(() => {
        const card = document.querySelector('[draggable]');
        card.scrollIntoView({ block: 'center', behavior: 'instant' });
        for (const e of card.querySelectorAll('button')) {
          if (getComputedStyle(e).cursor === 'grab') {
            const r = e.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: Math.round(r.width), h: Math.round(r.height), cardH: card.getBoundingClientRect().height };
          }
        }
        return null;
      });
    const grip = await findGrip();
    if (!grip) return { applicable: false, reason: 'botão de arrastar (cursor:grab) não encontrado' };
    const endY = Math.min(grip.y + grip.cardH + 30, vp.h - 12);
    await touchSwipe(page, { x: grip.x, y: grip.y }, { x: grip.x, y: endY }, { steps: 16, holdMs: 400 });
    await page.waitForTimeout(350);
    const afterTouch = await names();
    const touchReordered = JSON.stringify(afterTouch) !== JSON.stringify(before);
    // controle com mouse (HTML5 drag)
    const g2 = await findGrip();
    let mouseReordered = null;
    let afterMouse = null;
    if (g2) {
      await page.mouse.move(g2.x, g2.y);
      await page.mouse.down();
      await page.waitForTimeout(150);
      const steps = 14;
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(g2.x, Math.min(g2.y + ((g2.cardH + 30) * i) / steps, vp.h - 12));
        await page.waitForTimeout(16);
      }
      await page.mouse.up();
      await page.waitForTimeout(350);
      afterMouse = await names();
      mouseReordered = JSON.stringify(afterMouse) !== JSON.stringify(afterTouch);
    }
    const altControls = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /mover|subir|descer|para cima|para baixo|↑|↓/i.test(`${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`)).length);
    return { applicable: true, gripSize: { w: grip.w, h: grip.h }, before, afterTouch, touchReordered, mouseReordered, afterMouse, alternativeControls: altControls };
  },
};

/** N1 — o menu do Nutri fecha ao navegar? "Sair da conta" pede confirmação? (o POST de logout é abortado) */
const stepNutriMenu = {
  states: ['default'],
  after: true, // desloga/navega: precisa rodar DEPOIS da medição e da captura (antes, a célula media a tela de login)
  viewports: ['390x844', '320x568', '375x667'],
  run: async (page) => {
    const details = page.locator('details.navDisclosure').first();
    if (!(await details.count())) return { applicable: false, reason: 'sem details.navDisclosure (layout desktop)' };
    await details.locator('summary').first().click();
    const openedByClick = await details.evaluate((d) => d.open);
    await clickText(page, 'Pacientes', { within: 'details.navDisclosure' });
    await page.waitForTimeout(800);
    const navigatedTo = new URL(page.url()).pathname;
    const stillOpen = await page.locator('details.navDisclosure').first().evaluate((d) => d.open).catch(() => null);
    let logoutRequested = false;
    await page.route('**/auth/logout', (route) => {
      logoutRequested = true;
      return route.abort();
    });
    if (!stillOpen) await page.locator('details.navDisclosure summary').first().click();
    await page.locator('details.navDisclosure button:has-text("Sair da conta")').first().click({ timeout: 4000 });
    await page.waitForTimeout(900);
    const dialogs = await page.locator('[role=dialog],[role=alertdialog]').filter({ visible: true }).count();
    const urlAfter = new URL(page.url()).pathname;
    const tokenRemoved = await page.evaluate(() => !localStorage.getItem('token') && !localStorage.getItem('corefit_token')).catch(() => null);
    const loggedOut = logoutRequested || /^\/login/.test(urlAfter) || tokenRemoved === true;
    return { applicable: true, openedByClick, navigatedTo, menuStillOpenAfterNavigate: stillOpen, logoutWithoutConfirmation: loggedOut && dialogs === 0, logoutRequested, urlAfterLogoutClick: urlAfter, tokenRemoved, dialogsAfterLogoutClick: dialogs };
  },
};

/** G4 — com o modal de perfil aberto, o toast de erro aparece por cima ou fica atrás do backdrop? */
const stepToastUnderModal = {
  states: ['overlay:essential-modal'],
  after: true, // roda depois da medição: não pode alterar o que foi medido
  run: async (page) => {
    // `nothingChanged` fecha o modal sem toast. Para provocar a validação (sem gravar nada) é preciso
    // ALTERAR objetivo e nível e deixar a altura vazia → toast.error("Informe uma altura válida.").
    const sels = page.locator('[role=dialog] select');
    await sels.nth(0).selectOption({ index: 1 });
    await sels.nth(1).selectOption({ index: 1 });
    await clickText(page, 'Salvar', { within: '[role=dialog]', exact: true });
    const msg = 'Informe uma altura válida.';
    try {
      await page.getByText(msg).first().waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      return { applicable: true, toastAppeared: false };
    }
    return page.evaluate((m) => {
      const el = [...document.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.includes(m)));
      let c = el;
      while (c && getComputedStyle(c).position !== 'fixed') c = c.parentElement;
      if (!c) return { applicable: true, toastAppeared: true, toastFixed: false };
      // O contêiner do toast tem pointer-events:none (elementFromPoint o ignoraria): liga só durante a sonda.
      const saved = c.style.pointerEvents;
      c.style.pointerEvents = 'auto';
      const card = el.closest('div[style*="border"]') || el;
      const r = card.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const onTop = !!hit && (card.contains(hit) || c.contains(hit));
      const backdrop = document.querySelector('[role=dialog]')?.parentElement;
      const out = {
        applicable: true,
        toastAppeared: true,
        toastZ: parseInt(getComputedStyle(c).zIndex, 10) || null,
        modalBackdropZ: backdrop ? parseInt(getComputedStyle(backdrop).zIndex, 10) || null : null,
        toastRect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        toastOnTop: onTop,
        coveredBy: !onTop && hit ? String(hit.className?.toString?.() || hit.tagName).slice(0, 60) : null,
      };
      c.style.pointerEvents = saved;
      return out;
    }, msg);
  },
};

/** A3 — o resumo/descanso do Lab só nasce depois de uma análise real (câmera + MediaPipe no CDN). */
const stepLabBlocked = {
  states: ['default'],
  run: async () => ({ applicable: false, blocked: true, reason: 'câmera e MediaPipe (CDN) indisponíveis no ambiente isolado; os modais de resumo/descanso só abrem após uma análise real' }),
};

/** A7/P2 — o compositor de mensagem (campo + Enviar) está à vista sem rolar a página? */
const stepComposer = {
  states: ['default', 'keyboard'],
  run: (page) =>
    page.evaluate(() => {
      const send = [...document.querySelectorAll('button')].find((b) => /^enviar$/i.test((b.textContent || '').trim()) && b.checkVisibility?.());
      const field = [...document.querySelectorAll('textarea, input[type=text]')].find((e) => e.checkVisibility?.());
      const el = send || field;
      if (!el) return { applicable: false, reason: 'compositor não encontrado' };
      window.scrollTo(0, 0);
      const r = el.getBoundingClientRect();
      const H = innerHeight;
      const se = document.scrollingElement;
      return { applicable: true, element: send ? 'Enviar' : 'campo', top: Math.round(r.top), bottom: Math.round(r.bottom), viewportHeight: H, fullyVisible: r.top >= 0 && r.bottom <= H, belowFold: r.top >= H, docScrolls: se.scrollHeight > H + 1, docHeight: se.scrollHeight };
    }),
};

/** P3 — na revisão, as ações ficam à vista sem rolar? Há "fechar" no cabeçalho? */
const stepReviewFooter = {
  states: ['overlay:review-modal'],
  run: (page) =>
    page.evaluate(() => {
      const visible = (b) => b.checkVisibility?.();
      const approve = [...document.querySelectorAll('button')].find((b) => /^aprovar$/i.test((b.textContent || '').trim()) && visible(b));
      if (!approve) return { applicable: false, reason: 'sem botão Aprovar' };
      const r = approve.getBoundingClientRect();
      const H = innerHeight;
      const closers = [...document.querySelectorAll('button')].filter((b) => visible(b) && (/^(×|✕)$/.test((b.textContent || '').trim()) || /fechar/i.test(b.getAttribute('aria-label') || '')));
      const footerClose = [...document.querySelectorAll('button')].some((b) => /^fechar$/i.test((b.textContent || '').trim()) && visible(b));
      return { applicable: true, approveTop: Math.round(r.top), approveBottom: Math.round(r.bottom), viewportHeight: H, actionsVisibleWithoutScroll: r.bottom <= H && r.top >= 0, headerCloseButton: closers.some((b) => b.getBoundingClientRect().top < 140), footerCloseButton: footerClose };
    }),
};

/** P8 — as 4 ações de cada aluno quebram em quantas linhas? */
const stepRowActions = {
  states: ['default'],
  run: async (page) => {
    const missing = await waitData(page, 'button:has-text("Retirar")', 'ações do aluno');
    if (missing) return missing;
    return page.evaluate(() => {
      const labels = ['Ver aluno', 'Ver ficha(s)', 'Criar treino', 'Retirar'];
      const els = labels.map((t) => [...document.querySelectorAll('button,a')].find((e) => (e.textContent || '').trim() === t && e.checkVisibility?.())).filter(Boolean);
      if (els.length < 2) return { applicable: false, reason: 'ações do aluno não encontradas' };
      const rects = els.map((e) => {
        const r = e.getBoundingClientRect();
        return [(e.textContent || '').trim(), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
      });
      return { applicable: true, actions: els.length, distinctRows: new Set(rects.map((r) => r[2])).size, rects };
    });
  },
};

/** A8 — o pill "Registrado retroativamente" estoura a coluna / é cortado? */
const stepHistoryPill = {
  states: ['default'],
  run: (page) =>
    page.evaluate(() => {
      const pill = [...document.querySelectorAll('span')].find((e) => /Registrado retroativamente/.test(e.textContent || '') && e.checkVisibility?.());
      if (!pill) return { applicable: false, reason: 'pill "Registrado retroativamente" não está na tela' };
      pill.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = pill.getBoundingClientRect();
      let clipped = null;
      for (let a = pill.parentElement; a && a !== document.body; a = a.parentElement) {
        if (/hidden|clip/.test(getComputedStyle(a).overflowX)) {
          const b = a.getBoundingClientRect();
          if (r.right > b.right + 1 || r.left < b.left - 1) {
            clipped = { by: String(a.className || a.tagName).slice(0, 50), hiddenPx: Math.round(Math.max(r.right - b.right, b.left - r.left)) };
            break;
          }
        }
      }
      return { applicable: true, pillRect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], clipped, beyondViewport: r.right > innerWidth + 1, viewportWidth: innerWidth };
    }),
};

/** P7 — o resumo da timeline é cortado em uma linha? */
const stepTimeline = {
  states: ['default'],
  run: async (page) => {
    const missing = await waitData(page, '.pp-timeline-summary', 'resumo da timeline');
    if (missing) return missing;
    return page.evaluate(() => {
      const els = [...document.querySelectorAll('.pp-timeline-summary')].filter((e) => e.checkVisibility?.());
      if (!els.length) return { applicable: false, reason: 'sem .pp-timeline-summary na tela' };
      return { applicable: true, items: els.length, maxTextLen: Math.max(...els.map((e) => (e.textContent || '').length)), widestPx: Math.round(Math.max(...els.map((e) => e.getBoundingClientRect().width))), viewportWidth: innerWidth, truncated: els.filter((e) => e.scrollWidth > e.clientWidth + 1).length, sample: els.slice(0, 2).map((e) => ({ text: (e.textContent || '').slice(0, 40), clientWidth: e.clientWidth, scrollWidth: e.scrollWidth })) };
    });
  },
};

/** P8 — o e-mail longo do convite pendente é cortado? */
const stepInviteEmail = {
  states: ['default'],
  run: async (page) => {
    const missing = await waitData(page, 'text=dominio-corporativo', 'convite com e-mail longo');
    if (missing) return missing;
    return page.evaluate(() => {
      const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /dominio-corporativo/.test(e.textContent || '') && e.checkVisibility?.());
      if (!el) return { applicable: false, reason: 'convite com e-mail longo não está na tela' };
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      let clipped = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) {
        if (/hidden|clip/.test(getComputedStyle(a).overflowX)) {
          const b = a.getBoundingClientRect();
          if (r.right > b.right + 1 || r.left < b.left - 1) {
            clipped = { by: String(a.className || a.tagName).slice(0, 40), hiddenPx: Math.round(Math.max(r.right - b.right, b.left - r.left)) };
            break;
          }
        }
      }
      return { applicable: true, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], clipped, beyondViewport: r.right > innerWidth + 1, truncatedByEllipsis: el.scrollWidth > el.clientWidth + 1 };
    });
  },
};

// Overlays do modo treino reutilizados no treino prescrito e no livre.
const OV_EXIT = {
  dismiss: true,
  open: async (page) => {
    await clickSelector(page, 'button[aria-label="Sair"]');
    await page.getByText('Sair (salvar progresso)').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      throw new Blocked('diálogo "Sair do treino" não abriu');
    });
  },
};
const OV_SUMMARY = {
  scope: '.ws-root',
  open: async (page) => {
    await clickText(page, 'Finalizar treino');
    await page.getByText('Concluir e salvar').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      throw new Blocked('resumo do treino não abriu');
    });
  },
};

// ───────────────────────── cenários ─────────────────────────
//
// states: 'default' | 'cookie' | 'workout-active' | 'offline' | 'safe-area' | 'keyboard'
//         + 'overlay:<nome>' (declarado em `overlays`).
// prep: preparação comum (aceitar consentimento, abrir aba...). Roda após o carregamento, em todo estado.
// overlays: { nome: { open(page), scope? } } — o runner mede com expectOverlay.

const GEO = { permissions: ['geolocation'], geolocation: { latitude: -23.5505, longitude: -46.6333 } };

export const SCENARIOS = [
  // ── Público (sem login) ─────────────────────────────────────────
  { id: 'auth.login', role: 'public', route: '/login', states: ['default', 'cookie', 'safe-area', 'keyboard'], viewports: ALL, keyboardField: '#email', wait: '#email' },
  { id: 'auth.register', role: 'public', route: '/register', states: ['default', 'cookie', 'keyboard'], viewports: ALL },
  { id: 'auth.register-personal', role: 'public', route: '/cadastro-personal', states: ['default'], viewports: ALL },
  { id: 'public.privacy', role: 'public', route: '/privacidade', states: ['default', 'cookie'], viewports: ['320x568', '390x844', '844x390'] },

  // ── Aluno ───────────────────────────────────────────────────────
  { id: 'student.today', role: 'student', route: '/app/user/today', states: ['default', 'cookie', 'workout-active', 'offline', 'safe-area'], viewports: ALL, wait: '.main' },
  { id: 'student.ficha', role: 'student', route: '/app/user/ficha', states: ['default', 'workout-active'], viewports: ALL, wait: '.main' },
  { id: 'student.plano', role: 'student', route: '/app/user/plano', states: ['default', 'workout-active'], viewports: ALL, wait: '.main' },
  { id: 'student.alimentacao', role: 'student', route: '/app/user/plano-alimentar', states: ['default', 'workout-active'], viewports: ALL, wait: '.main' },
  {
    id: 'student.tracker',
    role: 'student',
    route: '/app/user/activities',
    states: ['default', 'workout-active'],
    viewports: ALL,
    wait: '.main',
    // o consentimento de localização cobre a tela de propósito; "Agora não" mede a página por trás dele
    prep: async (page) => {
      await tryClickText(page, 'Agora não');
      await page.waitForTimeout(400);
    },
  },
  {
    id: 'student.tracker-live',
    role: 'student',
    route: '/app/user/activities',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    ctxOptions: GEO,
    prep: async (page) => {
      await tryClickText(page, 'Permitir localização');
      await clickText(page, 'Iniciar sessão');
      await waitVisible(page, '.leaflet-container', 8000);
      await page.waitForTimeout(500);
    },
    steps: { mapUnderChrome: stepMapUnderChrome, mapSwipe: stepMapSwipe },
  },
  {
    id: 'student.profile',
    role: 'student',
    route: '/app/user/profile',
    states: ['default', 'cookie', 'workout-active', 'safe-area'],
    viewports: ALL,
    wait: '.main',
    overlays: {
      'essential-modal': {
        dismiss: true,
        open: async (page) => {
          await clickText(page, 'Editar', { exact: true });
          await waitVisible(page, '[role=dialog]');
        },
      },
    },
    dismissViewports: ['390x844'],
    steps: { toastUnderModal: stepToastUnderModal },
  },
  {
    id: 'student.messages',
    role: 'student',
    route: '/app/user/messages',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
  },
  {
    id: 'student.messages-thread',
    role: 'student',
    route: '/app/user/messages',
    states: ['default', 'keyboard'],
    viewports: ALL,
    wait: '.main',
    prep: async (page) => {
      await clickText(page, 'QA Demo Personal');
      await waitVisible(page, 'textarea, input[type=text]', 6000);
    },
    steps: { composer: stepComposer },
  },
  { id: 'student.evolucao', role: 'student', route: '/app/user/evolucao', states: ['default', 'workout-active'], viewports: ALL, wait: '.main' },
  {
    id: 'student.evolucao-history',
    role: 'student',
    route: '/app/user/evolucao',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    prep: async (page) => {
      await clickText(page, 'Histórico', { exact: true });
      await page.waitForTimeout(700);
      // o histórico mostra poucas sessões por vez; o retroativo (de ontem) fica atrás de "Ver mais treinos"
      for (let i = 0; i < 15; i++) {
        if (await page.getByText('Registrado retroativamente').first().isVisible().catch(() => false)) break;
        const more = page.getByRole('button', { name: /Ver mais treinos/ });
        if (!(await more.count())) break;
        await more.first().click();
        await page.waitForTimeout(450);
      }
    },
    steps: { historyPill: stepHistoryPill },
  },
  { id: 'student.equipe', role: 'student', route: '/app/user/equipe', states: ['default'], viewports: ALL, wait: '.main' },
  { id: 'student.suggested', role: 'student', route: '/app/user/suggested-training', states: ['default'], viewports: ALL, wait: '.main' },
  {
    id: 'student.free-setup',
    role: 'student',
    route: '/app/user/treino-livre',
    states: ['default'],
    viewports: ALL,
    overlays: {
      'exercise-picker': {
        open: async (page) => {
          await clickText(page, 'Adicionar exercício');
          await waitVisible(page, '[role=dialog]');
        },
      },
    },
  },
  {
    id: 'student.free-session',
    role: 'student',
    route: '/app/user/treino-livre',
    states: ['default'],
    viewports: ALL,
    prep: async (page) => {
      await clickText(page, 'Adicionar exercício');
      await waitVisible(page, '[role=dialog]');
      await page.locator('[role=dialog] button').filter({ hasText: '＋' }).filter({ visible: true }).first().click({ timeout: 5000 }).catch(() => {
        throw new Blocked('não consegui adicionar um exercício no seletor do treino livre');
      });
      await page.waitForTimeout(300);
      await clickSelector(page, 'button[aria-label="Fechar seleção"]');
      await clickText(page, 'Começar treino');
      await waitVisible(page, '.ws-root', 8000);
    },
    overlays: { 'exit-dialog': OV_EXIT, summary: OV_SUMMARY },
    dismissViewports: [],
  },
  { id: 'student.retro', role: 'student', route: '/app/user/registrar-treino-anterior', states: ['default'], viewports: ALL },
  {
    id: 'student.lab',
    role: 'student',
    route: '/app/user/movement-lab',
    states: ['default'],
    viewports: ALL,
    prep: async (page) => {
      await tryClickText(page, 'Continuar');
      await page.waitForTimeout(600);
    },
    steps: { labSummary: stepLabBlocked },
  },
  { id: 'student.home-workouts', role: 'student', route: '/app/user/treinos/em-casa', states: ['default'], viewports: ALL },
  { id: 'student.player', role: 'student', route: '/app/user/treinos/player/short-queima-gordura', states: ['default'], viewports: ALL },
  {
    id: 'student.player-end',
    role: 'student',
    route: '/app/user/treinos/player/short-queima-gordura',
    states: ['default'],
    viewports: ALL,
    prep: async (page) => {
      await clickSelector(page, 'button[aria-label^="Avancar"], button[aria-label^="Avançar"]');
      await page.getByText('Leitura atualizada').first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {
        throw new Blocked('overlay "Leitura atualizada" não apareceu após Avançar');
      });
      await page.waitForTimeout(400);
    },
  },
  {
    id: 'student.session',
    role: 'student',
    route: '/app/user/treino/{planId}/1',
    states: ['default', 'safe-area', 'keyboard'],
    viewports: ALL,
    wait: '.ws-root',
    keyboardField: 'input[aria-label^="Carga série"]',
    overlays: {
      'exit-dialog': OV_EXIT,
      'demo-modal': {
        dismiss: true,
        open: async (page) => {
          await clickSelector(page, 'button[aria-label^="Ver demonstração"]');
          await page.waitForTimeout(500);
        },
      },
      'exercises-sheet': {
        dismiss: true,
        open: async (page) => {
          await clickText(page, 'Exercícios', { within: '.ws-top' });
          await page.waitForTimeout(500);
        },
      },
      'substitute-sheet': {
        dismiss: true,
        open: async (page) => {
          await clickText(page, 'Substituir exercício');
          await page.waitForTimeout(500);
        },
      },
      'rest-bar': {
        scope: '.ws-rest',
        open: async (page) => {
          await clickText(page, 'Concluir série', { within: '.ws-action-bar' });
          await waitVisible(page, '.ws-rest');
        },
      },
      summary: OV_SUMMARY,
    },
    dismissViewports: ['390x844'],
  },

  // ── Personal ────────────────────────────────────────────────────
  { id: 'personal.dashboard', role: 'personal', route: '/app/personal/dashboard', states: ['default', 'cookie'], viewports: ALL, wait: '.main' },
  {
    id: 'personal.students',
    role: 'personal',
    route: '/app/personal/students',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    overlays: {
      'invite-drawer': { dismiss: true, open: async (page) => { await clickText(page, 'Convidar por link'); await page.waitForTimeout(600); } },
      'register-drawer': { dismiss: true, open: async (page) => { await clickText(page, 'Cadastrar aluno'); await page.waitForTimeout(600); } },
    },
    dismissViewports: ['390x844'],
    steps: { rowActions: stepRowActions },
  },
  {
    id: 'personal.students-invites',
    role: 'personal',
    route: '/app/personal/students',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    prep: async (page) => {
      await clickText(page, 'Convites diretos enviados');
      await page.waitForTimeout(500);
    },
    steps: { inviteEmail: stepInviteEmail },
  },
  {
    id: 'personal.review',
    role: 'personal',
    route: '/app/personal/review',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    overlays: { 'review-modal': { dismiss: true, open: async (page) => { await clickText(page, 'Revisar'); await page.getByText('Salvar observações').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => { throw new Blocked('modal de revisão não abriu'); }); } } },
    dismissViewports: ['390x844'],
    steps: { reviewFooter: stepReviewFooter },
  },
  { id: 'personal.finance', role: 'personal', route: '/app/personal/finance', states: ['default'], viewports: ALL, wait: '.main' },
  { id: 'personal.library', role: 'personal', route: '/app/personal/library', states: ['default'], viewports: ALL, wait: '.main' },
  {
    id: 'personal.exercises',
    role: 'personal',
    route: '/app/personal/library?tab=exercicios',
    states: ['default'],
    viewports: ALL,
    wait: '.main',
    overlays: {
      'create-exercise': {
        open: async (page) => {
          await clickText(page, 'Criar exercício');
          await page.waitForTimeout(700);
        },
      },
    },
  },
  { id: 'personal.messages', role: 'personal', route: '/app/personal/messages', states: ['default', 'keyboard'], viewports: ALL, wait: '.main', steps: { composer: stepComposer } },
  { id: 'personal.profile', role: 'personal', route: '/app/personal/meu-perfil', states: ['default'], viewports: ALL, wait: '.main' },
  { id: 'personal.cockpit', role: 'personal', route: '/app/personal/students/{studentId}', states: ['default'], viewports: ALL, wait: '.main' },
  { id: 'personal.cockpit-relationship', role: 'personal', route: '/app/personal/students/{studentId}?ctab=relationship', states: ['default'], viewports: ALL, wait: '.main', steps: { timeline: stepTimeline } },
  { id: 'personal.cockpit-technical', role: 'personal', route: '/app/personal/students/{studentId}?ctab=technical', states: ['default'], viewports: ALL, wait: '.main' },
  {
    id: 'personal.builder',
    role: 'personal',
    route: '/app/personal/students/{studentId}/workouts/builder',
    states: ['default', 'keyboard'],
    viewports: ALL,
    wait: '.main',
    prep: async (page) => {
      const adds = page.locator('button').filter({ hasText: /^\+$/ }).filter({ visible: true });
      if ((await adds.count()) < 3) throw new Blocked('menos de 3 botões "+" no catálogo do builder');
      for (let i = 0; i < 3; i++) {
        await adds.nth(i).click();
        await page.waitForTimeout(350);
      }
    },
    steps: { reorder: stepBuilderReorder },
  },

  // ── Nutricionista ───────────────────────────────────────────────
  { id: 'nutri.home', role: 'nutri', route: '/app/nutri', states: ['default', 'cookie'], viewports: ALL, steps: { menu: stepNutriMenu } },
  { id: 'nutri.patients', role: 'nutri', route: '/app/nutri/pacientes', states: ['default'], viewports: ALL },
  { id: 'nutri.patient', role: 'nutri', route: '/app/nutri/pacientes/{patientId}', states: ['default'], viewports: ALL },
  { id: 'nutri.invites', role: 'nutri', route: '/app/nutri/convites', states: ['default'], viewports: ALL },
  { id: 'nutri.profile', role: 'nutri', route: '/app/nutri/meu-perfil', states: ['default'], viewports: ALL },
  { id: 'nutri.new-plan', role: 'nutri', route: '/app/nutri/pacientes/{patientId}/plano/novo', states: ['default', 'keyboard'], viewports: ALL },
];

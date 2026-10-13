/**
 * Detectores de layout mobile (Onda 0) — rodam DENTRO da página.
 *
 * `collectLayoutReport` é passada para `page.evaluate`, que a serializa com
 * `toString()`: por isso ela é autocontida (nenhum helper externo, nenhum
 * import). Mexeu aqui? Rode `node scripts/qa-mobile-layout/selftest.mjs` — ele
 * prova que cada detector acusa o defeito sintético E fica quieto nos casos
 * legítimos (carrossel, gaveta fechada, elemento oculto).
 *
 * O que muda em relação à métrica antiga ("document.scrollWidth <= innerWidth"):
 * o app tem `body{overflow-x:hidden}` e `.appShell{overflow-x:clip}`, então o
 * conteúdo que estoura é CORTADO, não gera barra de rolagem — e aquela métrica
 * não vê nada. Aqui a medição é por elemento (`getBoundingClientRect`) contra a
 * viewport e contra cada ancestral que corta.
 *
 * Severidade: P1 = ação inalcançável/coberta/cortada; P2 = conteúdo cortado,
 * rolagem aninhada, alvo primário pequeno; P3 = cosmético ou só-iOS.
 */
export function collectLayoutReport(opts = {}) {
  const O = Object.assign(
    { chrome: {}, scopeSelector: null, expectOverlay: false, insets: null, maxPerType: 80, checks: null },
    opts,
  );
  const want = (name) => !O.checks || O.checks.includes(name);
  const W = window.innerWidth;
  const H = window.innerHeight;
  const root = document.documentElement;
  const findings = [];
  const counts = {};
  const notes = [];

  const add = (f) => {
    counts[f.type] = (counts[f.type] || 0) + 1;
    // sy = rolagem no instante da medição: as capturas de evidência voltam a ela para alinhar as caixas
    if (counts[f.type] <= O.maxPerType) findings.push({ ...f, sy: Math.round(window.scrollY) });
  };

  // ───────────────────────── helpers ─────────────────────────
  const csCache = new WeakMap();
  const cs = (el) => {
    let s = csCache.get(el);
    if (!s) {
      s = getComputedStyle(el);
      csCache.set(el, s);
    }
    return s;
  };
  const rnd = (n) => Math.round(n * 10) / 10;
  const R = (el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
  };
  const rr = (r) => ({ l: rnd(r.l), t: rnd(r.t), r: rnd(r.r), b: rnd(r.b), w: rnd(r.w), h: rnd(r.h) });
  const text = (el) =>
    String(el.getAttribute?.('aria-label') || el.textContent || el.value || el.placeholder || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 48);

  const sel = (el) => {
    if (!el || el.nodeType !== 1) return String(el);
    if (el === document.body) return 'body';
    if (el === document.documentElement) return 'html';
    const part = (e) => {
      let s = e.tagName.toLowerCase();
      if (e.id && !/\d{4,}/.test(e.id)) return `${s}#${CSS.escape(e.id)}`;
      const cls = [...e.classList].filter((c) => !/\d{4,}/.test(c) && !/^(css-|_)/.test(c)).slice(0, 2);
      if (cls.length) s += `.${cls.map((c) => CSS.escape(c)).join('.')}`;
      return s;
    };
    const parts = [];
    let e = el;
    let n = 0;
    while (e && e.nodeType === 1 && e !== document.body && n < 3) {
      parts.unshift(part(e));
      if (e.id && !/\d{4,}/.test(e.id)) break;
      e = e.parentElement;
      n++;
    }
    return parts.join(' > ');
  };

  const opacityOf = (el) => {
    let o = 1;
    let e = el;
    let n = 0;
    while (e && e.nodeType === 1 && n < 14) {
      o *= parseFloat(cs(e).opacity);
      e = e.parentElement;
      n++;
    }
    return o;
  };
  const rendered = (el) => {
    if (!el.isConnected) return false;
    // checkVisibility cobre content-visibility:hidden (ex.: conteúdo de <details> fechado), que ainda devolve retângulos
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true })) return false;
    const s = cs(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
    if (el.getClientRects().length === 0) return false;
    const r = R(el);
    if (r.w <= 1 || r.h <= 1) return false; // sr-only / ponto
    if (opacityOf(el) < 0.02) return false;
    return true;
  };
  const ariaHidden = (el) => !!el.closest('[aria-hidden="true"],[inert]');

  const INTERACTIVE =
    'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=menuitem],[role=switch],[role=checkbox],[role=radio],[role=option],[tabindex]:not([tabindex="-1"])';

  const anchoredAncestor = (el) => {
    for (let a = el; a && a !== root; a = a.parentElement) {
      const p = cs(a).position;
      if (p === 'fixed' || p === 'sticky') return a;
    }
    return null;
  };

  const clientBox = (a) => {
    const r = R(a);
    return { l: r.l + a.clientLeft, t: r.t + a.clientTop, r: r.l + a.clientLeft + a.clientWidth, b: r.t + a.clientTop + a.clientHeight };
  };

  // ───────────────────────── escopo ─────────────────────────
  const allEls = [...document.body.querySelectorAll('*')].filter(
    (e) => !/^(script|style|link|meta|noscript|template|head|title)$/i.test(e.tagName) && !e.closest('svg') || e.tagName.toLowerCase() === 'svg',
  );

  // rolagem inicial de cada elemento (para restaurar no fim)
  const initialScroll = new Map();
  for (const el of allEls) if (el.scrollLeft || el.scrollTop) initialScroll.set(el, { l: el.scrollLeft, t: el.scrollTop });

  // Camada de PÁGINA em tela cheia (modo treino): é a própria tela, não um modal. Vira o escopo.
  const pageLayerEls = [];
  for (const q of O.pageLayers || []) {
    for (const el of document.querySelectorAll(q)) {
      if (el.isConnected && el.getClientRects().length) pageLayerEls.push(el);
    }
  }
  // Camadas "tela cheia": backdrops de modal/gaveta.
  const overlayRoots = [];
  for (const el of allEls) {
    if (pageLayerEls.includes(el)) continue;
    const s = cs(el);
    const isDialog = el.matches('[role=dialog],[role=alertdialog],[aria-modal="true"]');
    if (s.position !== 'fixed' && !isDialog) continue;
    if (!rendered(el)) continue;
    const r = R(el);
    const cover = (Math.max(0, Math.min(r.r, W) - Math.max(r.l, 0)) * Math.max(0, Math.min(r.b, H) - Math.max(r.t, 0))) / (W * H);
    const z = parseInt(s.zIndex, 10);
    if (isDialog || (cover >= 0.8 && (Number.isNaN(z) ? 0 : z) >= 50)) {
      // um dialog dentro de um backdrop já listado não é outra camada
      if (overlayRoots.some((o) => o.el.contains(el))) continue;
      overlayRoots.push({ el, z: Number.isNaN(z) ? 0 : z, cover });
    }
  }
  overlayRoots.sort((a, b) => b.z - a.z);

  let scopeRoots = null;
  if (O.scopeSelector) scopeRoots = [...document.querySelectorAll(O.scopeSelector)];
  else if (O.expectOverlay && overlayRoots.length) scopeRoots = [overlayRoots[0].el];
  else if (pageLayerEls.length) scopeRoots = [pageLayerEls[pageLayerEls.length - 1]];
  const inScope = (el) => !scopeRoots || scopeRoots.some((r) => r.contains(el));

  // ───────────────────────── documento ─────────────────────────
  if (Math.abs(W - root.clientWidth) > 1 && !window.matchMedia('(min-width: 1px)').matches === false && W > root.clientWidth + 1) {
    notes.push(`layout viewport inflada: innerWidth=${W} clientWidth=${root.clientWidth} (emulação isMobile:true? use newMobileContext)`);
  }
  const bodyS = cs(document.body);
  const htmlS = cs(root);
  const se = document.scrollingElement || root;
  const doc = {
    innerWidth: W,
    innerHeight: H,
    scrollWidth: se.scrollWidth,
    scrollHeight: se.scrollHeight,
    scrollsX: se.scrollWidth > W + 1,
    scrollsY: se.scrollHeight > H + 1,
    htmlOverflowX: htmlS.overflowX,
    bodyOverflowX: bodyS.overflowX,
    bodyOverflowY: bodyS.overflowY,
    // O overflow do body é PROPAGADO à viewport quando o do html é `visible`; nesse caso o body não rola sozinho.
    bodyScrollsY: htmlS.overflowY !== 'visible' && document.body.scrollHeight > document.body.clientHeight + 1 && /auto|scroll/.test(bodyS.overflowY),
    maskedX: /hidden|clip/.test(bodyS.overflowX) || /hidden|clip/.test(htmlS.overflowX),
    visualViewport: window.visualViewport ? { w: rnd(window.visualViewport.width), h: rnd(window.visualViewport.height) } : null,
  };
  if (doc.bodyScrollsY && doc.scrollsY) {
    add({ type: 'double-scroll', severity: 'P2', selector: 'body', detail: 'html e body rolam ao mesmo tempo', rect: null });
  }

  // ───────────────────────── elementos "que importam" ─────────────────────────
  const meaningful = [];
  const interactives = [];
  const seenInteractive = new Set();
  for (const el of allEls) {
    if (!inScope(el) || !rendered(el)) continue;
    const tag = el.tagName.toLowerCase();
    const s = cs(el);
    const isInt = el.matches(INTERACTIVE);
    let custom = false;
    if (!isInt && s.cursor === 'pointer' && el.parentElement && cs(el.parentElement).cursor !== 'pointer' && !el.closest(INTERACTIVE)) {
      custom = true;
    }
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim().length > 0);
    const media = /^(img|svg|canvas|video|picture)$/.test(tag);
    const inLeafletInternals = !!el.closest('.leaflet-container') && !el.closest('.leaflet-control');
    if ((isInt || custom) && !inLeafletInternals) {
      if (!ariaHidden(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true' && s.pointerEvents !== 'none' && !seenInteractive.has(el)) {
        seenInteractive.add(el);
        interactives.push({ el, custom });
      }
    }
    if (isInt || custom || ownText || media) {
      if (!ariaHidden(el)) meaningful.push({ el, interactive: isInt || custom, ownText, media });
    }
  }

  // ───────────────────────── 1. overflow / corte ─────────────────────────
  const xClip = (el, r) => {
    // 1º ancestral que NÃO é `visible` no eixo X decide.
    for (let a = el.parentElement; a && a !== document.body && a !== root; a = a.parentElement) {
      const ox = cs(a).overflowX;
      if (ox === 'auto' || ox === 'scroll') return { kind: 'scroll', a };
      if (ox === 'hidden' || ox === 'clip') {
        const b = clientBox(a);
        if (r.l < b.l - 1 || r.r > b.r + 1) return { kind: 'clipped', a, box: b };
      }
    }
    return null;
  };
  const yClip = (el, r) => {
    for (let a = el.parentElement; a && a !== document.body && a !== root; a = a.parentElement) {
      const oy = cs(a).overflowY;
      if (oy === 'auto' || oy === 'scroll') return null; // alcançável rolando
      if (oy === 'hidden' || oy === 'clip') {
        const b = clientBox(a);
        if (b.b - b.t <= 2) return null; // recolhido de propósito (acordeão)
        if (r.t < b.t - 1 || r.b > b.b + 1) return { a, box: b };
      }
    }
    return null;
  };
  const parkedOffscreen = (el) => {
    for (let a = el; a && a !== root; a = a.parentElement) {
      const s = cs(a);
      if ((s.position === 'fixed' || s.position === 'absolute') && s.transform !== 'none') return true;
      if (a.matches('[aria-hidden="true"],[inert]')) return true;
    }
    return false;
  };
  const overlapFrac = (r, b) => {
    const iw = Math.max(0, Math.min(r.r, b.r) - Math.max(r.l, b.l));
    const ih = Math.max(0, Math.min(r.b, b.b) - Math.max(r.t, b.t));
    return r.w * r.h > 0 ? (iw * ih) / (r.w * r.h) : 0;
  };

  if (want('overflow')) {
    for (const m of meaningful) {
      const el = m.el;
      const r = R(el);
      if (r.w < 2 || r.h < 2) continue;
      const base = { selector: sel(el), text: text(el), tag: el.tagName.toLowerCase(), interactive: m.interactive };
      const c = xClip(el, r);
      if (c && c.kind === 'clipped') {
        const hidden = rnd(Math.max(0, c.box.l - r.l) + Math.max(0, r.r - c.box.r));
        const visible = 1 - hidden / r.w;
        // Item inteiro escondido e não interativo costuma ser slide fora de cena: ignora.
        if (visible > 0.04 || m.interactive) {
          add({ ...base, type: 'clipped-x', severity: hidden < 3 ? 'P3' : m.interactive ? 'P1' : 'P2', clippedBy: sel(c.a), hiddenPx: hidden, visibleFraction: rnd(visible), rect: rr(r) });
        }
        continue;
      }
      if (c && c.kind === 'scroll') {
        // Elemento mais LARGO que o próprio contêiner de rolagem não é "item de carrossel": nem no início da
        // rolagem ele cabe. Em contêiner vertical-first (gaveta/sheet com overflow-y:auto, que torna o
        // overflow-x `auto` por computação) isso é rolagem horizontal acidental e conteúdo escondido.
        const sa = c.a;
        // largura de CONTEÚDO: um bloco tem a largura do contêiner mesmo com texto nowrap estourando (scrollWidth)
        const contentW = Math.max(r.w, el.scrollWidth);
        if (contentW > sa.clientWidth + 1 && (m.interactive || m.ownText)) {
          add({
            ...base,
            type: 'wide-in-scroller',
            // vertical-first = o contêiner de fato rola na vertical (gaveta/sheet); wrapper de tabela não
            severity: sa.scrollHeight > sa.clientHeight + 1 ? 'P2' : 'P3',
            scroller: sel(sa),
            elementWidth: rnd(contentW),
            scrollerClientWidth: sa.clientWidth,
            rect: rr(r),
          });
          continue;
        }
      }
      if (!c) {
        // sem ancestral que corte: confronta com a viewport
        const beyond = r.r > W + 1 || r.l < -1;
        if (beyond && !parkedOffscreen(el)) {
          const straddle = r.l < W - 1 && r.r > 1;
          const anchored = anchoredAncestor(el);
          add({
            ...base,
            type: straddle ? 'overflow-x' : 'offscreen-in-flow',
            severity: Math.max(0, r.r - W) + Math.max(0, -r.l) < 3 ? 'P3' : m.interactive ? 'P1' : 'P2',
            // masked = o usuário NÃO consegue rolar até lá (body/html cortam); scrollWidthSees = a métrica antiga acusaria
            masked: doc.maskedX,
            scrollWidthSees: doc.scrollsX,
            hiddenPx: rnd(Math.max(0, r.r - W) + Math.max(0, -r.l)),
            anchored: anchored ? sel(anchored) : null,
            rect: rr(r),
          });
          continue;
        }
      }
      if (m.interactive || m.ownText) {
        const y = yClip(el, r);
        if (y) {
          const vis = overlapFrac(r, y.box);
          if (vis < 0.6) {
            add({ ...base, type: 'clipped-y', severity: m.interactive ? 'P1' : 'P3', clippedBy: sel(y.a), visibleFraction: rnd(vis), rect: rr(r) });
          }
        }
      }
    }
    // Rolagem horizontal cujo contêiner já nasce fora da viewport / sem pista visual de que rola.
    for (const el of allEls) {
      if (!inScope(el) || !rendered(el)) continue;
      const s = cs(el);
      if (!(s.overflowX === 'auto' || s.overflowX === 'scroll')) continue;
      if (el.scrollWidth <= el.clientWidth + 1 || el.clientWidth < 20) continue;
      const box = clientBox(el);
      const kids = [...el.children].filter(rendered);
      const hiddenKids = kids.filter((k) => R(k).l >= box.r - 1);
      const partial = kids.filter((k) => {
        const kr = R(k);
        return kr.l < box.r - 1 && kr.r > box.r + 1;
      });
      const hasMask = (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none');
      const pseudo = (host) => ['::before', '::after'].some((p) => {
        const ps = getComputedStyle(host, p);
        return ps.content !== 'none' && /gradient/.test(ps.backgroundImage);
      });
      const explicitCue = hasMask || pseudo(el) || (el.parentElement && (pseudo(el.parentElement) || /gradient/.test(cs(el.parentElement).maskImage || '')));
      const cue = partial.length > 0 || explicitCue;
      const cueKind = explicitCue ? 'mask/gradiente' : partial.length > 0 ? 'item espiando na borda' : 'nenhuma';
      add({
        type: 'h-scroller',
        severity: !cue && hiddenKids.length ? 'P2' : 'P3',
        selector: sel(el),
        text: kids.slice(0, 4).map(text).join(' | '),
        hasVisualCue: !!cue,
        cueKind,
        hiddenChildren: hiddenKids.length,
        firstHidden: hiddenKids[0] ? text(hiddenKids[0]) : null,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        rect: rr(R(el)),
      });
    }
  }

  // ───────────────────────── 2. texto truncado ─────────────────────────
  if (want('truncate')) {
    for (const m of meaningful) {
      if (!m.ownText) continue;
      const el = m.el;
      const s = cs(el);
      const clipsOverflow = /hidden|clip/.test(s.overflowX);
      if (clipsOverflow && s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
        add({ type: 'text-truncated', severity: m.interactive ? 'P2' : 'P3', selector: sel(el), text: text(el), hiddenPx: el.scrollWidth - el.clientWidth, mode: 'ellipsis', interactive: m.interactive, rect: rr(R(el)) });
      } else if (clipsOverflow && s.whiteSpace === 'nowrap' && s.textOverflow !== 'ellipsis' && el.scrollWidth > el.clientWidth + 1) {
        add({ type: 'text-clipped', severity: 'P2', selector: sel(el), text: text(el), hiddenPx: el.scrollWidth - el.clientWidth, mode: 'nowrap-hidden', interactive: m.interactive, rect: rr(R(el)) });
      } else if (s.webkitLineClamp && s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) {
        add({ type: 'text-truncated', severity: 'P3', selector: sel(el), text: text(el), mode: 'line-clamp', interactive: m.interactive, rect: rr(R(el)) });
      }
    }
  }

  // ───────────────────────── 3. alvos de toque ─────────────────────────
  // A área tocável EFETIVA é medida por hit-test (elementFromPoint numa grade ao
  // redor): um `::before` transparente de 44px (a utilidade `hit-target-44`) aumenta
  // o alvo sem mudar a caixa do elemento. Só a caixa subestimaria a área real.
  if (want('targets')) {
    const sy0 = window.scrollY;
    let probes = 0;
    for (const it of interactives) {
      const el = it.el;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute('type') || '').toLowerCase();
      if (type === 'hidden') continue;
      let r = R(el);
      let label = null;
      // checkbox/radio: o rótulo faz parte da área tocável
      if (tag === 'input' && /checkbox|radio/.test(type)) {
        label = el.closest('label') || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
        if (label && rendered(label)) {
          const lr = R(label);
          r = { l: Math.min(r.l, lr.l), t: Math.min(r.t, lr.t), r: Math.max(r.r, lr.r), b: Math.max(r.b, lr.b), w: 0, h: 0 };
          r.w = r.r - r.l;
          r.h = r.b - r.t;
        }
      }
      // link inline dentro de texto corrido: exceção WCAG 2.5.8
      const s = cs(el);
      if (tag === 'a' && s.display === 'inline') {
        const parentText = (el.parentElement?.textContent || '').trim().length;
        if (parentText - (el.textContent || '').trim().length > 12) continue;
      }
      if (r.w >= 44 && r.h >= 44) continue;
      const boxW = r.w;
      const boxH = r.h;
      // sonda a área efetiva (só candidatos pequenos; no máximo 60 por página)
      let effW = r.w;
      let effH = r.h;
      let viaPseudo = false;
      if (probes < 80) {
        probes++;
        if (!anchoredAncestor(el)) {
          try {
            el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          } catch {
            /* ignora */
          }
        }
        const q = R(el);
        const pad = 26;
        const x0 = Math.max(0, Math.floor(q.l - pad));
        const x1 = Math.min(W - 1, Math.ceil(q.r + pad));
        const y0 = Math.max(0, Math.floor(q.t - pad));
        const y1 = Math.min(H - 1, Math.ceil(q.b + pad));
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let n = 0;
        for (let y = y0; y <= y1; y += 3) {
          for (let x = x0; x <= x1; x += 3) {
            const hit = document.elementFromPoint(x, y);
            if (hit && (hit === el || el.contains(hit) || (label && label.contains(hit)))) {
              n++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        // grade de 3px => erro de até ±3px: só trata como ampliação (pseudo-elemento) o que passa da caixa por mais que isso
        const STEP = 3;
        if (n > 0) {
          const mW = maxX - minX + STEP;
          const mH = maxY - minY + STEP;
          if (mW > boxW + STEP) {
            effW = mW;
            viaPseudo = true;
          }
          if (mH > boxH + STEP) {
            effH = mH;
            viaPseudo = true;
          }
        }
      }
      // 44px dentro do erro de amostragem conta como atendido
      if (effW >= 44 - 3 && effH >= 44 - 3) continue;
      const label2 = text(el);
      const iconOnly = !(el.textContent || '').trim() && !!el.querySelector('svg,img');
      const inNav = !!el.closest('nav,[class*="BottomNav" i],[class*="bottomNav" i],[class*="tabs" i],[role=tablist]');
      const formField = tag === 'input' || tag === 'select' || tag === 'textarea';
      const primary =
        formField ||
        inNav ||
        /btn|button|cta|primary/i.test(el.className?.toString?.() || '') ||
        type === 'submit' ||
        (tag === 'button' && label2.length >= 3 && !iconOnly);
      const smallest = Math.min(effW, effH);
      add({
        type: 'small-target',
        severity: primary || smallest < 24 ? 'P2' : 'P3',
        kind: primary ? 'primary' : iconOnly ? 'secondary-icon' : 'secondary',
        selector: sel(el),
        text: label2,
        tag,
        w: rnd(effW),
        h: rnd(effH),
        boxW: rnd(boxW),
        boxH: rnd(boxH),
        extendedByPseudo: viaPseudo,
        rect: rr(R(el)),
      });
    }
    window.scrollTo(0, sy0);
  }

  // ───────────────────────── 4. rolagem aninhada ─────────────────────────
  const scrollerList = [];
  if (want('scrollers')) {
    for (const el of allEls) {
      if (!inScope(el)) continue;
      const s = cs(el);
      const sy = (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
      if (!sy || el.clientHeight < 40 || !rendered(el)) continue;
      // contêiner de rolagem mais próximo acima
      let parentScroller = null;
      for (let a = el.parentElement; a && a !== root; a = a.parentElement) {
        const ps = cs(a);
        if (a === document.body) {
          if (doc.scrollsY && !anchoredAncestor(el)) parentScroller = document.body;
          break;
        }
        if ((ps.overflowY === 'auto' || ps.overflowY === 'scroll') && a.scrollHeight > a.clientHeight + 1) {
          parentScroller = a;
          break;
        }
        if (ps.position === 'fixed') break; // subárvore fixa não rola com o documento
      }
      if (!parentScroller && doc.scrollsY && !anchoredAncestor(el) && el !== document.body) parentScroller = root;
      const r = R(el);
      scrollerList.push({ el, parentScroller });
      if (parentScroller) {
        add({
          type: 'nested-scroll',
          severity: r.h >= 120 ? 'P2' : 'P3',
          selector: sel(el),
          parentScroller: sel(parentScroller),
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          rect: rr(r),
        });
      }
    }
  }

  // ───────────────────────── 5. fontes de input (zoom no iOS) ─────────────────────────
  if (want('fonts')) {
    for (const it of interactives) {
      const el = it.el;
      const tag = el.tagName.toLowerCase();
      if (!/^(input|textarea|select)$/.test(tag)) continue;
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (/checkbox|radio|range|color|file|button|submit|reset|image/.test(type)) continue;
      const fs = parseFloat(cs(el).fontSize);
      if (fs < 16) {
        add({ type: 'ios-zoom-font', severity: 'P3', selector: sel(el), text: text(el), fontSizePx: fs, rect: rr(R(el)) });
      }
    }
  }

  // ───────────────────────── 6. camadas fixas ─────────────────────────
  const fixedList = [];
  if (want('layers')) {
    for (const el of allEls) {
      const s = cs(el);
      if (s.position !== 'fixed' && s.position !== 'sticky') continue;
      if (!rendered(el)) continue;
      const r = R(el);
      if (r.w * r.h < 100) continue;
      const cover = (Math.max(0, Math.min(r.r, W) - Math.max(r.l, 0)) * Math.max(0, Math.min(r.b, H) - Math.max(r.t, 0))) / (W * H);
      fixedList.push({ el, r, z: parseInt(s.zIndex, 10), pos: s.position, cover });
    }
    const bars = fixedList.filter((f) => f.cover < 0.8 && !overlayRoots.some((o) => o.el.contains(f.el)));
    for (let i = 0; i < bars.length; i++) {
      for (let j = i + 1; j < bars.length; j++) {
        const a = bars[i];
        const b = bars[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const iw = Math.min(a.r.r, b.r.r) - Math.max(a.r.l, b.r.l);
        const ih = Math.min(a.r.b, b.r.b) - Math.max(a.r.t, b.r.t);
        if (iw > 4 && ih > 4) {
          // Sobreposição de barras fixas é frequentemente intencional (a barra de descanso substitui a de ação).
          // O sinal de defeito é o `covered`/`partly-covered` de um controle; aqui fica como informação.
          add({
            type: 'fixed-overlap',
            severity: 'P3',
            selector: sel(a.el),
            other: sel(b.el),
            overlapPx: { w: rnd(iw), h: rnd(ih) },
            z: [Number.isNaN(a.z) ? null : a.z, Number.isNaN(b.z) ? null : b.z],
            rect: rr(a.r),
          });
        }
      }
    }
    // barra fixa com fundo translúcido sobre outro conteúdo
    const alpha = (c) => {
      let m = c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        const p = m[1].split(/[,\s/]+/).filter(Boolean);
        return p.length >= 4 ? parseFloat(p[3]) : 1;
      }
      m = c.match(/\/\s*([\d.]+%?)\s*\)/);
      if (m) return m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
      return c === 'transparent' ? 0 : 1;
    };
    for (const f of fixedList) {
      if (f.cover >= 0.8) continue;
      const s = cs(f.el);
      const hasText = (f.el.textContent || '').trim().length > 0;
      if (!hasText || f.r.h >= H * 0.25) continue;
      // O fundo visível pode estar num descendente grande (wrapper transparente + corpo pintado).
      const area = f.r.w * f.r.h;
      let best = { el: f.el, a: alpha(s.backgroundColor), blur: !!(s.backdropFilter && s.backdropFilter !== 'none') };
      for (const d of f.el.querySelectorAll('*')) {
        if (!rendered(d)) continue;
        const dr = R(d);
        if (dr.w * dr.h < area * 0.4) continue;
        const ds = cs(d);
        const da = alpha(ds.backgroundColor);
        const dblur = !!(ds.backdropFilter && ds.backdropFilter !== 'none');
        if (da > best.a || (dblur && !best.blur)) best = { el: d, a: Math.max(da, best.a), blur: best.blur || dblur };
      }
      if (best.a < 0.5 && !best.blur) {
        add({ type: 'translucent-fixed-bar', severity: 'P2', selector: sel(best.el), text: text(f.el), backgroundAlpha: Math.round(best.a * 100) / 100, bar: sel(f.el), rect: rr(f.r) });
      }
    }
  }

  // ───────────────────────── 7. chrome / navegação ─────────────────────────
  const chrome = {};
  for (const [key, selector] of Object.entries(O.chrome || {})) {
    let found = null;
    for (const el of document.querySelectorAll(selector)) {
      if (rendered(el)) {
        found = el;
        break;
      }
    }
    if (found) {
      const s = cs(found);
      chrome[key] = { selector: sel(found), rect: rr(R(found)), position: s.position, z: parseInt(s.zIndex, 10) || null, display: s.display };
    } else {
      chrome[key] = null;
    }
  }
  if (want('nav') && O.chrome && Object.keys(O.chrome).length) {
    const side = chrome.sidebar;
    const hasNav = !!chrome.bottomNav || !!chrome.topBar;
    if (side && !hasNav && side.position !== 'fixed' && side.position !== 'sticky' && side.rect.h >= H * 0.25) {
      add({ type: 'sidebar-stacked-no-nav', severity: 'P1', selector: side.selector, sidebarHeight: side.rect.h, viewportHeight: H, detail: 'sem bottom nav nem top bar; a sidebar inteira empilha acima do conteúdo', rect: side.rect });
    }
    if (chrome.main && chrome.main.rect.t > H * 0.5) {
      add({ type: 'content-below-fold', severity: 'P1', selector: chrome.main.selector, contentTop: chrome.main.rect.t, viewportHeight: H, detail: 'o conteúdo principal só começa depois de metade da tela', rect: chrome.main.rect });
    }
    // Sair: existe? está à vista sem rolar?
    let logout = null;
    for (const el of document.querySelectorAll('button,a,[role=button],[role=menuitem]')) {
      if (/^(sair|logout)( da conta)?$/i.test((el.textContent || '').trim()) && rendered(el)) {
        logout = el;
        break;
      }
    }
    chrome.logout = logout ? { selector: sel(logout), rect: rr(R(logout)), inViewport: R(logout).b <= H && R(logout).t >= 0 } : null;
  }

  // ───────────────────────── 8. safe-area ─────────────────────────
  if (want('safearea') && O.insets) {
    const I = O.insets;
    const sy = window.scrollY;
    window.scrollTo(0, 0);
    for (const m of meaningful) {
      const el = m.el;
      if (!m.interactive && !m.ownText) continue;
      const r = R(el);
      if (r.w < 2 || r.h < 2) continue;
      const anchored = anchoredAncestor(el);
      const hits = [];
      if (I.top > 0 && r.t < I.top - 1 && r.b > 1) hits.push(`topo ${rnd(I.top - Math.max(r.t, 0))}px`);
      if (I.left > 0 && r.l < I.left - 1 && r.r > 1) hits.push(`esq ${rnd(I.left - Math.max(r.l, 0))}px`);
      if (I.right > 0 && r.r > W - I.right + 1 && r.l < W - 1) hits.push(`dir ${rnd(Math.min(r.r, W) - (W - I.right))}px`);
      if (I.bottom > 0 && anchored && r.b > H - I.bottom + 1 && r.t < H - 1) hits.push(`base ${rnd(Math.min(r.b, H) - (H - I.bottom))}px`);
      if (!hits.length) continue;
      // conteúdo que rola: só importa o que está ancorado ou na 1ª dobra (topo/lados)
      add({
        type: 'in-safe-area',
        severity: m.interactive ? 'P2' : 'P3',
        selector: sel(el),
        text: text(el),
        interactive: m.interactive,
        anchored: anchored ? sel(anchored) : null,
        overlaps: hits,
        insets: I,
        rect: rr(r),
      });
    }
    window.scrollTo(0, sy);
  }

  // ───────────────────────── 9. overlays (modal/gaveta) ─────────────────────────
  const overlays = [];
  if (want('overlay')) {
    const vhRulesOf = (el) => {
      const out = [];
      const props = ['max-height', 'height', 'min-height'];
      const bad = (v) => /(^|[^dsl])\d*\.?\d+vh\b/.test(v) && !/[dsl]vh/.test(v);
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        const walk = (list) => {
          for (const rule of list) {
            if (rule.cssRules && !rule.selectorText) {
              // @media / @supports: só vale se a condição casa agora
              if (rule.media && !window.matchMedia(rule.media.mediaText).matches) continue;
              if (rule.conditionText && rule.constructor?.name === 'CSSSupportsRule' && !CSS.supports(rule.conditionText)) continue;
              walk(rule.cssRules);
              continue;
            }
            if (!rule.selectorText) continue;
            let hit = false;
            try {
              hit = el.matches(rule.selectorText);
            } catch {
              hit = false;
            }
            if (!hit) continue;
            for (const p of props) {
              const v = rule.style.getPropertyValue(p);
              if (v && bad(v)) out.push({ selector: rule.selectorText.slice(0, 80), prop: p, value: v });
            }
          }
        };
        walk(rules);
      }
      const inline = el.getAttribute('style') || '';
      for (const p of props) {
        const m = inline.match(new RegExp(`${p}\\s*:\\s*([^;]+)`));
        if (m && bad(m[1])) out.push({ selector: 'style=""', prop: p, value: m[1].trim() });
      }
      return out;
    };

    for (const o of overlayRoots) {
      if (scopeRoots && !scopeRoots.some((s) => s === o.el || s.contains(o.el) || o.el.contains(s))) continue;
      const rootR = R(o.el);
      let panel = o.el;
      if (o.cover >= 0.8) {
        // o root é o backdrop: o painel é o diálogo declarado ou, na falta dele,
        // o maior descendente renderizado que NÃO seja o próprio backdrop
        const declared = [...o.el.querySelectorAll('[role=dialog],[role=alertdialog],[aria-modal="true"]')].find(rendered);
        if (declared) {
          panel = declared;
        } else {
          const rootArea = rootR.w * rootR.h;
          let best = null;
          let bestArea = 0;
          for (const d of o.el.querySelectorAll('*')) {
            if (!rendered(d)) continue;
            const dr = R(d);
            const area = dr.w * dr.h;
            const samePaintAsRoot = Math.abs(dr.w - rootR.w) < 2 && Math.abs(dr.h - rootR.h) < 2;
            if (!samePaintAsRoot && area > bestArea && area <= rootArea * 4 && dr.w > 120 && (/panel|sheet|modal|drawer|dialog|card/i.test(d.className?.toString?.() || '') || d.parentElement === o.el)) {
              best = d;
              bestArea = area;
            }
          }
          if (best) panel = best;
        }
      }
      const pr = R(panel);
      // rolagem interna disponível?
      const scrollables = [panel, ...panel.querySelectorAll('*')].filter((e) => {
        const s = cs(e);
        return (s.overflowY === 'auto' || s.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 1 && rendered(e);
      });
      // algo dentro do painel está cortado e SEM rolagem para chegar lá?
      const scrollableNames = new Set(scrollables);
      const contentBeyond = [...panel.querySelectorAll('*')].some((e) => {
        if (!rendered(e)) return false;
        const er = R(e);
        if (er.h < 2) return false;
        if (er.b <= H + 1 && er.t >= -1) return false;
        for (let a = e; a && a !== o.el.parentElement; a = a.parentElement) if (scrollableNames.has(a)) return false;
        return /^(button|a|input|select|textarea)$/i.test(e.tagName);
      });
      const closeCandidates = [...panel.querySelectorAll('button,a,[role=button]')].filter((b) => {
        const t = `${b.getAttribute('aria-label') || ''} ${b.textContent || ''}`.trim();
        return rendered(b) && (/^(×|✕|x|✖)$/i.test((b.textContent || '').trim()) || /fechar|close|cancelar|voltar|agora n[aã]o|continuar|^sair$/i.test(t));
      });
      const closeVisible = closeCandidates.find((b) => {
        const br = R(b);
        const cx = br.l + br.w / 2;
        const cy = br.t + br.h / 2;
        if (cx < 0 || cx > W || cy < 0 || cy > H) return false;
        const hit = document.elementFromPoint(cx, cy);
        return hit && (hit === b || b.contains(hit));
      });
      const ov = {
        root: sel(o.el),
        panel: sel(panel),
        z: o.z,
        rect: rr(pr),
        rootRect: rr(rootR),
        topCut: pr.t < -1,
        bottomCut: pr.b > H + 1,
        heightExceedsViewport: pr.h > H + 1,
        internalScroll: scrollables.length > 0,
        interactiveBeyondViewportWithoutScroll: contentBeyond,
        closeCandidates: closeCandidates.length,
        closeVisible: !!closeVisible,
        vhRules: vhRulesOf(panel)
          .concat(panel !== o.el ? vhRulesOf(o.el) : [])
          .concat(scrollables.filter((e) => e !== panel).flatMap((e) => vhRulesOf(e))),
        bodyScrollLocked: /hidden/.test(bodyS.overflow) || /hidden/.test(htmlS.overflow) || /hidden/.test(bodyS.overflowY),
      };
      overlays.push(ov);
      if (ov.topCut || ov.bottomCut) {
        add({ type: 'modal-out-of-viewport', severity: ov.heightExceedsViewport && !ov.internalScroll ? 'P1' : 'P2', selector: ov.panel, topCut: ov.topCut, bottomCut: ov.bottomCut, panelHeight: rnd(pr.h), viewportHeight: H, internalScroll: ov.internalScroll, rect: rr(pr) });
      }
      if (contentBeyond) {
        add({ type: 'modal-unreachable-content', severity: 'P1', selector: ov.panel, detail: 'há botão/campo fora da tela e nenhum contêiner rolável para chegar até ele', viewportHeight: H, rect: rr(pr) });
      }
      if (ov.vhRules.length) {
        add({ type: 'vh-unit-sheet', severity: 'P2', selector: ov.panel, rules: ov.vhRules, detail: 'altura em vh (viewport grande) em vez de dvh; o efeito só aparece com a barra de endereço dinâmica (aparelho real)', rect: rr(pr) });
      }
      if (!ov.closeVisible && ov.closeCandidates === 0) {
        add({ type: 'modal-no-close', severity: 'P3', selector: ov.panel, detail: 'nenhum controle de fechar/cancelar identificado', rect: rr(pr) });
      }
    }
  }

  // ───────────────────────── 10. coberto / inalcançável ─────────────────────────
  // Critério: existe ALGUMA posição de rolagem em que o controle fica livre e dentro da tela?
  // (centralizar nem sempre basta: a faixa livre entre header e barra fixa pode ser menor que a tela.)
  // Só reporta se TODAS as tentativas (centro, topo, base) falharem; relata a melhor delas.
  if (want('covered')) {
    const labelOk = (el, hit) => {
      const lab = el.closest('label');
      return lab && (lab === hit || lab.contains(hit));
    };
    const chromeEntries = Object.entries(O.chrome || {}).sort(([a], [b]) => (a === 'main') - (b === 'main'));
    const chromeKeyOf = (el) => {
      for (const [key, selector] of chromeEntries) {
        try {
          if (el.closest(selector)) return key;
        } catch {
          /* seletor inválido */
        }
      }
      return null;
    };
    const rank = { ok: 0, partly: 1, covered: 2, unreachable: 3 };
    const scrollerOf = (el) => {
      for (let a = el.parentElement; a && a !== document.body && a !== root; a = a.parentElement) {
        const oy = cs(a).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1) return a;
      }
      return null;
    };
    // pos: 'center' | 'start' | 'end' | número (0..1) = fração da altura em que o TOPO do elemento deve ficar
    const attempt = (el, pos) => {
      try {
        if (typeof pos === 'number') {
          el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
          const off = Math.round(H * pos);
          const sc = scrollerOf(el);
          if (sc) sc.scrollTop -= off;
          else window.scrollBy(0, -off);
        } else {
          el.scrollIntoView({ block: pos, inline: 'nearest', behavior: 'instant' });
        }
      } catch {
        /* ignora */
      }
      const r = R(el);
      // Parte VISÍVEL do controle: o toque cai nela. Uma aba que espia na borda continua tocável; o que
      // torna um controle inalcançável é quase nada dele caber na tela (< metade, e < 24px).
      const vr = { l: Math.max(r.l, 0), r: Math.min(r.r, W), t: Math.max(r.t, 0), b: Math.min(r.b, H) };
      const vw = vr.r - vr.l;
      const vh = vr.b - vr.t;
      if (vw < Math.min(r.w * 0.5, 24) || vh < Math.min(r.h * 0.5, 24)) return { kind: 'unreachable', r, sy: window.scrollY };
      const cx = vr.l + vw / 2;
      const cy = vr.t + vh / 2;
      const pts = [
        [cx, cy],
        [vr.l + vw * 0.25, cy],
        [vr.l + vw * 0.75, cy],
        [cx, vr.t + vh * 0.25],
        [cx, vr.t + vh * 0.75],
      ];
      const blockers = [];
      let centerBlocked = false;
      pts.forEach(([x, y], idx) => {
        const hit = document.elementFromPoint(x, y);
        const ok = hit && (hit === el || el.contains(hit) || labelOk(el, hit));
        if (!ok) {
          blockers.push(hit);
          if (idx === 0) centerBlocked = true;
        }
      });
      if (!blockers.length) return { kind: 'ok', r, sy: window.scrollY };
      return { kind: centerBlocked ? 'covered' : 'partly', r, blockers, total: pts.length, sy: window.scrollY };
    };
    const sy0 = window.scrollY;
    for (const it of interactives) {
      const el = it.el;
      if (!el.isConnected) continue;
      const r0 = R(el);
      if (r0.w < 2 || r0.h < 2) continue;
      let best = null;
      for (const block of ['center', 'start', 'end', 0.15, 0.3, 0.45, 0.6, 0.75]) {
        const a = attempt(el, block);
        if (!best || rank[a.kind] < rank[best.kind]) best = a;
        if (a.kind === 'ok') break;
      }
      if (best.kind === 'ok') continue;
      const r = best.r;
      const base = { selector: sel(el), text: text(el), tag: el.tagName.toLowerCase(), rect: rr(r) };
      if (best.kind === 'unreachable') {
        // gaveta/menu fechado (translada para fora da tela) não é defeito
        if (parkedOffscreen(el)) continue;
        add({ ...base, type: 'unreachable', severity: 'P1', detail: 'em nenhuma posição de rolagem testada o controle entra na viewport', viewport: { w: W, h: H } });
        continue;
      }
      const top = best.blockers[0] || null;
      const topCs = top ? cs(top) : null;
      const byModal = top && overlayRoots.find((o) => o.cover >= 0.8 && o.el.contains(top) && !o.el.contains(el));
      const centerBlocked = best.kind === 'covered';
      add({
        ...base,
        type: byModal ? 'covered-by-overlay' : centerBlocked ? 'covered' : 'partly-covered',
        severity: byModal ? 'P3' : centerBlocked ? 'P1' : 'P2',
        coveredFraction: rnd(best.blockers.length / best.total),
        coveredBy: top
          ? {
              selector: sel(top),
              text: text(top),
              position: topCs.position,
              z: parseInt(topCs.zIndex, 10) || null,
              chrome: chromeKeyOf(top),
              rect: rr(R(top)),
              isAncestorOfTarget: top.contains(el),
            }
          : null,
        targetChrome: chromeKeyOf(el),
        triedPositions: 'centro, topo, base e 5 alinhamentos intermediários',
      });
    }
    window.scrollTo(0, sy0);
  }

  // ───────────────────────── 11. reserva no fim da página ─────────────────────────
  const inInnerScroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body && a !== root; a = a.parentElement) {
      const oy = cs(a).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight + 1) return true;
    }
    return false;
  };
  let bottomReserve = null;
  if (want('reserve') && !O.expectOverlay) {
    const sy = window.scrollY;
    window.scrollTo(0, se.scrollHeight);
    let lastBottom = -Infinity;
    let lastSel = null;
    for (const m of meaningful) {
      if (anchoredAncestor(m.el)) continue;
      if (inInnerScroller(m.el)) continue; // rolagem interna: o que está fora da vista dela não conta como "fim da página"
      if (overlayRoots.some((o) => o.cover >= 0.8 && o.el.contains(m.el))) continue;
      const r = R(m.el);
      if (r.b > lastBottom && r.h > 2 && r.t < H + 2000) {
        lastBottom = r.b;
        lastSel = m.el;
      }
    }
    const barCands = [];
    for (const el of allEls) {
      const s = cs(el);
      if (s.position !== 'fixed') continue;
      if (!rendered(el)) continue;
      const r = R(el);
      if (r.w < W * 0.5 || r.h < 20 || r.b > H + 2) continue;
      if (r.w * r.h >= W * H * 0.8) continue;
      if (overlayRoots.some((o) => o.cover >= 0.8 && o.el.contains(el))) continue;
      barCands.push({ selector: sel(el), top: r.t, bottom: r.b, h: r.h });
    }
    // pilha: começa nas que encostam no fundo da tela e sobe pelas que repousam sobre outra
    const chromes = [];
    let stackTop = H;
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of barCands) {
        if (chromes.includes(c)) continue;
        if (c.bottom >= stackTop - 2) {
          chromes.push(c);
          stackTop = Math.min(stackTop, c.top);
          grew = true;
        }
      }
    }
    chromes.forEach((c, i) => (chromes[i] = { selector: c.selector, top: rnd(c.top), h: rnd(c.h) }));
    const chromeTop = chromes.length ? Math.min(...chromes.map((c) => c.top)) : H;
    bottomReserve = {
      lastContent: lastSel ? sel(lastSel) : null,
      lastContentText: lastSel ? text(lastSel) : null,
      lastContentBottom: rnd(lastBottom),
      chromeTop,
      gap: rnd(chromeTop - lastBottom),
      chrome: chromes,
      emptyTail: rnd(Math.max(0, H - lastBottom)),
    };
    if (bottomReserve.gap < -1) {
      add({ type: 'content-under-chrome', severity: 'P1', selector: bottomReserve.lastContent, text: bottomReserve.lastContentText, gap: bottomReserve.gap, chrome: chromes.map((c) => c.selector), detail: 'o fim do conteúdo fica sob uma barra fixa mesmo rolando até o final', rect: null });
    }
    if (bottomReserve.emptyTail - (H - chromeTop) > 140) {
      add({ type: 'excess-bottom-space', severity: 'P3', selector: bottomReserve.lastContent, emptyTail: bottomReserve.emptyTail, chromeHeight: rnd(H - chromeTop), rect: null });
    }
    window.scrollTo(0, sy);
  }

  // ───────────────────────── retorno ─────────────────────────
  // scrollIntoView rola também contêineres overflow:hidden/auto; devolve tudo a zero
  // para que nada (evidência, passos seguintes) enxergue a página alterada pela medição.
  for (const el of allEls) {
    if (el.scrollLeft !== (initialScroll.get(el)?.l ?? 0)) el.scrollLeft = initialScroll.get(el)?.l ?? 0;
    if (el.scrollTop !== (initialScroll.get(el)?.t ?? 0)) el.scrollTop = initialScroll.get(el)?.t ?? 0;
  }
  window.scrollTo(0, 0);
  const sevRank = { P1: 0, P2: 1, P3: 2 };
  findings.sort((a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3));
  return {
    viewport: { w: W, h: H, dpr: window.devicePixelRatio },
    doc,
    chrome,
    overlays,
    overlayRoots: overlayRoots.map((o) => ({ root: sel(o.el), z: o.z, cover: rnd(o.cover) })),
    scopedTo: scopeRoots ? scopeRoots.map(sel) : null,
    bottomReserve,
    scrollers: scrollerList.length,
    totals: { meaningful: meaningful.length, interactives: interactives.length, findings: Object.values(counts).reduce((a, b) => a + b, 0) },
    counts,
    notes,
    findings,
  };
}

/** Desenha caixas numeradas sobre os achados (só para a captura de evidência; roda DEPOIS da medição). */
export function annotateBoxes(boxes) {
  const layer = document.createElement('div');
  layer.setAttribute('data-qa-annotation', '1');
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  boxes.forEach((b, i) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${b.l}px;top:${b.t}px;width:${Math.max(b.w, 2)}px;height:${Math.max(b.h, 2)}px;outline:2px solid ${b.color || '#e11d48'};outline-offset:-1px;background:${b.color || '#e11d48'}22`;
    const n = document.createElement('span');
    n.textContent = String(i + 1);
    n.style.cssText = `position:absolute;left:0;top:0;transform:translateY(-100%);font:700 10px/12px sans-serif;color:#fff;background:${b.color || '#e11d48'};padding:0 3px`;
    d.appendChild(n);
    layer.appendChild(d);
  });
  document.body.appendChild(layer);
}

/**
 * Classificação dos achados do plano de 12/10/2026 (G1–G8, A1–A12, P1–P9, N1)
 * a partir do que o runner MEDIU.
 *
 * Regras de honestidade (ver o prompt da Onda 0):
 *  - CONFIRMADO  = reproduzido em todas as células aplicáveis esperadas.
 *  - PARCIAL     = reproduzido só em parte das células aplicáveis, OU a prova depende de
 *                  aparelho real (`deviceOnly`) e aqui só se comprova a causa, não o efeito.
 *  - REFUTADO    = TODAS as células esperadas executaram e o defeito não apareceu.
 *                  Ausência de alerta de um detector não basta: o cenário tem que ter rodado.
 *  - BLOQUEADO   = alguma célula necessária não executou (ambiente/dependência) e nada reproduziu.
 *  - NÃO TESTADO = nenhum cenário cobre a condição.
 *
 * "na" (não se aplica): a condição do defeito nunca se formou naquela célula (ex.: o mapa
 * nunca encontra a bottom nav porque a página não rola). Fica fora do denominador.
 */

export const PORTRAIT = ['320x568', '360x740', '375x667', '390x844', '412x915', '430x932'];
export const LANDSCAPE = ['844x390', '932x430'];
export const TABLET = ['768x1024'];
export const ALL_VP = [...PORTRAIT, ...LANDSCAPE, ...TABLET];

const fnd = (cell, type, pred = () => true) => (cell.report?.findings ?? []).filter((f) => f.type === type && pred(f));
const anyF = (cell, type, pred) => fnd(cell, type, pred).length > 0;
const custom = (cell, name) => cell.custom?.[name];
const NA = (reason) => ({ na: true, reason });
const BLK = (reason) => ({ blocked: true, reason });

// ───────────────────────── definições ─────────────────────────

export const DEFS = [
  // ═══════════════ Globais ═══════════════
  {
    id: 'G1',
    area: 'global',
    severity: 'P1',
    title: 'Faixa 721–980px e paisagem sem navegação: a sidebar inteira empilha acima do conteúdo',
    cells: [
      { scenario: 'student.today', states: ['default'], viewports: [...LANDSCAPE, ...TABLET] },
      { scenario: 'personal.dashboard', states: ['default'], viewports: [...LANDSCAPE, ...TABLET] },
      { scenario: 'nutri.home', states: ['default'], viewports: [...LANDSCAPE, ...TABLET] },
    ],
    controls: [{ scenario: 'student.today', states: ['default'], viewports: ['390x844'] }],
    test: (c) => {
      const a = fnd(c, 'sidebar-stacked-no-nav')[0];
      const b = fnd(c, 'content-below-fold')[0];
      return { hit: !!(a || b), detail: { sidebarHeight: a?.sidebarHeight ?? c.report.chrome.sidebar?.rect?.h ?? null, mainTop: b?.contentTop ?? c.report.chrome.main?.rect?.t ?? null, viewportHeight: c.report.viewport.h, bottomNav: !!c.report.chrome.bottomNav, topBar: !!c.report.chrome.topBar } };
    },
    claims: [(f) => ['sidebar-stacked-no-nav', 'content-below-fold'].includes(f.type), (f, c) => f.type === 'small-target' && /sidebar|navLink|logout/i.test(f.selector) && [...LANDSCAPE, ...TABLET].includes(c.viewport)],
  },
  {
    id: 'G2',
    area: 'global',
    severity: 'P1',
    title: 'Cookie banner sem reserva dentro do app: cobre o fim do conteúdo e os controles',
    cells: ['student.today', 'student.profile', 'personal.dashboard', 'nutri.home'].map((s) => ({ scenario: s, states: ['cookie'], viewports: PORTRAIT })),
    controls: [{ scenario: 'student.today', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      const cookie = c.report.chrome.cookie;
      if (!cookie) return BLK('banner de cookies não apareceu no estado cookie');
      const under = fnd(c, 'content-under-chrome', (f) => (f.chrome ?? []).some((s) => /cookie/.test(s)))[0];
      const coveredMain = fnd(c, 'covered').concat(fnd(c, 'partly-covered')).filter((f) => f.coveredBy?.chrome === 'cookie' && ['main', 'bottomNav'].includes(f.targetChrome));
      return { hit: !!under || coveredMain.length > 0, detail: { bannerHeight: cookie.rect.h, bannerFractionOfViewport: Math.round((cookie.rect.h / c.report.viewport.h) * 100) / 100, gapAtBottom: c.report.bottomReserve?.gap ?? null, coveredContentControls: coveredMain.slice(0, 3).map((f) => f.text), pageScrolls: c.report.doc.scrollsY } };
    },
    claims: [(f) => f.type === 'content-under-chrome' && (f.chrome ?? []).some((s) => /cookie/.test(s)), (f) => ['covered', 'partly-covered'].includes(f.type) && f.coveredBy?.chrome === 'cookie'],
  },
  {
    id: 'G3',
    area: 'global',
    severity: 'P1',
    title: 'Mini-player do treino cobre o fim de toda página (--mini-player-h inexistente)',
    cells: ['student.today', 'student.profile', 'student.ficha', 'student.plano', 'student.alimentacao', 'student.evolucao'].map((s) => ({ scenario: s, states: ['workout-active'], viewports: PORTRAIT })),
    controls: [{ scenario: 'student.today', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      if (!c.report.chrome.miniPlayer) return BLK('mini-player não apareceu (estado workout-active)');
      const under = fnd(c, 'content-under-chrome', (f) => (f.chrome ?? []).some((s) => /wmp/.test(s)))[0];
      const part = fnd(c, 'partly-covered').concat(fnd(c, 'covered')).filter((f) => f.coveredBy?.chrome === 'miniPlayer');
      return { hit: !!under || part.length > 0, detail: { miniPlayerHeight: c.report.chrome.miniPlayer.rect.h, gapAtBottom: c.report.bottomReserve?.gap ?? null, lastContent: c.report.bottomReserve?.lastContentText ?? null, coveredControls: part.slice(0, 3).map((f) => ({ text: f.text, coveredFraction: f.coveredFraction })) } };
    },
    claims: [(f) => f.type === 'content-under-chrome' && (f.chrome ?? []).some((s) => /wmp/.test(s)), (f) => ['covered', 'partly-covered'].includes(f.type) && f.coveredBy?.chrome === 'miniPlayer'],
  },
  {
    id: 'G4',
    area: 'global',
    severity: 'P2',
    title: 'Toast global (z 300) fica abaixo dos modais (z 1000+)',
    cells: [{ scenario: 'student.profile', states: ['overlay:essential-modal'], viewports: ALL_VP }],
    test: (c) => {
      const t = custom(c, 'toastUnderModal');
      if (!t || t.error) return BLK(t?.error ?? 'passo toastUnderModal não executou');
      if (!t.toastAppeared) return BLK('o toast de validação não apareceu');
      return { hit: t.toastOnTop === false, detail: { toastZ: t.toastZ, modalBackdropZ: t.modalBackdropZ, toastOnTop: t.toastOnTop, coveredBy: t.coveredBy } };
    },
  },
  {
    id: 'G5',
    area: 'global',
    severity: 'P2',
    note: 'O que as capturas sustentam é o banner COBRINDO a top bar (logo e ícone Mensagens). A ilegibilidade pelo fundo a 8% só se demonstra sobre conteúdo/tema escuro.',
    title: 'OfflineBanner com fundo a 8% de opacidade e sobre a top bar',
    cells: [{ scenario: 'student.today', states: ['offline'], viewports: PORTRAIT }],
    test: (c) => {
      const f = fnd(c, 'translucent-fixed-bar', (x) => /Sem conexão/i.test(x.text))[0];
      const topCovered = fnd(c, 'covered').concat(fnd(c, 'partly-covered')).filter((x) => x.targetChrome === 'topBar');
      return { hit: !!f, detail: f ? { backgroundAlpha: f.backgroundAlpha, text: f.text, topBarControlsCoveredByBanner: topCovered.map((x) => x.text || x.selector).slice(0, 3) } : { note: 'banner sem fundo translúcido detectado' } };
    },
    claims: [(f) => f.type === 'translucent-fixed-bar' && /Sem conexão/i.test(f.text), (f, c) => c.state === 'offline' && ['covered', 'partly-covered'].includes(f.type) && f.targetChrome === 'topBar'],
  },
  {
    id: 'G6',
    area: 'global',
    severity: 'P2',
    title: 'Sheets e modais com altura em vh (sem dvh)',
    cells: [
      { scenario: 'student.session', states: ['overlay:exercises-sheet', 'overlay:substitute-sheet'], viewports: PORTRAIT },
      { scenario: 'student.free-setup', states: ['overlay:exercise-picker'], viewports: PORTRAIT },
      { scenario: 'student.profile', states: ['overlay:essential-modal'], viewports: PORTRAIT },
    ],
    deviceOnly: 'O efeito (topo do sheet cortado) depende da barra de endereço dinâmica do Chrome Android/iOS. Aqui se comprova a REGRA CSS em uso (vh sem dvh), não o corte; a confirmação visual exige aparelho real.',
    test: (c) => {
      const fs = fnd(c, 'vh-unit-sheet');
      return { hit: fs.length > 0, detail: { rules: [...new Set(fs.flatMap((f) => f.rules.map((r) => `${r.selector} { ${r.prop}: ${r.value} }`)))].slice(0, 4) } };
    },
    claims: [(f) => f.type === 'vh-unit-sheet'],
  },
  {
    id: 'G7',
    area: 'global',
    severity: 'P2',
    deviceOnly: 'Emulation.setSafeAreaInsetsOverride modela o env(safe-area-inset-*) do iOS. No Android WebView o env() é 0 e quem resolve é adjustMarginsForEdgeToEdge (CLAUDE.md); aqui se comprova a CAUSA CSS no iOS, não o efeito no Android.',
    title: 'Controles sob o notch / home indicator (safe-area ausente)',
    cells: [
      { scenario: 'auth.login', states: ['safe-area'], viewports: [...PORTRAIT, ...LANDSCAPE] },
      { scenario: 'student.today', states: ['safe-area'], viewports: [...PORTRAIT, ...LANDSCAPE] },
      { scenario: 'student.session', states: ['safe-area'], viewports: [...PORTRAIT, ...LANDSCAPE] },
      { scenario: 'student.profile', states: ['safe-area'], viewports: [...PORTRAIT, ...LANDSCAPE] },
    ],
    test: (c) => {
      const fs = fnd(c, 'in-safe-area', (f) => f.interactive);
      return { hit: fs.length > 0, detail: { count: fs.length, examples: fs.slice(0, 4).map((f) => ({ el: f.text || f.selector, overlaps: f.overlaps, anchored: f.anchored })) } };
    },
    claims: [(f, c) => f.type === 'in-safe-area' && f.interactive && PORTRAIT.includes(c.viewport)],
  },
  {
    id: 'G8',
    area: 'global',
    severity: 'P2',
    title: 'Overlays fora da pilha do botão voltar do Android e sem trava de rolagem do fundo',
    note: 'O botão físico do Android só existe em aparelho. O app o trata via Capacitor → fecharCamadaAberta() (overlayStack/useDismissable), não popstate; aqui o proxy é o Escape, escutado pelo mesmo hook. Quem NÃO fecha com Escape comprovadamente não está na pilha; quem fecha fica "não se aplica" (pode ter handler próprio).',
    parts: [
      {
        part: 'não fecha com Escape ⇒ fora da pilha do botão voltar',
        cells: [
          { scenario: 'student.profile', states: ['overlay:essential-modal'], viewports: ['390x844'] },
          { scenario: 'student.session', states: ['overlay:exit-dialog', 'overlay:demo-modal', 'overlay:exercises-sheet', 'overlay:substitute-sheet'], viewports: ['390x844'] },
          { scenario: 'personal.review', states: ['overlay:review-modal'], viewports: ['390x844'] },
          { scenario: 'personal.students', states: ['overlay:invite-drawer', 'overlay:register-drawer'], viewports: ['390x844'] },
        ],
        test: (c) => {
          const d = c.dismiss;
          if (!d) return BLK('teste de dismiss não executou');
          if (d.escapeClosesOverlay) return NA('fecha com Escape: o registro na pilha do botão voltar não é observável fora do app nativo');
          return { hit: true, detail: { escapeClosesOverlay: false } };
        },
      },
      {
        part: 'o fundo rola por trás do overlay (sem trava de rolagem)',
        cells: [
          { scenario: 'student.profile', states: ['overlay:essential-modal'], viewports: ['390x844'] },
          { scenario: 'student.session', states: ['overlay:exit-dialog', 'overlay:demo-modal', 'overlay:exercises-sheet', 'overlay:substitute-sheet'], viewports: ['390x844'] },
          { scenario: 'personal.review', states: ['overlay:review-modal'], viewports: ['390x844'] },
          { scenario: 'personal.students', states: ['overlay:invite-drawer', 'overlay:register-drawer'], viewports: ['390x844'] },
        ],
        test: (c) => {
          const d = c.dismiss;
          if (!d) return BLK('teste de dismiss não executou');
          if (!d.pageBehindScrollable) return NA('a página por trás não rola: não há como o fundo rolar');
          return { hit: d.backgroundScrolledUnderOverlay === true, detail: { backgroundScrolledUnderOverlay: d.backgroundScrolledUnderOverlay } };
        },
      },
    ],
  },

  // ═══════════════ Aluno ═══════════════
  {
    id: 'A1',
    area: 'student',
    severity: 'P1',
    title: 'Mapa Leaflet pinta por cima da bottom nav / top bar',
    cells: [{ scenario: 'student.tracker-live', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      const m = custom(c, 'mapUnderChrome');
      if (!m || m.error) return BLK(m?.error ?? 'passo mapUnderChrome não executou');
      if (!m.applicable) return BLK(m.reason ?? 'mapa não apareceu');
      const bad = (z) => !!z?.overlapsZone && (z.items ?? []).some((i) => i.tested && !i.ok && i.byLeaflet);
      const reached = !!m.bottomNav?.overlapsZone || !!m.topBar?.overlapsZone;
      if (!reached) return NA('a página não rola o bastante para o mapa encontrar a bottom nav/top bar neste viewport');
      return { hit: bad(m.bottomNav) || bad(m.topBar), detail: { bottomNavOverlap: !!m.bottomNav?.overlapsZone, bottomNavCoveredByLeaflet: bad(m.bottomNav), topBarOverlap: !!m.topBar?.overlapsZone, topBarCoveredByLeaflet: bad(m.topBar), coveredBy: [...new Set([...(m.bottomNav?.items ?? []), ...(m.topBar?.items ?? [])].filter((i) => i.by).map((i) => i.by))].slice(0, 2) } };
    },
  },
  {
    id: 'A2',
    area: 'student',
    severity: 'P1',
    title: 'Overlay de fim de vídeo preso na caixa 16:9: CTAs cortados',
    cells: [{ scenario: 'student.player-end', states: ['default'], viewports: ALL_VP }],
    test: (c) => {
      const fs = ['clipped-y', 'clipped-x', 'unreachable', 'covered', 'partly-covered'].flatMap((t) => fnd(c, t, (f) => /evolu|sugerid|pr[oó]ximo/i.test(f.text)));
      return { hit: fs.length > 0, detail: { cut: fs.slice(0, 3).map((f) => ({ el: f.text, type: f.type, visibleFraction: f.visibleFraction ?? null, clippedBy: f.clippedBy ?? null })) } };
    },
    claims: [(f) => ['clipped-y', 'clipped-x'].includes(f.type) && /evolu|sugerid|pr[oó]ximo/i.test(f.text)],
  },
  {
    id: 'A3',
    area: 'student',
    severity: 'P1',
    title: 'Modais de resumo/descanso do Lab sem max-height/scroll',
    cells: [{ scenario: 'student.lab', states: ['default'], viewports: ALL_VP }],
    test: (c) => {
      const l = custom(c, 'labSummary');
      return BLK(l?.reason ?? 'sem câmera/MediaPipe');
    },
  },
  {
    id: 'A4',
    area: 'student',
    severity: 'P1',
    note: 'Refutação vale para o diálogo "Sair do treino?" (prescrito e livre). A variante exibida após "Descartar treino" NÃO tem cenário: essa metade está NÃO TESTADA.',
    title: 'Diálogos de saída/descarte do treino sem max-height/scroll',
    cells: [
      { scenario: 'student.session', states: ['overlay:exit-dialog'], viewports: ['320x568', '360x740', '375x667', ...LANDSCAPE] },
      { scenario: 'student.free-session', states: ['overlay:exit-dialog'], viewports: ['320x568', '360x740', '375x667', ...LANDSCAPE] },
    ],
    controls: [{ scenario: 'student.session', states: ['overlay:exit-dialog'], viewports: ['390x844'] }],
    test: (c) => {
      const fs = ['modal-out-of-viewport', 'modal-unreachable-content'].flatMap((t) => fnd(c, t)).concat(fnd(c, 'unreachable').concat(fnd(c, 'covered')));
      const o = c.report.overlays[0];
      const cut = !!o && (o.topCut || o.bottomCut) && !o.internalScroll;
      return { hit: fs.length > 0 || cut, detail: { panelHeight: o?.rect?.h ?? null, viewportHeight: c.report.viewport.h, internalScroll: o?.internalScroll ?? null, findings: [...new Set(fs.map((f) => f.type))] } };
    },
    claims: [(f) => ['modal-out-of-viewport', 'modal-unreachable-content'].includes(f.type)],
  },
  {
    id: 'A5',
    area: 'student',
    severity: 'P1',
    title: 'Modo treino em paisagem: header + barra de ação deixam ~125px para o conteúdo',
    cells: [{ scenario: 'student.session', states: ['default'], viewports: LANDSCAPE }],
    controls: [{ scenario: 'student.session', states: ['default'], viewports: ['390x844'] }],
    test: (c) => {
      const t = c.report.chrome.wsTop;
      const a = c.report.chrome.wsActionBar;
      if (!t || !a) return BLK('header/barra de ação do modo treino não encontrados');
      const content = Math.round((a.rect.t - t.rect.b) * 10) / 10;
      return { hit: content / c.report.viewport.h < 0.4, detail: { contentHeightPx: content, headerHeight: t.rect.h, actionBarHeight: a.rect.h, viewportHeight: c.report.viewport.h, contentFraction: Math.round((content / c.report.viewport.h) * 100) / 100 } };
    },
  },
  {
    id: 'A6',
    area: 'student',
    severity: 'P2',
    title: 'Resumo do treino: linha de esforço (RPE) estoura em 320–360px',
    cells: [{ scenario: 'student.session', states: ['overlay:summary'], viewports: ['320x568', '360x740', '375x667'] }],
    test: (c) => {
      const hs = fnd(c, 'h-scroller', (f) => f.hiddenChildren >= 1 || /ws-body|ws-summary/.test(f.selector));
      const cl = fnd(c, 'clipped-x').concat(fnd(c, 'overflow-x')).filter((f) => /Leve|Moderado|Intenso|M[aá]ximo/.test(f.text));
      return { hit: hs.length > 0 || cl.length > 0, detail: { scrollers: hs.slice(0, 2).map((f) => ({ sel: f.selector, scrollWidth: f.scrollWidth, clientWidth: f.clientWidth })), clipped: cl.slice(0, 3).map((f) => f.text) } };
    },
    claims: [(f, c) => f.type === 'h-scroller' && c.state === 'overlay:summary'],
  },
  {
    id: 'A7',
    area: 'student',
    severity: 'P2',
    note: 'Medido sem teclado. O teclado virtual real (iOS ignora interactive-widget; --kb-inset do app) só se valida em aparelho.',
    title: 'Chat do aluno: o compositor deriva para o fim do documento',
    cells: [{ scenario: 'student.messages-thread', states: ['default'], viewports: [...PORTRAIT, ...LANDSCAPE] }],
    test: (c) => {
      const k = custom(c, 'composer');
      if (!k || k.error) return BLK(k?.error ?? 'passo composer não executou');
      if (!k.applicable) return BLK(k.reason);
      return { hit: !k.fullyVisible && k.docScrolls, detail: k };
    },
  },
  {
    id: 'A8',
    area: 'student',
    severity: 'P2',
    title: 'Histórico: pill "Registrado retroativamente" estoura a coluna',
    cells: [{ scenario: 'student.evolucao-history', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      const h = custom(c, 'historyPill');
      if (!h || h.error) return BLK(h?.error ?? 'passo historyPill não executou');
      if (!h.applicable) return BLK(h.reason);
      return { hit: !!h.clipped || h.beyondViewport, detail: h };
    },
    claims: [(f, c) => c.scenario === 'student.evolucao-history' && ['clipped-x', 'overflow-x', 'unreachable', 'covered', 'partly-covered', 'wide-in-scroller', 'text-clipped'].includes(f.type)],
  },
  {
    id: 'A9',
    area: 'student',
    severity: 'P2',
    title: 'Mapa ao vivo prende o gesto de rolagem',
    cells: [{ scenario: 'student.tracker-live', states: ['default'], viewports: ALL_VP }],
    test: (c) => {
      const m = custom(c, 'mapSwipe');
      if (!m || m.error) return BLK(m?.error ?? 'passo mapSwipe não executou');
      if (!m.applicable) return NA(m.reason);
      return { hit: m.startedOnMap.pageScrolled === false && m.startedOffMap.pageScrolled === true, detail: { mapHeightFraction: m.mapHeightFraction, startedOnMap: m.startedOnMap, startedOffMap: m.startedOffMap } };
    },
  },
  {
    id: 'A10',
    area: 'student',
    severity: 'P2',
    deviceOnly: 'Mesma limitação do G7: o override de safe-area modela o iOS; no Android WebView o inset lateral é tratado fora do CSS.',
    title: 'Paisagem sem safe-area lateral: conteúdo sob o notch',
    // student.today em paisagem NÃO entra: a sidebar empilhada (G1) ocupa a largura toda e "invade" os insets por construção
    cells: [{ scenario: 'student.session', states: ['safe-area'], viewports: LANDSCAPE }],
    test: (c) => {
      const fs = fnd(c, 'in-safe-area', (f) => f.overlaps.some((o) => /^(esq|dir)/.test(o)));
      return { hit: fs.length > 0, detail: { count: fs.length, examples: fs.slice(0, 4).map((f) => ({ el: f.text || f.selector, overlaps: f.overlaps })) } };
    },
    claims: [(f, c) => f.type === 'in-safe-area' && LANDSCAPE.includes(c.viewport)],
  },
  {
    id: 'A11',
    area: 'student',
    severity: 'P2',
    title: 'ExerciseDemoModal sem max-height e com botão Fechar de 32px',
    cells: [{ scenario: 'student.session', states: ['overlay:demo-modal'], viewports: ALL_VP }],
    note: 'Só o ExerciseDemoModal foi executado; o ExerciseGifModal (Meus treinos) não tem cenário.',
    test: (c) => {
      const close = fnd(c, 'small-target', (f) => /fechar|×|✕/i.test(f.text));
      const o = c.report.overlays[0];
      const cut = !!o && (o.topCut || o.bottomCut || o.heightExceedsViewport) && !o.internalScroll;
      const big = fnd(c, 'modal-out-of-viewport').concat(fnd(c, 'modal-unreachable-content'));
      return { hit: close.length > 0 || cut || big.length > 0, detail: { closeButton: close[0] ? `${close[0].w}x${close[0].h}` : null, panelRect: o ? [o.rect.t, o.rect.b] : null, viewportHeight: c.report.viewport.h, panelCutNoInternalScroll: cut, noInternalScroll: o ? !o.internalScroll : null } };
    },
    claims: [(f) => f.type === 'small-target' && /fechar|×|✕/i.test(f.text), (f) => ['modal-out-of-viewport', 'modal-unreachable-content'].includes(f.type)],
  },
  {
    id: 'A12',
    area: 'student',
    severity: 'P2',
    title: 'Header do treino em 320px engorda; canvas do Lab corta laterais',
    parts: [
      {
        part: 'header do treino em 320px',
        cells: [{ scenario: 'student.session', states: ['default'], viewports: ['320x568', '360x740'] }],
        controls: [{ scenario: 'student.session', states: ['default'], viewports: ['390x844'] }],
        test: (c) => {
          const t = c.report.chrome.wsTop;
          if (!t) return BLK('.ws-top não encontrado');
          return { hit: t.rect.h > 84, detail: { headerHeight: t.rect.h, controlHeight: 79, viewportWidth: c.report.viewport.w } };
        },
      },
      {
        part: 'canvas do Lab',
        cells: [{ scenario: 'student.lab', states: ['default'], viewports: ALL_VP }],
        test: () => BLK('câmera indisponível: o canvas só renderiza com o stream'),
      },
    ],
  },

  // ═══════════════ Personal ═══════════════
  {
    id: 'P1',
    area: 'personal',
    severity: 'P1',
    title: 'Builder: reordenar exercício é impossível no toque',
    cells: [{ scenario: 'personal.builder', states: ['default'], viewports: ['390x844', '320x568', '844x390'] }],
    test: (c) => {
      const r = custom(c, 'reorder');
      if (!r || r.error) return BLK(r?.error ?? 'passo reorder não executou');
      if (!r.applicable) return BLK(r.reason);
      return { hit: r.touchReordered === false && r.alternativeControls === 0, detail: { touchReordered: r.touchReordered, mouseReordered: r.mouseReordered, alternativeControls: r.alternativeControls, gripSize: r.gripSize } };
    },
  },
  {
    id: 'P2',
    area: 'personal',
    severity: 'P1',
    note: 'O estado "keyboard" é SIMULADO (viewport reduzida ≈ Android resizes-content); não exercita iOS nem o --kb-inset do app. Confirmar no WebView.',
    title: 'Mensagens: o fim do compositor é cortado (altura fixa + overflow hidden)',
    cells: [{ scenario: 'personal.messages', states: ['default', 'keyboard'], viewports: [...PORTRAIT, ...LANDSCAPE] }],
    test: (c) => {
      const k = custom(c, 'composer');
      if (!k || k.error) return BLK(k?.error ?? 'passo composer não executou');
      if (!k.applicable) return BLK(k.reason);
      const cut = ['clipped-y', 'clipped-x', 'unreachable', 'covered', 'partly-covered'].flatMap((t) => fnd(c, t)).filter((f) => /enviar|whatsapp|denunciar/i.test(f.text) || /\bmp-/.test(f.selector));
      return { hit: !k.fullyVisible || cut.length > 0, detail: { ...k, cutControls: cut.slice(0, 3).map((f) => ({ text: f.text, type: f.type })) } };
    },
    claims: [(f, c) => c.scenario === 'personal.messages' && ['clipped-y', 'clipped-x', 'unreachable', 'covered', 'partly-covered'].includes(f.type) && (/enviar|whatsapp|denunciar/i.test(f.text) || /\bmp-/.test(f.selector))],
  },
  {
    id: 'P3',
    area: 'personal',
    severity: 'P1',
    title: 'Revisão: sem fechar no cabeçalho e ações em rodapé não-sticky',
    cells: [{ scenario: 'personal.review', states: ['overlay:review-modal'], viewports: ['320x568', '375x667', '390x844', ...LANDSCAPE] }],
    test: (c) => {
      const r = custom(c, 'reviewFooter');
      if (!r || r.error) return BLK(r?.error ?? 'passo reviewFooter não executou');
      if (!r.applicable) return BLK(r.reason);
      return { hit: !r.actionsVisibleWithoutScroll && !r.headerCloseButton, detail: r };
    },
  },
  {
    id: 'P4',
    area: 'personal',
    severity: 'P1',
    title: '.pxf-panel (criar exercício) com max-height em vh',
    cells: [{ scenario: 'personal.exercises', states: ['overlay:create-exercise'], viewports: PORTRAIT }],
    deviceOnly: 'Mesmo caso do G6: comprova-se a regra CSS (vh), não o corte do topo, que depende da barra de endereço dinâmica.',
    test: (c) => {
      const fs = fnd(c, 'vh-unit-sheet');
      return { hit: fs.length > 0, detail: { rules: [...new Set(fs.flatMap((f) => f.rules.map((r) => `${r.selector} { ${r.prop}: ${r.value} }`)))].slice(0, 3) } };
    },
    claims: [(f) => f.type === 'vh-unit-sheet'],
  },
  {
    id: 'P5',
    area: 'personal',
    severity: 'P2',
    title: 'Cockpit inline vira caixa de 92dvh com rolagem aninhada',
    cells: [{ scenario: 'personal.cockpit', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      const fs = fnd(c, 'nested-scroll', (f) => /pp-drawer/.test(f.selector) || /pp-drawer/.test(f.parentScroller ?? ''));
      return { hit: fs.length > 0, detail: fs[0] ? { scroller: fs[0].selector, clientHeight: fs[0].clientHeight, scrollHeight: fs[0].scrollHeight, parent: fs[0].parentScroller } : {} };
    },
    claims: [(f) => f.type === 'nested-scroll' && /pp-drawer/.test(f.selector)],
  },
  {
    id: 'P6',
    area: 'personal',
    severity: 'P2',
    note: 'Sem fade/mask/gradiente: a única pista é o último chip cortado na borda. Se o chip espiando valer como pista suficiente, o achado se refuta; aqui conta como ausência de affordance explícito.',
    title: 'Abas de Programas sem pista de rolagem: "Meus Exercícios" fica cortado',
    cells: [{ scenario: 'personal.library', states: ['default'], viewports: ['320x568', '360x740', '375x667', '390x844'] }],
    test: (c) => {
      const fs = fnd(c, 'h-scroller', (f) => /Protocolos|Desafios/.test(f.text));
      const f = fs[0];
      if (!f) return { hit: false, detail: { note: 'a barra de abas não rola neste viewport (cabe inteira)' } };
      // sem fade/mask/gradiente explícito: a única pista é o último chip cortado na borda ("Meus Exer")
      return { hit: f.cueKind !== 'mask/gradiente', detail: { cueKind: f.cueKind, hiddenChildren: f.hiddenChildren, scrollWidth: f.scrollWidth, clientWidth: f.clientWidth } };
    },
    claims: [(f) => f.type === 'h-scroller' && /Protocolos|Desafios/.test(f.text)],
  },
  {
    id: 'P7',
    area: 'personal',
    severity: 'P2',
    title: 'Timeline: o resumo (observações) fica escondido (cortado em 1 linha ou estourando a linha)',
    cells: [{ scenario: 'personal.cockpit-relationship', states: ['default'], viewports: PORTRAIT }],
    test: (c) => {
      const t = custom(c, 'timeline');
      if (!t || t.error) return BLK(t?.error ?? 'passo timeline não executou');
      if (!t.applicable) return BLK(t.reason);
      if (t.maxTextLen < 60) return BLK('resumos curtos demais para truncar: o resultado seria artefato do dado de teste');
      const wide = fnd(c, 'wide-in-scroller', (f) => /pp-timeline-summary/.test(f.selector));
      return { hit: t.truncated > 0 || wide.length > 0, detail: { items: t.items, truncated: t.truncated, wideInScroller: wide.length, maxTextLen: t.maxTextLen, widestPx: t.widestPx, viewportWidth: t.viewportWidth, sample: t.sample } };
    },
    claims: [(f) => ['text-truncated', 'wide-in-scroller'].includes(f.type) && /pp-timeline-summary/.test(f.selector)],
  },
  {
    id: 'P8',
    area: 'personal',
    severity: 'P2',
    title: 'Lista de alunos: 4 ações quebram em linhas; e-mail longo de convite é cortado',
    parts: [
      {
        part: 'ações por aluno quebram em 2+ linhas',
        cells: [{ scenario: 'personal.students', states: ['default'], viewports: PORTRAIT }],
        test: (c) => {
          const r = custom(c, 'rowActions');
          if (!r || r.error) return BLK(r?.error ?? 'passo rowActions não executou');
          if (!r.applicable) return BLK(r.reason);
          return { hit: r.distinctRows >= 2, detail: { distinctRows: r.distinctRows, actions: r.actions } };
        },
      },
      {
        part: 'e-mail longo do convite pendente',
        cells: [{ scenario: 'personal.students-invites', states: ['default'], viewports: PORTRAIT }],
        test: (c) => {
          const r = custom(c, 'inviteEmail');
          if (!r || r.error) return BLK(r?.error ?? 'passo inviteEmail não executou');
          if (!r.applicable) return BLK(r.reason);
          return { hit: !!r.clipped || r.beyondViewport || r.truncatedByEllipsis, detail: r };
        },
      },
    ],
  },
  {
    id: 'P9',
    area: 'personal',
    severity: 'P2',
    title: 'Inputs com fonte < 16px (zoom no foco do iOS)',
    cells: [
      { scenario: 'personal.builder', states: ['default'], viewports: PORTRAIT },
      { scenario: 'personal.messages', states: ['default'], viewports: PORTRAIT },
      { scenario: 'personal.review', states: ['overlay:review-modal'], viewports: PORTRAIT },
    ],
    deviceOnly: 'O zoom automático só acontece no iOS (Safari/WKWebView). Aqui se comprova o tamanho de fonte computado (< 16px), não o zoom.',
    test: (c) => {
      const fs = fnd(c, 'ios-zoom-font');
      return { hit: fs.length > 0, detail: { count: fs.length, sizes: [...new Set(fs.map((f) => f.fontSizePx))], examples: fs.slice(0, 3).map((f) => f.selector) } };
    },
    claims: [(f) => f.type === 'ios-zoom-font'],
  },

  // ═══════════════ Nutri ═══════════════
  {
    id: 'N1',
    area: 'nutri',
    severity: 'P2',
    title: 'Menu do Nutri não fecha ao navegar; "Sair da conta" sem confirmação',
    parts: [
      {
        part: 'menu continua aberto depois de navegar',
        cells: [{ scenario: 'nutri.home', states: ['default'], viewports: ['320x568', '375x667', '390x844'] }],
        test: (c) => {
          const m = custom(c, 'menu');
          if (!m || m.error) return BLK(m?.error ?? 'passo menu não executou');
          if (!m.applicable) return BLK(m.reason);
          return { hit: m.menuStillOpenAfterNavigate === true, detail: { navigatedTo: m.navigatedTo, menuStillOpenAfterNavigate: m.menuStillOpenAfterNavigate } };
        },
      },
      {
        part: '"Sair da conta" desloga sem confirmação',
        cells: [{ scenario: 'nutri.home', states: ['default'], viewports: ['320x568', '375x667', '390x844'] }],
        test: (c) => {
          const m = custom(c, 'menu');
          if (!m || m.error) return BLK(m?.error ?? 'passo menu não executou');
          if (!m.applicable) return BLK(m.reason);
          return { hit: m.logoutWithoutConfirmation === true, detail: { logoutRequested: m.logoutRequested, urlAfterLogoutClick: m.urlAfterLogoutClick, tokenRemoved: m.tokenRemoved, dialogsAfterLogoutClick: m.dialogsAfterLogoutClick } };
        },
      },
    ],
  },
];

// ───────────────────────── avaliação ─────────────────────────

function select(results, spec) {
  return results.filter((r) => r.scenario === spec.scenario && (!spec.states || spec.states.includes(r.state)) && (!spec.viewports || spec.viewports.includes(r.viewport)));
}

function evalPart(def, results) {
  const wanted = def.cells.flatMap((s) => select(results, s));
  const out = { expected: wanted.length, executed: 0, blocked: 0, notApplicable: 0, hits: [], clear: [], blockedReasons: new Set() };
  for (const c of wanted) {
    if (c.status !== 'ok') {
      out.blocked++;
      out.blockedReasons.add(c.reason ?? c.status);
      continue;
    }
    // Medir a página errada (redirecionada) ou o fundo atrás de um modal que ninguém pediu NÃO é evidência.
    if (c.routeMismatch) {
      out.blocked++;
      out.blockedReasons.add(`rota redirecionada para ${c.finalPath}`);
      continue;
    }
    if (c.unexpectedOverlay?.length) {
      out.blocked++;
      out.blockedReasons.add(`modal inesperado por cima da página (${c.unexpectedOverlay[0]})`);
      continue;
    }
    let t;
    try {
      t = def.test(c);
    } catch (err) {
      t = BLK(`erro no teste: ${err.message}`);
    }
    if (t.blocked) {
      out.blocked++;
      out.blockedReasons.add(t.reason);
    } else if (t.na) {
      out.notApplicable++;
    } else {
      out.executed++;
      (t.hit ? out.hits : out.clear).push({ cell: c.cell, viewport: c.viewport, state: c.state, scenario: c.scenario, detail: t.detail ?? null, screenshot: c.screenshot ?? null, evidence: c.evidence ?? null });
    }
  }
  const controls = (def.controls ?? []).flatMap((s) => select(results, s)).filter((c) => c.status === 'ok');
  out.controlHits = controls.filter((c) => {
    try {
      const t = def.test(c);
      return t.hit === true;
    } catch {
      return false;
    }
  }).map((c) => c.cell);
  out.controlsRun = controls.length;
  return out;
}

function statusOf(p) {
  if (p.expected === 0) return 'NÃO TESTADO';
  if (p.executed === 0) return p.blocked > 0 ? 'BLOQUEADO' : p.notApplicable > 0 ? 'NÃO TESTADO' : 'NÃO TESTADO';
  if (p.hits.length === 0) return p.blocked > 0 ? 'BLOQUEADO' : 'REFUTADO';
  if (p.hits.length === p.executed && p.blocked === 0) return 'CONFIRMADO';
  return 'PARCIAL';
}

export function evaluate(def, results, meta = {}) {
  const parts = def.parts ?? [{ ...def, part: null }];
  const evals = parts.map((p) => ({ part: p.part, def: p, ev: evalPart(p, results) }));
  let status;
  if (evals.length === 1) {
    status = statusOf(evals[0].ev);
  } else {
    const st = evals.map((e) => statusOf(e.ev));
    if (st.every((s) => s === 'CONFIRMADO')) status = 'CONFIRMADO';
    else if (st.some((s) => s === 'CONFIRMADO' || s === 'PARCIAL')) status = 'PARCIAL';
    else if (st.some((s) => s === 'BLOQUEADO')) status = 'BLOQUEADO';
    else if (st.every((s) => s === 'REFUTADO')) status = 'REFUTADO';
    else status = 'NÃO TESTADO';
  }
  let limitation = def.note ?? null;
  const controlAlsoHit = evals.flatMap((e) => e.ev.controlHits);
  if (controlAlsoHit.length && status === 'CONFIRMADO') {
    status = 'PARCIAL';
    limitation = `${limitation ? limitation + ' ' : ''}O CONTROLE (${controlAlsoHit[0]}) também acusou: o teste não discrimina viewport, então o defeito é mais amplo ou o limiar é frouxo.`;
  }
  if (def.id === 'P1' && meta?.touchDragControl !== true && status === 'CONFIRMADO') {
    status = 'PARCIAL';
    limitation = `${limitation ? limitation + ' ' : ''}O controle positivo (um draggable correto arrastado por toque CDP) NÃO disparou dragstart neste emulador: o resultado "toque não reordena" pode ser artefato. Confirmar em aparelho.`;
  }
  if (def.deviceOnly) {
    limitation = def.deviceOnly;
    if (status === 'CONFIRMADO') status = 'PARCIAL';
  }
  const hits = evals.flatMap((e) => e.ev.hits.map((h) => ({ ...h, part: e.part })));
  const all = evals.flatMap((e) => [...e.ev.hits, ...e.ev.clear]);
  return {
    id: def.id,
    area: def.area,
    severity: def.severity,
    title: def.title,
    status,
    parts: evals.length > 1 ? evals.map((e) => ({ part: e.part, status: statusOf(e.ev), expected: e.ev.expected, executed: e.ev.executed, blocked: e.ev.blocked, notApplicable: e.ev.notApplicable, hits: e.ev.hits.length, blockedReasons: [...e.ev.blockedReasons] })) : undefined,
    expectedCells: evals.reduce((a, e) => a + e.ev.expected, 0),
    executedCells: evals.reduce((a, e) => a + e.ev.executed, 0),
    blockedCells: evals.reduce((a, e) => a + e.ev.blocked, 0),
    notApplicableCells: evals.reduce((a, e) => a + e.ev.notApplicable, 0),
    hitCells: hits.length,
    viewportsAffected: [...new Set(hits.map((h) => h.viewport))],
    viewportsClear: [...new Set(evals.flatMap((e) => e.ev.clear).map((h) => h.viewport))].filter((v) => !hits.some((h) => h.viewport === v)),
    blockedReasons: [...new Set(evals.flatMap((e) => [...e.ev.blockedReasons]))],
    controls: evals.some((e) => e.ev.controlsRun) ? { ran: evals.reduce((a, e) => a + e.ev.controlsRun, 0), alsoHit: evals.flatMap((e) => e.ev.controlHits) } : undefined,
    limitation,
    evidence: hits.slice(0, 6).map((h) => ({ cell: h.cell, part: h.part ?? undefined, detail: h.detail, screenshot: h.screenshot, evidenceFiles: h.evidence })),
    clearExample: status === 'REFUTADO' ? all.slice(0, 2).map((h) => ({ cell: h.cell, detail: h.detail })) : undefined,
    notReproducedIn: evals.flatMap((e) => e.ev.clear).slice(0, 14).map((h) => h.cell),
    allCells: all.length,
  };
}

// ───────────────────────── descobertas novas ─────────────────────────

const NEW_TYPES = new Set(['wide-in-scroller', 'clipped-x', 'overflow-x', 'offscreen-in-flow', 'clipped-y', 'covered', 'partly-covered', 'unreachable', 'modal-out-of-viewport', 'modal-unreachable-content', 'content-under-chrome', 'small-target', 'nested-scroll', 'translucent-fixed-bar', 'text-clipped', 'h-scroller', 'in-safe-area', 'double-scroll']);

const normSel = (s) => String(s ?? '').replace(/\d+/g, '#').split(' > ').slice(-2).join(' > ');

export function findNew(results) {
  const claimed = DEFS.flatMap((d) => d.claims ?? []);
  const groups = new Map();
  for (const c of results) {
    if (c.status !== 'ok') continue;
    const unexpected = !!c.unexpectedOverlay;
    for (const f of c.report.findings) {
      if (f.severity === 'P3' || !NEW_TYPES.has(f.type)) continue;
      if (unexpected && ['covered', 'partly-covered', 'unreachable'].includes(f.type)) continue; // fundo atrás de um modal inesperado
      if (claimed.some((fn) => fn(f, c))) continue;
      if (/leaflet-(marker|pane|tile)/.test(f.selector)) continue; // internos do mapa, fora do quadro de propósito
      if (f.type === 'small-target' && f.kind !== 'primary' && Math.min(f.w, f.h) >= 24) continue;
      const key = `${f.type}|${normSel(f.selector)}`;
      const g = groups.get(key) ?? { type: f.type, severity: f.severity, selector: normSel(f.selector), sample: f.selector, text: f.text ?? null, scenarios: new Set(), viewports: new Set(), states: new Set(), cells: [], detail: {} };
      g.scenarios.add(c.scenario);
      g.viewports.add(c.viewport);
      g.states.add(c.state);
      if (g.cells.length < 4) g.cells.push({ cell: c.cell, screenshot: c.screenshot ?? null, evidence: c.evidence ?? null });
      if (f.type === 'small-target') {
        g.detail = { w: f.w, h: f.h, kind: f.kind };
        (g.texts ??= new Set()).add(f.text);
      }
      else if (f.coveredBy) g.detail = { coveredBy: f.coveredBy.chrome ?? f.coveredBy.selector };
      else if (f.hiddenPx) g.detail = { hiddenPx: f.hiddenPx };
      else if (f.type === 'translucent-fixed-bar') g.detail = { backgroundAlpha: f.backgroundAlpha, bar: f.bar };
      groups.set(key, g);
    }
  }
  const sevRank = { P1: 0, P2: 1 };
  const list = [...groups.values()]
    .map((g) => ({ ...g, texts: g.texts ? [...g.texts].slice(0, 6) : undefined, scenarios: [...g.scenarios], viewports: [...g.viewports], states: [...g.states], occurrences: g.cells.length }))
    .sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || b.viewports.length - a.viewports.length || b.scenarios.length - a.scenarios.length);
  return list.map((g, i) => ({ id: `NEW-${String(i + 1).padStart(3, '0')}`, ...g }));
}

// ───────────────────────── cobertura ─────────────────────────

export function coverage(results) {
  const rows = new Map();
  for (const c of results) {
    const key = `${c.role}|${c.viewport}|${c.state.startsWith('overlay:') ? 'overlay' : c.state}`;
    const r = rows.get(key) ?? { role: c.role, viewport: c.viewport, state: c.state.startsWith('overlay:') ? 'overlay' : c.state, ok: 0, blocked: 0, error: 0, p1: 0, p2: 0 };
    if (c.status === 'ok') {
      r.ok++;
      r.p1 += c.report.findings.filter((f) => f.severity === 'P1').length;
      r.p2 += c.report.findings.filter((f) => f.severity === 'P2').length;
    } else if (c.status === 'blocked') r.blocked++;
    else r.error++;
    rows.set(key, r);
  }
  return [...rows.values()];
}

export function classify(results, meta = {}) {
  const issues = DEFS.map((d) => evaluate(d, results, meta));
  return { issues, newFindings: findNew(results), coverage: coverage(results) };
}

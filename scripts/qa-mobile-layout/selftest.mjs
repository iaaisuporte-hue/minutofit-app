/**
 * Prova que os detectores funcionam ANTES de confiar no baseline.
 *
 * Um runner que devolve "zero problemas" não está aprovado — pode estar cego.
 * Cada caso abaixo é uma página sintética com defeito conhecido (o detector
 * TEM que acusar) ou um controle negativo legítimo (TEM que ficar quieto).
 * Cada página roda duas vezes e os achados são comparados (determinismo).
 *
 * Uso:  node scripts/qa-mobile-layout/selftest.mjs
 * Saída: 0 = tudo certo · 3 = algum detector falhou · 2 = infraestrutura
 */
import { collectLayoutReport } from './detectors.mjs';
import { findChrome, InfraError, loadPlaywright, newMobileContext } from './common.mjs';

const BASE_CSS = '*{box-sizing:border-box}html,body{margin:0}body{font:16px/1.4 sans-serif}';
const page = (body, css = '') => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_CSS}${css}</style><body>${body}</body>`;

const has = (r, type, pred = () => true) => r.findings.some((f) => f.type === type && pred(f));
const none = (r, type, pred = () => true) => !has(r, type, pred);

/** @type {Array<{name:string, vp:[number,number], html:string, opts?:object, insets?:object, check:(r:any)=>Array<[boolean,string]>}>} */
const CASES = [
  {
    name: 'overflow horizontal com body{overflow-x:hidden}: o usuário não alcança (masked) mas scrollWidth ainda vê',
    vp: [390, 844],
    html: page('<div style="width:600px;height:40px">Texto largo demais para a tela</div>', 'body{overflow-x:hidden}'),
    check: (r) => [
      [has(r, 'overflow-x', (f) => f.masked === true), 'acusa overflow-x com masked=true (conteúdo inalcançável)'],
      [has(r, 'overflow-x', (f) => f.scrollWidthSees === true), 'com overflow:hidden a métrica antiga (scrollWidth) AINDA enxerga'],
    ],
  },
  {
    name: 'overflow com .shell{overflow-x:clip} (o que o app usa): scrollWidth fica CEGO, o detector não',
    vp: [390, 844],
    html: page('<div class="appShell" style="overflow-x:clip"><button style="width:600px;height:48px">Concluir treino</button></div>'),
    check: (r) => [
      [r.doc.scrollsX === false, 'document.scrollWidth NÃO enxerga o corte por overflow:clip (métrica antiga cega)'],
      [has(r, 'clipped-x', (f) => f.interactive && /appShell/.test(f.clippedBy)), 'o detector acusa clipped-x e aponta .appShell'],
    ],
  },
  {
    name: 'a fábrica de contexto NÃO infla a viewport quando o conteúdo estoura (isMobile:true inflaria)',
    vp: [390, 844],
    html: page('<div style="width:600px;height:40px">Texto largo</div><div class="bar" style="position:fixed;bottom:0;left:0;right:0;height:50px">barra</div>', 'body{overflow-x:hidden}'),
    check: (r) => [
      [r.viewport.w === 390 && r.viewport.h === 844, 'innerWidth/innerHeight continuam 390x844'],
      [r.notes.length === 0, 'sem nota de viewport inflada'],
    ],
  },
  {
    name: 'ação cortada por ancestral overflow:hidden',
    vp: [390, 844],
    html: page('<div style="overflow:hidden;width:200px"><button style="width:300px;height:48px">Concluir</button></div>'),
    check: (r) => [[has(r, 'clipped-x', (f) => f.interactive && f.severity === 'P1'), 'acusa clipped-x P1 no botão']],
  },
  {
    name: 'carrossel overflow-x:auto com itens além da tela é LEGÍTIMO',
    vp: [390, 844],
    html: page(
      '<div style="display:flex;overflow-x:auto;gap:8px"><a href="#" style="flex:none;width:150px;height:48px">Um</a><a href="#" style="flex:none;width:150px;height:48px">Dois</a><a href="#" style="flex:none;width:150px;height:48px">Três</a><a href="#" style="flex:none;width:150px;height:48px">Quatro</a></div>',
    ),
    check: (r) => [
      [none(r, 'overflow-x') && none(r, 'clipped-x') && none(r, 'offscreen-in-flow'), 'não acusa overflow nos itens do carrossel'],
      [has(r, 'h-scroller', (f) => f.hasVisualCue === true), 'registra o scroller; item parcialmente visível conta como pista (cue)'],
    ],
  },
  {
    name: 'scroller horizontal SEM pista visual esconde itens',
    vp: [390, 844],
    html: page(
      '<div style="display:flex;overflow-x:auto;gap:0"><a href="#" style="flex:none;width:130px;height:48px">Um</a><a href="#" style="flex:none;width:130px;height:48px">Dois</a><a href="#" style="flex:none;width:130px;height:48px">Três</a><a href="#" style="flex:none;width:130px;height:48px">Quatro</a></div>',
    ),
    check: (r) => [[has(r, 'h-scroller', (f) => f.hasVisualCue === false && f.hiddenChildren >= 1 && f.severity === 'P2'), 'acusa h-scroller sem cue com filho escondido']],
  },
  {
    name: 'gaveta fechada (translateX fora da tela), display:none, visibility:hidden e opacity:0 NÃO geram falso positivo',
    vp: [390, 844],
    html: page(
      '<div style="position:fixed;top:0;right:0;width:300px;height:100%;transform:translateX(100%)"><button style="width:200px;height:48px">Dentro da gaveta</button></div>' +
        '<button style="display:none;width:20px;height:20px">oculto A</button>' +
        '<button style="visibility:hidden;width:20px;height:20px">oculto B</button>' +
        '<button style="opacity:0;width:20px;height:20px">oculto C</button>' +
        '<details><summary style="min-height:44px">Acordeão</summary><button style="width:20px;height:20px">dentro do acordeão fechado</button></details>',
    ),
    check: (r) => [
      [none(r, 'unreachable') && none(r, 'overflow-x') && none(r, 'offscreen-in-flow'), 'gaveta fechada não é defeito'],
      [none(r, 'small-target', (f) => /oculto|acordeão fechado/.test(f.text)), 'elementos ocultos não entram na conta de alvo pequeno'],
    ],
  },
  {
    name: 'botão COBERTO por camada fixa',
    vp: [390, 844],
    html: page(
      '<div style="height:600px"></div><button style="display:block;margin:0 auto;width:200px;height:48px">Salvar</button><div class="cookie" style="position:fixed;left:0;right:0;bottom:0;height:300px;z-index:50;background:#fff;pointer-events:auto"></div>',
    ),
    check: (r) => [[has(r, 'covered', (f) => f.coveredBy && /cookie/.test(f.coveredBy.selector)), 'acusa covered e identifica quem cobre']],
  },
  {
    name: 'camada com pointer-events:none NÃO intercepta toque',
    vp: [390, 844],
    html: page('<button style="display:block;margin:200px auto;width:200px;height:48px">Salvar</button><div style="position:fixed;inset:0;z-index:50;pointer-events:none"></div>'),
    check: (r) => [[none(r, 'covered') && none(r, 'partly-covered'), 'não acusa cobertura']],
  },
  {
    name: 'alvo de toque: 30px acusa, 44px não, link inline em texto não',
    vp: [390, 844],
    html: page(
      '<button style="width:30px;height:30px">OK</button><button style="width:44px;height:44px">Ok</button><p>Leia os <a href="#">termos de uso</a> antes de continuar para a próxima etapa do cadastro.</p>',
    ),
    check: (r) => [
      [has(r, 'small-target', (f) => f.w === 30 && f.h === 30), 'acusa o botão de 30px'],
      [none(r, 'small-target', (f) => f.w >= 44 && f.h >= 44), 'não acusa o de 44px'],
      [none(r, 'small-target', (f) => /termos/.test(f.text)), 'link inline dentro de texto corrido é exceção'],
    ],
  },
  {
    name: 'modal MAIOR que a viewport SEM rolagem interna',
    vp: [390, 600],
    html: page(
      '<div style="position:fixed;inset:0;background:#0006;z-index:100;display:flex;align-items:flex-end"><div role="dialog" style="background:#fff;width:100%;height:1200px;padding:16px"><button style="height:48px;width:100%">Continuar treino</button><h2>Sair do treino?</h2><div style="height:1000px"></div><button style="height:48px;width:100%">Descartar treino</button></div></div>',
    ),
    opts: { expectOverlay: true },
    check: (r) => [
      [has(r, 'modal-unreachable-content') || has(r, 'unreachable'), 'acusa conteúdo inalcançável'],
      [has(r, 'modal-out-of-viewport', (f) => f.severity === 'P1'), 'acusa modal fora da viewport (P1: sem rolagem interna)'],
    ],
  },
  {
    name: 'modal com max-height e rolagem interna é CORRETO',
    vp: [390, 600],
    html: page(
      '<div style="position:fixed;inset:0;background:#0006;z-index:100;display:flex;align-items:flex-end"><div role="dialog" style="background:#fff;width:100%;max-height:90dvh;overflow-y:auto;padding:16px"><h2>Escolha</h2><div style="height:1000px"></div><button style="height:48px;width:100%">Confirmar</button></div></div>',
    ),
    opts: { expectOverlay: true },
    check: (r) => [
      [none(r, 'modal-unreachable-content') && none(r, 'unreachable') && none(r, 'covered'), 'não acusa nada'],
      [r.overlays.length === 1 && r.overlays[0].internalScroll === true, 'reconhece a rolagem interna'],
    ],
  },
  {
    name: 'sheet com max-height em vh (sem dvh) é sinalizado',
    vp: [390, 700],
    html: page('<div style="position:fixed;inset:0;z-index:100;display:flex;align-items:flex-end"><div role="dialog" class="sheet" style="width:100%;padding:16px;overflow-y:auto"><button style="height:48px">Ok</button></div></div>', '.sheet{max-height:90vh}'),
    opts: { expectOverlay: true },
    check: (r) => [[has(r, 'vh-unit-sheet', (f) => f.rules.some((x) => x.value.includes('90vh'))), 'acusa vh sem dvh e cita a regra']],
  },
  {
    name: 'sheet com dvh NÃO é sinalizado',
    vp: [390, 700],
    html: page('<div style="position:fixed;inset:0;z-index:100;display:flex;align-items:flex-end"><div role="dialog" class="sheet" style="width:100%;padding:16px;overflow-y:auto"><button style="height:48px">Ok</button></div></div>', '.sheet{max-height:90vh;max-height:90dvh}'),
    opts: { expectOverlay: true },
    check: (r) => [[none(r, 'vh-unit-sheet'), 'vh seguido de dvh (fallback) não é acusado']],
  },
  {
    name: 'rolagem aninhada (scroller dentro de página que rola)',
    vp: [390, 600],
    html: page('<div style="height:1600px"><div style="height:200px;overflow-y:auto"><div style="height:700px">lista</div></div></div>'),
    check: (r) => [[has(r, 'nested-scroll', (f) => f.parentScroller), 'acusa nested-scroll']],
  },
  {
    name: 'scroller dentro de contêiner FIXO (modal) não é aninhado no documento',
    vp: [390, 600],
    html: page('<div style="height:1600px"></div><div style="position:fixed;inset:0;overflow:hidden"><div style="height:300px;overflow-y:auto"><div style="height:900px">lista</div></div></div>'),
    check: (r) => [[none(r, 'nested-scroll'), 'não acusa']],
  },
  {
    name: 'texto truncado com reticências',
    vp: [390, 844],
    html: page('<div style="width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Paciente relatou dificuldade em manter o café da manhã</div>'),
    check: (r) => [[has(r, 'text-truncated', (f) => f.hiddenPx > 20), 'acusa text-truncated']],
  },
  {
    name: 'paisagem: sidebar empilhada SEM bottom nav nem top bar',
    vp: [844, 390],
    html: page('<aside class="sidebar" style="height:480px;background:#eee"><a href="#">Hoje</a></aside><main class="main" style="padding:16px"><h1>Conteúdo</h1></main>'),
    opts: { chrome: { sidebar: '.sidebar', main: '.main', bottomNav: '.mobileBottomNav', topBar: '.mobileTopBar' } },
    check: (r) => [
      [has(r, 'sidebar-stacked-no-nav'), 'acusa sidebar-stacked-no-nav'],
      [has(r, 'content-below-fold'), 'acusa content-below-fold'],
    ],
  },
  {
    name: 'com bottom nav a sidebar escondida NÃO é acusada',
    vp: [390, 844],
    html: page('<aside class="sidebar" style="display:none"></aside><nav class="mobileBottomNav" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#fff"><a href="#" style="display:block;width:100%;height:64px">Hoje</a></nav><main class="main" style="padding:16px"><h1>Conteúdo</h1></main>'),
    opts: { chrome: { sidebar: '.sidebar', main: '.main', bottomNav: '.mobileBottomNav', topBar: '.mobileTopBar' } },
    check: (r) => [[none(r, 'sidebar-stacked-no-nav') && none(r, 'content-below-fold'), 'não acusa']],
  },
  {
    name: 'fim do conteúdo SOB barra fixa (sem reserva)',
    vp: [390, 600],
    html: page('<div style="height:1400px"></div><p id="last" style="margin:0;height:40px">Sair da conta</p><div class="bar" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#ddd"></div>'),
    check: (r) => [[has(r, 'content-under-chrome', (f) => f.gap < 0) && r.bottomReserve.gap < 0, 'acusa content-under-chrome com gap negativo']],
  },
  {
    name: 'com padding-bottom reservado NÃO acusa',
    vp: [390, 600],
    html: page('<div style="height:1400px"></div><p style="margin:0;height:40px">Sair da conta</p><div style="height:90px"></div><div class="bar" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#ddd"></div>'),
    check: (r) => [[none(r, 'content-under-chrome') && r.bottomReserve.gap >= 0, 'gap >= 0']],
  },
  {
    name: 'safe-area: botão fixo sob o notch e sob o home indicator',
    vp: [390, 844],
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
    html: page('<div style="position:fixed;top:0;left:0;right:0;height:56px;background:#eee"><button style="height:44px;margin:4px">Voltar</button></div><div style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#eee"><button style="height:44px;margin:10px">Concluir</button></div>'),
    check: (r) => [
      [has(r, 'in-safe-area', (f) => /Voltar/.test(f.text) && f.overlaps.some((o) => o.startsWith('topo'))), 'acusa botão no notch'],
      [has(r, 'in-safe-area', (f) => /Concluir/.test(f.text) && f.overlaps.some((o) => o.startsWith('base'))), 'acusa botão no home indicator'],
    ],
  },
  {
    name: 'safe-area respeitada com env() NÃO acusa',
    vp: [390, 844],
    insets: { top: 47, bottom: 34, left: 0, right: 0 },
    html: page('<div style="position:fixed;top:0;left:0;right:0;padding-top:env(safe-area-inset-top);background:#eee"><button style="height:44px;margin:4px">Voltar</button></div><div style="position:fixed;bottom:0;left:0;right:0;padding-bottom:env(safe-area-inset-bottom);background:#eee"><button style="height:44px;margin:10px">Concluir</button></div>'),
    check: (r) => [[none(r, 'in-safe-area'), 'não acusa']],
  },
  {
    name: 'input com fonte < 16px (zoom no iOS)',
    vp: [390, 844],
    html: page('<input style="font-size:13px;height:44px;width:200px"><input style="font-size:16px;height:44px;width:200px">'),
    check: (r) => [
      [has(r, 'ios-zoom-font', (f) => f.fontSizePx === 13), 'acusa 13px'],
      [r.counts['ios-zoom-font'] === 1, 'não acusa 16px'],
    ],
  },
  {
    name: 'barra fixa translúcida (8% de opacidade) com texto',
    vp: [390, 844],
    html: page('<div style="position:fixed;top:0;left:0;right:0;z-index:950;padding:6px;background:rgba(245,158,11,0.08)">Sem conexão</div><div style="height:1200px"></div>'),
    check: (r) => [[has(r, 'translucent-fixed-bar', (f) => f.backgroundAlpha < 0.1), 'acusa translucent-fixed-bar']],
  },
  {
    name: 'duas barras fixas sobrepostas',
    vp: [390, 844],
    html: page('<div class="a" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#ddd"></div><div class="b" style="position:fixed;bottom:30px;left:0;right:0;height:64px;background:#bbb"></div>'),
    check: (r) => [[has(r, 'fixed-overlap'), 'acusa fixed-overlap']],
  },
  {
    name: 'alvo de 30px AMPLIADO por ::before de 44px (hit-target-44) NÃO é acusado',
    vp: [390, 844],
    html: page('<button class="ht" style="width:30px;height:30px;margin:40px">?</button>', '.ht{position:relative}.ht::before{content:"";position:absolute;top:50%;left:50%;width:44px;height:44px;transform:translate(-50%,-50%)}'),
    check: (r) => [[none(r, 'small-target'), 'a área tocável efetiva é 44x44']],
  },
  {
    name: 'o mesmo botão de 30px SEM pseudo-elemento é acusado com a área efetiva',
    vp: [390, 844],
    html: page('<button style="width:30px;height:30px;margin:40px">?</button>'),
    check: (r) => [[has(r, 'small-target', (f) => f.w === 30 && f.h === 30 && f.extendedByPseudo === false), 'acusa 30x30 sem ampliação']],
  },
  {
    name: 'overflow do body PROPAGADO à viewport não é "rolagem dupla"',
    vp: [390, 600],
    html: page('<div style="height:1600px">alto</div>', 'html,body{height:100%}body{overflow-x:hidden}'),
    check: (r) => [[none(r, 'double-scroll'), 'não acusa']],
  },
  {
    name: 'html E body rolando ao mesmo tempo é rolagem dupla de verdade',
    vp: [390, 600],
    html: page('<div style="height:1600px">alto</div>', 'html{height:100%;overflow:auto}body{height:100%;overflow:auto;margin-top:20px}'),
    check: (r) => [[has(r, 'double-scroll'), 'acusa double-scroll']],
  },
  {
    name: 'wrapper fixo transparente com corpo OPACO não é barra translúcida',
    vp: [390, 844],
    html: page('<div style="position:fixed;bottom:0;left:0;right:0"><div style="background:#fff;padding:12px;height:64px">Treino em andamento</div></div><div style="height:1200px"></div>'),
    check: (r) => [[none(r, 'translucent-fixed-bar'), 'não acusa']],
  },
  {
    name: 'wrapper fixo transparente com corpo a 8% é translúcido (aponta o corpo)',
    vp: [390, 844],
    html: page('<div class="wrap" style="position:fixed;bottom:0;left:0;right:0"><div class="body" style="background:rgba(245,158,11,.08);padding:12px;height:64px">Treino em andamento</div></div><div style="height:1200px"></div>'),
    check: (r) => [[has(r, 'translucent-fixed-bar', (f) => /body/.test(f.selector) && f.backgroundAlpha <= 0.1), 'acusa e aponta o .body']],
  },
  {
    name: 'mini-player empilhado sobre a bottom nav entra na reserva do fim da página',
    vp: [390, 600],
    html: page('<div style="height:1400px"></div><p style="margin:0;height:40px">Sair da conta</p><div style="height:50px"></div><div class="mini" style="position:fixed;bottom:64px;left:0;right:0;height:64px;background:#fde"></div><div class="nav" style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#ddd"></div>'),
    check: (r) => [
      [r.bottomReserve && r.bottomReserve.chrome.length === 2, 'a pilha tem nav + mini-player'],
      [has(r, 'content-under-chrome', (f) => f.gap < 0), 'o conteúdo fica sob o mini-player (gap < 0)'],
    ],
  },
  {
    name: '<details> FECHADO com painel absoluto não gera cobertura nem alvo pequeno (checkVisibility)',
    vp: [390, 844],
    html: page('<details class="nav" style="position:relative"><summary style="min-height:44px">Menu</summary><div style="position:absolute;top:44px;left:0;width:200px;background:#fff"><a href="#" style="display:block;height:30px">Pacientes</a><a href="#" style="display:block;height:30px">Convites</a></div></details><h1 style="margin:8px 0">Hoje</h1><p>texto</p>'),
    check: (r) => [[none(r, 'covered') && none(r, 'small-target', (f) => /Pacientes|Convites/.test(f.text)), 'itens do painel fechado são ignorados']],
  },
  {
    name: 'fundo coberto por modal de tela cheia (consentimento) é covered-by-overlay P3, não P1',
    vp: [390, 844],
    html: page('<button style="display:block;margin:100px auto;width:200px;height:48px">Hoje</button><div style="position:fixed;inset:0;z-index:200;background:#0008;display:grid;place-items:center"><div role="dialog" style="background:#fff;padding:16px;width:300px"><button style="height:48px">Permitir</button></div></div>'),
    check: (r) => [
      [none(r, 'covered') && has(r, 'covered-by-overlay', (f) => f.severity === 'P3' && /Hoje/.test(f.text)), 'reclassifica como informativo'],
    ],
  },
  {
    name: 'camada de PÁGINA (.ws-root) vira escopo: o que está fora dela não conta como coberto',
    vp: [390, 844],
    opts: { pageLayers: ['.ws-root'] },
    html: page('<nav style="position:fixed;bottom:0;left:0;right:0;height:64px;z-index:100"><a href="#" style="display:block;height:64px">Hoje</a></nav><div class="ws-root" style="position:fixed;inset:0;z-index:1200;background:#fff"><button style="margin:60px;height:48px">Concluir série</button></div>'),
    check: (r) => [
      [none(r, 'covered') && none(r, 'covered-by-overlay'), 'a nav coberta pelo modo treino não é achado'],
      [r.scopedTo && r.scopedTo.length === 1, 'o escopo é a camada de página'],
    ],
  },
  {
    name: 'banner parcial com role=dialog (cookie) ENTRA na pilha de reserva do fim da página',
    vp: [390, 600],
    html: page('<div style="height:1400px"></div><p style="margin:0;height:40px">Sair da conta</p><div style="height:70px"></div><div role="dialog" class="cookie" style="position:fixed;bottom:0;left:0;right:0;height:220px;background:#fff;z-index:5000"><button style="height:44px">Aceitar</button></div><nav class="nav" style="position:fixed;bottom:0;left:0;right:0;height:64px;z-index:100;background:#ddd"></nav>'),
    check: (r) => [
      [!!r.bottomReserve && r.bottomReserve.chrome.some((c) => /cookie/.test(c.selector)), 'o banner entra na pilha de barras'],
      [has(r, 'content-under-chrome', (f) => f.gap < 0), 'o conteúdo fica sob o banner (gap < 0)'],
    ],
  },
  {
    name: 'a medição NÃO deixa contêineres overflow:hidden rolados (restauração de scrollLeft)',
    vp: [390, 844],
    html: page('<div id="car" style="overflow:hidden;width:390px;white-space:nowrap"><div style="width:900px"><button style="margin-left:700px;width:100px;height:48px">Longe</button></div></div>'),
    check: (r) => [[r.findings.length >= 0, 'medição executou']],
    after: async (p) => [[await p.evaluate(() => document.getElementById('car').scrollLeft === 0), 'scrollLeft do contêiner voltou a 0']],
  },
  {
    name: 'texto nowrap mais largo que a gaveta overflow-y:auto: rolagem horizontal ACIDENTAL (wide-in-scroller P2)',
    vp: [390, 844],
    html: page('<aside style="height:300px;overflow-y:auto;width:358px;margin:0 auto"><p style="white-space:nowrap;margin:0">Aluno relatou dificuldade em manter a frequência nos dias úteis; combinar treino curto e reavaliar a rotina</p><div style="height:600px"></div></aside>'),
    check: (r) => [[has(r, 'wide-in-scroller', (f) => f.severity === 'P2' && f.elementWidth > f.scrollerClientWidth), 'acusa wide-in-scroller P2']],
  },
  {
    name: 'tabela larga em wrapper overflow-x:auto (dado tabular) é só P3',
    vp: [390, 844],
    html: page('<div style="overflow-x:auto;width:358px"><table style="width:800px"><tr><td>Coluna A</td><td>Coluna B</td></tr></table></div>'),
    check: (r) => [[none(r, 'wide-in-scroller', (f) => f.severity !== 'P3'), 'não acusa além de P3']],
  },
  {
    name: 'controle que ficaria coberto ao CENTRALIZAR mas é alcançável rolando (faixa livre menor que a tela) NÃO é acusado',
    vp: [390, 390],
    html: page('<div id="sc" style="position:fixed;inset:0;overflow-y:auto;padding:80px 0 200px"><div style="height:30px"></div><button style="display:block;height:60px;width:200px;margin:0 auto 400px">Concluir série</button><div style="height:300px"></div></div><div style="position:fixed;top:0;left:0;right:0;height:80px;background:#ddd;z-index:5"></div><div style="position:fixed;bottom:0;left:0;right:0;height:220px;background:#eee;z-index:5"></div>'),
    check: (r) => [[none(r, 'covered') && none(r, 'partly-covered') && none(r, 'unreachable'), 'em alguma posição de rolagem o botão fica livre']],
  },
  {
    name: 'conteúdo dentro de rolagem interna NÃO conta como fim da página (content-under-chrome)',
    vp: [390, 600],
    html: page('<div style="height:1200px"></div><section style="height:200px;overflow-y:auto"><p style="margin:0;height:900px">conteúdo interno longo</p><p style="margin:0">último item interno</p></section><div style="height:80px"></div><nav style="position:fixed;bottom:0;left:0;right:0;height:64px;background:#ddd"></nav>'),
    check: (r) => [[none(r, 'content-under-chrome'), 'o item interno rolado para fora não gera falso positivo']],
  },
  {
    name: 'faixa livre de 140px entre header e barra fixa: o controle é alcançável numa posição INTERMEDIÁRIA (não acusa)',
    vp: [844, 390],
    html: page('<div style="position:fixed;top:0;left:0;right:0;height:79px;background:#ddd;z-index:5"></div><div style="position:fixed;bottom:0;left:0;right:0;height:171px;background:#eee;z-index:5"></div><div style="position:fixed;inset:0;overflow-y:auto;padding:79px 0 240px"><button style="display:block;height:60px;width:200px;margin:0 auto 300px">Concluir série</button><button style="display:block;height:60px;width:200px;margin:0 auto 300px">Próximo</button></div>'),
    check: (r) => [[none(r, 'covered') && none(r, 'partly-covered') && none(r, 'unreachable'), 'achado em alguma posição intermediária']],
  },
  {
    name: 'aba que ESPIA na borda (centro fora, 60% visível) é tocável: não é "inalcançável"',
    vp: [390, 844],
    html: page('<div style="display:flex;overflow-x:auto"><a href="#" style="flex:none;width:200px;height:48px">Um</a><a href="#" style="flex:none;width:170px;height:48px">Dois</a><a href="#" style="flex:none;width:100px;height:48px">Três</a></div>'),
    check: (r) => [[none(r, 'unreachable'), 'não acusa unreachable']],
  },
  {
    name: 'controle com < metade visível e < 24px na tela É inalcançável',
    vp: [390, 844],
    html: page('<div style="overflow:hidden;width:390px"><button style="margin-left:380px;width:200px;height:48px">Fora</button></div>'),
    check: (r) => [[has(r, 'clipped-x') || has(r, 'unreachable'), 'acusa o botão praticamente fora da tela']],
  },
  {
    name: 'página saudável não gera P1/P2 (controle de falso positivo)',
    vp: [390, 844],
    html: page('<header style="padding:12px"><h1 style="margin:0">Hoje</h1></header><main style="padding:16px"><p>Texto normal.</p><button style="height:48px;width:100%">Iniciar treino</button><label style="display:flex;min-height:44px;align-items:center"><input type="checkbox"> Aceito</label></main>'),
    check: (r) => [[r.findings.filter((f) => f.severity === 'P1' || f.severity === 'P2').length === 0, 'zero P1/P2 em página saudável']],
  },
];

async function main() {
  const { mod: pw, version } = await loadPlaywright();
  const chrome = findChrome();
  const browser = await pw.chromium.launch({ executablePath: chrome });
  console.log(`[selftest] playwright-core ${version} · ${chrome}`);
  let failed = 0;
  let checks = 0;
  try {
    for (const c of CASES) {
      const runs = [];
      let lastPage = null;
      let lastCtx = null;
      for (let i = 0; i < 2; i++) {
        const ctx = await newMobileContext(browser, { width: c.vp[0], height: c.vp[1] });
        const p = await ctx.newPage();
        if (c.insets) {
          const cdp = await ctx.newCDPSession(p);
          await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: c.insets });
        }
        await p.setContent(c.html);
        await p.waitForTimeout(60);
        runs.push(await p.evaluate(collectLayoutReport, { ...(c.opts ?? {}), insets: c.insets ?? null }));
        if (i === 1) lastPage = p; else await ctx.close();
        if (i === 1) lastCtx = ctx;
      }
      const r = runs[0];
      const deterministic = JSON.stringify(runs[0].findings) === JSON.stringify(runs[1].findings);
      const results = [...c.check(r), [deterministic, 'determinístico (2 execuções idênticas)'], ...(c.after ? await c.after(lastPage) : [])];
      await lastCtx?.close().catch(() => {});
      const bad = results.filter(([ok]) => !ok);
      checks += results.length;
      failed += bad.length;
      console.log(`${bad.length ? '✗' : '✓'} ${c.name}`);
      for (const [ok, msg] of results) if (!ok) console.log(`    FALHOU: ${msg}\n    achados: ${JSON.stringify(r.findings.map((f) => `${f.type}:${f.severity}`))}`);
    }
  // controle positivo do toque via CDP: se o gesto não gerar eventos, "o toque não reordenou" seria artefato
  {
    const { touchSwipe } = await import('./scenarios.mjs');
    const ctx = await newMobileContext(browser, { width: 390, height: 844 });
    try {
      const p = await ctx.newPage();
      await p.setContent(page('<div id="pad" style="height:300px;touch-action:none;background:#eee"></div><script>window.t={s:0,m:0,e:0};const el=document.getElementById("pad");el.addEventListener("touchstart",()=>t.s++);el.addEventListener("touchmove",()=>t.m++);el.addEventListener("touchend",()=>t.e++);</script>'));
      await touchSwipe(p, { x: 100, y: 100 }, { x: 100, y: 250 }, { steps: 8, holdMs: 100 });
      const t = await p.evaluate(() => window.t);
      const ok = t.s === 1 && t.m >= 6 && t.e === 1;
      checks += 1;
      if (!ok) failed++;
      console.log(`${ok ? '✓' : '✗'} controle positivo: touchSwipe (CDP) gera touchstart/touchmove/touchend ${JSON.stringify(t)}`);
    } finally {
      await ctx.close();
    }
  }
  } finally {
    await browser.close().catch(() => {});
  }
  console.log(`\n[selftest] ${checks - failed}/${checks} asserções OK em ${CASES.length} cenários`);
  process.exit(failed ? 3 : 0);
}

main().catch((err) => {
  console.error(`[selftest] ${err.name}: ${err.message}`);
  process.exit(err instanceof InfraError ? 2 : 3);
});

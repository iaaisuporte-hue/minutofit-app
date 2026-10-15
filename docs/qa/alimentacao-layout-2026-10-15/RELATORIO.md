# Correção de layout mobile — tela Alimentação (15/10/2026)

Status: **CORRIGIDO EM SIMULAÇÃO — HOMOLOGAÇÃO PENDENTE** (sem aparelho Android; as fotografias do PO não foram anexadas ao pedido).
Branch `fix/mobile-alimentacao-layout` (sobre a `main` com a Alimentação Livre). Sem merge, sem deploy, sem alterar versionCode.

## Versão (Gate 0)
Repo: `android/app/build.gradle` → `versionCode` padrão **11**, `versionName` **1.0** (o workflow `android-internal-release.yml` injeta `-PversionCode`); `capacitor.config.ts` com `adjustMarginsForEdgeToEdge: 'auto'` (Android 15+). Versão instalada no aparelho, origem da instalação, escala de fonte e viewport CSS efetivo **não foram informados** → não correlacionados com as fotografias.

## Reprodução (Gate 1) — Chromium local, 9 viewports, banco de teste
Reproduzidos e medidos (`regressao-antes.log`, 5/14 → depois 14/14):
- R1 largura: 320 → coluna 315px em container 296 (margens 28/9; fonte ×1,3 → conteúdo 51px além da tela, cortado).
- R2 eixo Y do gráfico: marcas 200–800 em x=38, svg em x=49 (≈11px cortados; 390 e 320).
- R3 tooltip tema escuro: fundo branco, rótulo 1,09:1, item 2,38:1.
- R4 topbar inset 12px (390 e 844×390).
- R6 rótulo "Alimentação" 72px > 70px (390).
- R5 (revisão independente + isMobile:false): ~120px de vazio acima da nav (reserva dobrada).
Não reproduzidos / intencionais: rotação (variáveis --bottom-nav-h/--cookie-consent-h atualizam), cookie reserva espaço, descrição longa trunca em 1 linha mas é alcançável pelo drawer (intencional), teclado/notch/mini-player/rolagem em aparelho.

## Causa raiz (Gate 2)
1. `src/pages/UserApp.tsx` (wrapper `display:grid` sem `grid-template-columns`): coluna implícita `auto` cresce até o min-content de qualquer descendente (a linha de refeições com o badge "Fora do plano" nos 320px) → página mais larga que a tela; `.appShell{overflow-x:clip}` corta em vez de rolar. Experimento: `minmax(0,1fr)` → coluna 296, margens 28/28. Compartilhada por todas as rotas do aluno.
2. Gráficos: `margin.left` negativa + `YAxis` estreito (NutritionDaySummary, WeightLoadTrend, WorkoutProgress) com `svg{overflow:hidden}`; tooltip recharts com `backgroundColor:#fff` inline.
3. `components.css`: topbar sticky é filha do `.main` (padding lateral 12px) → inset + safe-area lateral aplicada em dobro.
4. `.pageBottomSafe` (≤719) somava outra reserva de nav sobre a do `.main`.
5. Nav: padding 4px + 10px/0,02em → 72px > 70px.
**Por que o QA anterior não pegou:** o runner media overflow/corte do `documentElement` (o shell já clipa), usava dados vazios (sem gráfico/linha com badge), não abria tooltip nem tema escuro, não ampliava fonte e media a topbar só por interseção, não por inset.

## Correções (por causa)
`3f0ceef` UserApp grid · `3d24ac8` charts (eixo + `features/charts/chartTooltip.ts` + badge nowrap) · `b376d71`/seguintes shell (topbar full-bleed, nav label fluido `clamp`, reserva dobrada) · `0f5f8d9` teste de regressão `scripts/qa-mobile-layout/alimentacao-regressao.mjs` + `chartTooltip.test.ts`.

## Verificação
tsc, eslint, build limpos; vitest **126 arquivos / 1227 testes**; `layoutContract`/`mobileShell` ok; regressão geométrica 14/14 (falhava 5/14). Sondas: Aluno Hoje e Personal dashboard com topbar full-bleed em 390/844×390/320. Revisão independente (mobile-reviewer): aprovado, P1 tratados (rótulo 360, isMobile:false, R5).
**Não executado:** matriz completa de 730 células do runner (exige fixtures próprias), aparelho físico, Android real, teclado real, notch real, mini-player (não reproduzido).

## Pendências / não alterado (decisão ou escopo)
- MetabolicChart: eixo Y hoje 100% invisível (width 28 + left −20) — decidir ocultar ou revelar (Hoje, Evolução, cockpit do Personal).
- Mesma coluna implícita `auto` em `PersonalApp.tsx:265`; Nutri sem a correção da topbar (`withMobileHeader` sem bottom nav); tooltips de MetabolicChart/ProgressScoreCard/ProgressionPanel com item na cor da série (oliva 3,27:1 no claro); `Legend` do WeightLoadTrend.
- Rótulo "Alimentação" em 320 continua com reticências (aceito); Personal dashboard 320: um botão ghost passa 19px (não relacionado).
- "Fonte ampliada" simulada escalando font-size computado (aproximação do textZoom da WebView).
- Nota de processo: um `git stash` acidental foi desfeito (`stash pop`) em seguida; nada se perdeu.

## Checklist para homologação em aparelho (vincular a build com este commit)
1. Instalar build interno do commit da branch; anotar versionName/versionCode e SHA.
2. Alimentação em retrato: barra superior de ponta a ponta, sem faixas laterais; conteúdo com margens simétricas; gráfico com valores do eixo Y inteiros.
3. Tocar no gráfico (claro e escuro): tooltip legível. 4. Rolar até o fim: último conteúdo acima da nav com folga pequena.
5. Paisagem e rotação retrato↔paisagem: barra e nav corretas, sem sobras.
6. Fonte do sistema em "Grande"/"Maior": nada cortado à direita. 7. Teclado aberto no registro de alimento: campo e Pronto visíveis.
8. Rótulo "Alimentação" completo em 360–390. Registrar capturas de tela com a versão visível.

---

# Fechamento das pendências estruturais (15/10/2026, continuação)

Base `0692bd9` → commits seguintes na mesma branch. Sem merge, sem deploy, sem Play Store.

| Item | Resultado | Evidência |
|---|---|---|
| Grid do Personal | **Reproduzido** só com fonte ×1,3 em 320 na rota `review` (coluna 307 > container 296; página 327 > 320). Demais rotas (dashboard, students, finance, messages) não reproduzem. Corrigido: `PersonalApp.tsx` `gridTemplateColumns: minmax(0,1fr)` | script R7: antes FALHOU, depois PASSOU |
| Barra do Nutri | **Reproduzida**: topbar a 16px de cada borda (`withMobileHeader` sem bottom nav, padding do `.main` = space-4). Corrigido no ponto compartilhado (vars `--main-px-*` + margem negativa) | R8: antes `{left:16,right:16}`, depois 0/0 (390 e 320) |
| Eixo Y do MetabolicChart | **Não era intencional**: `YAxis` sem `hide`, `width 28` + `margin.left −20` → ticks (até "100") cortados pelo `overflow:hidden` do svg; o score 0–100 precisa de escala e o tooltip não substitui. Decisão: **revelar** (`left:0`, `width 32`) + tooltip legível; contrato `chartMargins.test.ts` impede margem negativa em qualquer gráfico | teste de contrato passa; **sem fixture visual** do gráfico (Hoje/cockpit exigem série de check-ins) — verificado pelo mesmo mecanismo medido na Alimentação |
| Rótulo "Alimentação" em 320 | Medido 65px > 60px. Corrigido sem aumentar a nav: padding horizontal e letter-spacing fluidos (`clamp`, 0 em 320 → valores normais a partir de 360) + fonte `clamp(9px,2.6vw,10px)` | R6: 320 antes `{sw:65,cw:60}`, depois completo; 360 e 390 mantêm |
| Tooltips restantes (MetabolicChart, ProgressScoreCard, ProgressionPanel) | item/rótulo passam a `--color-text` | `chartTooltip.test.ts` |
| AdminApp | não reproduzível (desktop-first, sem shell mobile) — registrado, sem alteração | — |

## Regressão
- Alimentação + Personal + Nutri: `alimentacao-regressao.mjs` **18/18** (código anterior `0692bd9`: 14/18; falhas: R6@320, R7, R8×2).
- **Matriz 730 células**: executada (13:59–14:11, 3 workers, ok=730, bloqueadas/erro=0), banco `corefit_qa_mobile_layout_test`. Status por ID **idêntico** ao baseline de encerramento (`ENC-FINAL`): 30/30 IDs sem diferença, 71 agrupamentos novos = os mesmos 71 (P1: 2 — ambos preexistentes: link `/excluir-conta` coberto em `public.privacy` 320, e botão "Pedir check-in" do dashboard do Personal cortado 40px em 320). **Nenhuma regressão nova.** Limites do runner: A3/A12 bloqueados (câmera) e G8 não testado, como antes; os dados semeados não incluem séries de gráfico.
- selftest do runner 109/109; tsc, eslint, build limpos; vitest **127 arquivos / 1229 testes**.

## Pendências justificadas
- "Pedir check-in" (Personal, 320) e link de exclusão de conta (público, 320): preexistentes, fora do escopo estrutural.
- Eixo Y do MetabolicChart sem verificação visual com dados reais.
- Fonte ampliada é simulada (escala do font-size computado).

## Homologação física — PENDENTE
Build rastreável **não gerado**: sem Android SDK neste ambiente e `android-internal-release.yml` só dispara a partir de `main` (nenhum merge autorizado). Referência: `versionCode` padrão 11 / `versionName` 1.0 (o workflow injeta `-PversionCode`). Para homologar: após autorização de merge, disparar o workflow com `dry_run=true`, anotar SHA/versionCode do artefato, instalar e executar o checklist do relatório anterior + eixo Y do gráfico metabólico (Hoje), barra do Nutri e rotas do Personal com fonte grande.

# S2CORE — Design System (aplicado)

Referência viva do design system da S2CORE **como implementado no código**.
Fonte da verdade em código:

| Camada | Arquivo |
|---|---|
| Tokens (cor, fonte, espaço, raio, sombra) | [`src/styles/tokens.css`](../../src/styles/tokens.css) |
| Primitivos (classes de componente) | [`src/styles/components.css`](../../src/styles/components.css) |
| Cores no JS (gráficos) | [`src/styles/colors.ts`](../../src/styles/colors.ts) |
| Base global + fontes | [`src/styles/globals.css`](../../src/styles/globals.css) · [`src/main.tsx`](../../src/main.tsx) |

> **Regra de ouro:** nunca escreva um HEX na tela. Consuma um token. HEX hardcoded é bug de review.

---

## 1. Paleta oficial

| Uso | HEX | Token principal |
|---|---|---|
| Preto premium | `#0A0A0A` | `--color-black-main` / `--background-dark` |
| Branco suave | `#F5F5F5` | `--color-white-main` |
| **Verde oliva** (marca) | `#7B9919` | `--color-primary` / `--color-brand-main` |
| Oliva ativo (hover) | `#91B51E` | `--color-primary-hover` / `--color-brand-hover` |
| Oliva profundo | `#5E7412` | `--color-primary-deep` / `--color-brand-dark` |
| Cinza premium | `#8E8E8E` | `--color-gray-premium` |
| Cinza claro | `#D9D9D9` | `--color-gray-light` |

**Cores semânticas** (imutáveis, fora da whitelist de branding): `--status-success` (oliva), `--status-warning` (`#E0A82E` faixa), `--status-danger` (`#DC2626`), `--status-info` (`#3B82F6`).

**Accent cyan** `#06B6D4` (`--color-accent`): **único data-accent permitido** — insights, tracker, metabolismo, séries de "condição" em gráficos. Não é cor de marca; não expandir para CTAs/áreas gerais.

**Não exagerar no verde:** uma âncora oliva por tela. Oliva = ação, progresso, saúde, estado ativo. O resto é preto/branco/cinza.

---

## 2. A regra de contraste do oliva (crítica)

O oliva `#7B9919` é um tom médio. Medições WCAG reais:

| Combinação | Ratio | Uso |
|---|---|---|
| `#7B9919` sobre preto | 6.0:1 ✓ | texto/ícone oliva no escuro |
| `#7B9919` sobre branco | 3.0:1 ✗ | só preenchimento/gráfico grande — **nunca texto** |
| **branco** sobre `#7B9919` | 3.0:1 ✗ | **CTA NÃO leva texto branco no oliva vibrante** |
| **preto** `#0A0A0A` sobre `#7B9919` | 6.0:1 ✓ | texto escuro pode sentar no oliva vibrante |
| branco sobre `#5E7412` (deep) | 4.84:1 ✓ | **CTA correto: texto branco no oliva profundo** |
| `#5E7412` sobre branco | 4.84:1 ✓ | oliva como texto no claro → use o profundo |

### Consequência prática — CTA
CTA com **texto branco** usa os **action tokens**, não `--color-primary`:

```css
--action-primary:         #5E7412;  /* fundo do botão (branco 4.84:1) */
--action-primary-hover:   #62781A;  /* lift validado ≥ 4.5:1 */
--action-primary-pressed: #4A5C0E;
--action-primary-text:    #F5F5F5;  /* = --color-cta-text */
```

- Botão com texto branco → `background: var(--action-primary)`.
- Oliva vibrante `#7B9919` → ícones, progresso, bordas, estados ativos, e texto **escuro** sobre oliva.
- Nunca subir o hover para `#7B9919` com texto branco (cairia para 3.0:1).

---

## 3. Tipografia

Carregadas via `@fontsource` em [`src/main.tsx`](../../src/main.tsx).

| Fonte | Token | Uso |
|---|---|---|
| **Manrope** (400–800) | `--font-sans` | **tudo** de interface: body, botões, cards, inputs, menus, tabelas, badges, dashboards |
| **Exo 2** (500–700) | `--font-brand` / `--font-display` | **marca com moderação**: splash, hero, slogan, score em destaque, métricas especiais, cards premium |

**Regra:** se você lê mais de ~4 palavras seguidas, é Manrope. Exo 2 **nunca** em texto corrido, ficha detalhada, formulário ou tabela densa.

Métrica de destaque: use a classe `.metric-display` (Exo 2 + `tabular-nums`).

Escala/pesos: `--font-normal:400 · --font-medium:500 · --font-semibold:600 · --font-bold:700 · --font-extrabold:800`. Tamanhos: `--text-xs..3xl`.

---

## 4. Logomarca

Símbolo (anel segmentado + monograma S2) e wordmark `s2core` em `/public` (assets legados `corefit-*.svg`). Componente: [`src/components/CoreFitLogo.tsx`](../../src/components/CoreFitLogo.tsx).

- Fundos válidos: preto `#0A0A0A` ou oliva sólido. Nunca sobre foto sem overlay ou cinza médio.
- O "2" é sempre oliva; não recolorir nem inverter S/2.
- Área de proteção ≥ altura do "S". Mínimo: símbolo 24px, wordmark 96px.
- Sem sombra/brilho/contorno/gradiente no símbolo.

---

## 5. Componentes (classes reais em `components.css`)

Consuma estas classes — **não crie equivalentes**.

**Button** `.btn` + variante:
`.btn-primary` (deep olive, texto branco) · `.btn-secondary` · `.btn-outline` · `.btn-ghost` · `.btn-danger` · `.btn-accent` (cyan) · `.btn-icon` · `.btn-loading` · `.btn-block`.
Estados: `:hover`, `:active` (pressed), `:disabled`, **`:focus-visible`** (anel oliva por teclado — automático).

**Card** `.card` (+ `.card-pad`) · `.card-accent` (insights) · `.card-gradient` (premium) · `.section-card`.

**Formulário** `.input` (serve input/select/textarea) · `.input-invalid` · `.field` / `.label` / `.field-error` / `.field-hint` · **`.switch`** (`> input + .switch-slider`) · **`.checkbox`** · **`.radio`** · `.control-row`.

**Badge** `.badge` + `.badge-success/-warn/-danger/-info/-accent/-neutral/-brand/-premium/-beta`. Sempre com rótulo — **cor nunca sozinha**.

**Alert** `.alert` + `.alert-success/-warn/-danger/-info` (`> .alert-icon` + `.alert-title`).

**Feedback/estado** `.skeleton` (+`-text/-title/-circle`) · `.progressTrack` / `.progressFill` · [`EmptyState.tsx`](../../src/components/EmptyState.tsx) · [`Toast.tsx`](../../src/components/Toast.tsx) · [`ConfirmDialog.tsx`](../../src/components/overlay) · `.avatar-initials` (`--sm/--md/--lg`).

**Navegação** `.sidebar` + `.navLink` / `.navLinkActive` / `.navLinkCta` · `.mobileBottomNav` · `.page-header` · `.dash-filter-tabs`.

---

## 6. Espaço · forma · movimento

- **Espaço** (base 4px): `--space-1..10` (4/8/12/16/20/24/32/40). Padding card 20–24 · gap 16–20 · seção 64–88.
- **Raio**: `--radius-sm/md/lg/xl/pill` + `--radius-card:16px`.
- **Sombra**: `--shadow-sm/md/lg` (discretas) + `--shadow-accent`.
- **Movimento**: `--transition-fast:150ms` · `--transition-base:200ms`. Modais/sheets ~240ms. Sempre respeitar `prefers-reduced-motion` (já global). Animação comunica progresso/confirmação — nunca decora.

---

## 7. Acessibilidade

- Contraste texto ≥ 4.5:1 · gráfico/ícone ≥ 3:1. Ver §2 para o oliva.
- Foco visível por teclado em botões e controles (`:focus-visible`).
- Alvo de toque ≥ 44px. Fonte de corpo ≥ 14px.
- Status = ícone + texto, nunca só cor.
- Modo daltônico: `html[data-color-mode="daltonic"]` troca o primário por azul (inclui `--action-primary` acessível). Toggle: [`ColorModeToggle.tsx`](../../src/components/ColorModeToggle.tsx).

---

## 8. Responsividade

Mobile-first no aluno; desktop-first em personal/academia/admin.

| Breakpoint | Largura | Grid | Nav |
|---|---|---|---|
| Mobile | ≤ 719px | 1 coluna | bottom nav |
| Tablet | 720–979px | 2 colunas | bottom nav / recepção |
| Desktop | ≥ 980px | 2–3 colunas | sidebar permanente |
| Amplo | ≥ 1180px | 3–4 colunas | sidebar + painéis |

Nenhuma tela rola na horizontal. Tabela densa → `overflow-x:auto` no container.

---

## 9. Aplicação por módulo

- **Aluno** (mobile-first): Home/Treino/Dieta/Check-in/Score/Evolução. Score = label qualitativo + barra (Exo 2 no label), **não** número-resumo estilo Whoop. CTA claro, um oliva por tela.
- **Personal** (desktop): 4 destinos + mensagens; funcionalidade nova = aba interna. Foco em quem precisa de atenção.
- **Nutri** (desktop): separar plano alimentar de check-in; formulários claros.
- **Academia** (desktop; recepção tablet): hero = saúde da base, não gestão. Preview de branding mostra o `--color-primary` do tenant (não trocar por action).
- **Admin** (desktop): "Estado da plataforma", densidade controlada.

---

## 10. Checklist — nova tela

- [ ] Zero HEX hardcoded — só tokens.
- [ ] Fontes: interface em Manrope; Exo 2 só em marca/score/hero (com moderação).
- [ ] CTA com texto branco usa `--action-primary` (não `--color-primary`).
- [ ] Reusa `.btn/.card/.input/.badge/.alert/.switch/...` — não duplica.
- [ ] Estados: loading, empty, error, success cobertos.
- [ ] Contraste validado (§2 e §7); foco visível.
- [ ] Mobile: cards empilham, alvos ≥ 44px, sem scroll horizontal.
- [ ] Status por ícone + texto, não só cor.

## 11. Checklist — Pull Request

- [ ] Nenhum verde/cor fora dos tokens (grep `#22C55E|#16A34A|#7B9919` inline → 0).
- [ ] Nenhuma fonte fora de Manrope/Exo 2.
- [ ] Nenhum componente duplicado (verificou `.btn`/`.card`/`.input`/`.badge` antes de criar?).
- [ ] `npm run build` + `npm test` + `npm run lint` verdes.
- [ ] Nenhuma funcionalidade/rota/regra removida por refactor visual.
- [ ] Regras completas em [`docs/AGENT_DESIGN_SYSTEM_RULES.md`](../AGENT_DESIGN_SYSTEM_RULES.md).

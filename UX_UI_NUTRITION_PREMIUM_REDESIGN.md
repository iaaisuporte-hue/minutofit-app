# UX/UI NUTRITION PREMIUM REDESIGN
## Tela "Alimentação" do aluno (`NutritionPlanViewPage`) — proposta de hierarquia e composição

_17 set 2026. Análise read-only + proposta. Nenhum JSX/CSS foi alterado até este documento
ser aprovado. Escopo: UX/UI/layout/progressive disclosure. Nenhuma regra de negócio, cálculo,
parser, Truth Layer, migration ou API é tocada._

---

## 0. Como este documento foi produzido

Investigação read-only (agente Explore) de: `NutritionPlanViewPage.tsx` (1016 linhas, estrutura
completa), `NutritionTargetCard.tsx` (291 linhas), `NutritionDaySummary.tsx` (311 linhas),
`IntakeLogSheet.tsx`, `DrawerShell.tsx`, `AppShell.tsx`, `tokens.css`, `components.css` (3073
linhas), `docs/AGENT_DESIGN_SYSTEM_RULES.md`, `docs/design-system/README.md`, e grep de padrões
de grid 2-colunas já usados no produto (Personal/Admin/Auth). As quatro lentes pedidas (UX/UI
sênior, Design System, Mobile/Capacitor, Acessibilidade) foram aplicadas na consolidação abaixo
por um único agente principal, como o prompt define ("agentes recomendam, um consolida").

---

## 1. Diagnóstico

### 1.1 O problema real não é visual, é estrutural

A tela hoje é **uma coluna única de 560px, forçada por `maxWidth:560` hardcoded 3 vezes**
(`NutritionPlanViewPage.tsx:817,784` e `MealDrawer` L163) — desconectada do `.container` de
1060px que o `AppShell` já reserva para todo o app. Em desktop, isso deixa ~500px de espaço
lateral morto e faz a tela parecer "mobile esticado", exatamente o problema relatado em §11 do
prompt.

Dentro dessa coluna estreita, os blocos competem por atenção com o **mesmo peso visual**:
título do plano, calculadora de estimativa (quando não há meta salva, ela é sempre exibida
100% expandida — não existe hoje nenhum modo compacto para "estimativa própria"), o card "Seu
dia nutricional", a timeline de refeições e o disclaimer. Todos usam basicamente a mesma
tipografia (`fontSize:12-15`), então nada "grita" que é a informação principal do dia.

### 1.2 Achados técnicos que mudam o plano de implementação

- **Já existe** o conceito de colapsar/expandir (`calculatorOpen` em `NutritionTargetCard`),
  mas ele só serve para o caso "há meta do plano do nutri" (botão "ver estimativa própria").
  Para "estimativa própria" (self-estimate) **não existe hoje nenhum modo compacto** — a
  calculadora inteira renderiza sempre, mesmo depois de salva. É exatamente o problema §4/§20
  do prompt, e a solução é estender um padrão que já existe, não inventar um novo.
- **`.progressTrack`/`.progressFill` já existem em `components.css` (com variante
  `--accent`/`--gradient`) mas têm ZERO uso em todo o projeto.** As 4 barras de progresso
  desta tela (header do plano, energia, 3× macro) são todas `<div style={{...}}>` manuais
  duplicando a mesma lógica de clamp. Adotar essas classes mortas resolve §7 (hierarquia de
  macros) sem criar nenhum CSS novo — é reuso, não invenção.
- **Não existe accordion/collapse genérico no DS.** O único padrão de disclosure do produto é
  o próprio `calculatorOpen` (mount/unmount abrupto, sem transição). A proposta abaixo generaliza
  esse padrão com uma transição simples e local ao componente — não é um componente novo de DS,
  é uma pequena extensão do padrão que já existe ali mesmo.
- **Nenhum grid de 2 colunas existe hoje no módulo do aluno** (mobile-first por decisão
  registrada no CLAUDE.md). Grids 2-col já existem em Personal/Auth/Admin
  (`.mp-grid`, `.authLayout`, grids `auto-fit` em `personalPremium.css`). Propor um para
  Alimentação em desktop é a primeira aplicação desse padrão ao aluno — consistente com a
  arquitetura do produto, não uma invenção isolada.
- **`MealDrawer` (o check-in Segui/Parcial/Pulei/Substituí) não usa `DrawerShell`** — é um
  overlay manual sem scroll-lock/Escape/botão-voltar-Android, enquanto `IntakeLogSheet` (mesma
  tela) usa `DrawerShell` corretamente. **Isto é uma lacuna pré-existente, fora do escopo desta
  tarefa** (é comportamento funcional do overlay, não hierarquia/tipografia/composição) — fica
  registrado como risco conhecido (§9), não será tocado aqui.
- Biblioteca de gráfico confirmada: **recharts** (já em uso em `DayEvolutionChart`) — nenhuma
  lib nova.

---

## 2. Princípio de composição adotado

```
HOJE
 ├─ estado atual        → hero "Seu dia nutricional" (energia + macros)
 ├─ progresso            → mesmo hero, barras e gráfico "Evolução do dia"
 ├─ próxima ação         → card "Próxima refeição" destacado dentro da timeline
 ├─ planejamento         → timeline compacta das demais refeições
 └─ configuração         → estimativa/meta em card compacto, "Editar" sob demanda
```

Contexto do protocolo (nome do plano/nutri) fica como cabeçalho leve — não é "estado do dia",
é orientação, então perde peso visual em relação ao que tem hoje.

---

## 3. Hero "Seu dia nutricional"

**Decisão: número + barra horizontal, não anel/gauge circular.** Motivo: um anel exige área
mínima ~120×120 para ficar legível, compete mal com 3 macros abaixo em 320px de largura, e
tende a ler como "dashboard financeiro/fitness genérico" — exatamente o que o prompt pede para
evitar. A composição **número grande + barra + 3 macros em linha** entrega a mesma leitura em
~3s com menos altura, funciona igual em 320px e 1440px, e é acessível sem depender de cor
(barra + texto numérico sempre presentes).

```
Seu dia nutricional
Meta do seu plano  ·  ou  · Estimativa diária (≈)

1.640 / 2.851 kcal                 ← --text-4xl (novo token), extrabold
▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░  58%   ← .progressFill (adotado, não criado)

Proteína     112 / 143 g  ▓▓▓▓▓▓▓░░░
Carboidratos 168 / 390 g  ▓▓▓▓░░░░░░
Gordura       48 / 80 g   ▓▓▓▓▓░░░░░
Fibra ≈ 8 g · dados parciais   (só quando existir, sem barra — regra já vigente)

[Evolução do dia — gráfico existente, sem alteração de lógica]
[micro-insight — frase existente, sem alteração]
```

Mudanças concretas em `NutritionDaySummary.tsx`:
- kcal principal sobe de `--text-2xl` (22px) para um **novo token `--text-4xl` (34px,
  extensão mínima do DS — ver §11)**, peso `--font-extrabold`.
- percentual (`58%`) passa a ficar **ao lado da barra**, não abaixo dela sozinho — reduz uma
  linha de altura.
- as 3 barras de macro trocam a `<div>` manual por `.progressTrack`/`.progressFill`
  (classes já existentes, hoje sem uso) — ganha consistência visual e menos CSS duplicado.
- valor do macro (`112 / 143 g`) sobe de `--text-sm`(13px) para `--text-base`/`--text-lg`
  (14-16px) com peso `--font-bold`, label (`Proteína`) permanece `--text-xs` uppercase — cria o
  contraste hierárquico pedido em §7 sem depender só de cor.
- Card deixa de ter `maxWidth:560` herdado da página — passa a ocupar a largura da coluna que
  o novo layout lhe der (ver §6).

Nenhuma lógica de dados, fonte da meta, cálculo ou regra de fibra é alterada — só tipografia,
espaçamento e o componente de barra.

---

## 4. Estimativa/meta — comportamento compacto ↔ expandido

Contrato exigido pelo prompt (§20), mapeado ao estado que já existe em `NutritionTargetCard`:

| Estado | Hoje | Proposto |
|---|---|---|
| Sem estimativa salva (primeira vez) | Calculadora expandida | **Mantém** — expandida |
| Estimativa própria já salva | Calculadora expandida (sempre) | **Card compacto**, com "Editar" |
| Meta do plano do nutri | Compacta com "ver estimativa própria" | **Mantém** o padrão, só ajusta tipografia |
| Usuário toca "Editar" | — | Expande com transição, foco no primeiro campo |
| Usuário salva | Permanece expandida | **Recolhe** de volta ao card compacto |

Card compacto (self-estimate salva), dentro do mesmo `className="card cardPad"` já usado:

```
┌─────────────────────────────────────────────┐
│ Estimativa diária                    Editar │   ← badge-neutral + btn-ghost btn-sm
│                                               │
│ 2.851 kcal                                   │   ← --text-xl/--font-bold
│ 143g P · 390g C · 80g G                      │   ← --text-sm muted
│ Manter · Atividade moderada · 4 refeições    │   ← --text-xs muted
└─────────────────────────────────────────────┘
```

Implementação: reaproveita o booleano `calculatorOpen` que já existe — só muda o valor
**inicial** (`false` quando já existe `resolved.source === 'self_estimate'` e não é a primeira
carga; `true` quando `resolved` é `null`) e adiciona uma view compacta alternativa quando
`!calculatorOpen && resolved`. Transição: `max-height`/`opacity` local ao componente (12-16
linhas de CSS), respeitando `prefers-reduced-motion: reduce` (transição vira `none`). Não é um
componente de accordion novo no DS — é a extensão do padrão que já existe ali.

Isto responde diretamente ao problema #2 do prompt ("mesmo depois de salvar, os controles
continuam dominando a tela").

---

## 5. Timeline de refeições — compacta + próxima refeição em destaque

**Próxima refeição** (a primeira sem check-in cujo horário é o mais próximo de agora — reusa
o mesmo dado já usado para o "countdown" existente no cabeçalho do `MealDrawer`; nenhum cálculo
novo de negócio, é decisão de estilo sobre dado que já existe):

```
PRÓXIMA REFEIÇÃO
13:00 · Almoço
120g arroz · 150g frango · legumes
[ Registrar o que comi ]
```
— card com peso visual maior (fundo `--color-primary-soft`, já usado hoje para o item ativo),
mantém o texto de orientação completo.

**Demais refeições** — uma linha por refeição, sem clamp de 2 linhas, sem bloco de orientação
expandido:

```
07:30  Café da manhã          ✓ Segui
13:00  Almoço                 ← já mostrado acima em destaque, não repete
19:30  Jantar                 ○ pendente
```

Mudanças concretas em `MealCard` (dentro de `NutritionPlanViewPage.tsx`):
- padding de `"12px 14px"` para `"10px 12px"`; gap entre cards de `--space-2` (8px) em vez do
  espaçamento atual maior.
- status de check-in passa de pill manual (`style` inline) para `.badge-success`/`.badge-warn`/
  `.badge-neutral` (reuso de classe existente) — ✓ Segui / ◐ Parcial / ○ Pulei / ⇄ Substituí.
- texto de orientação (`WebkitLineClamp:2`) só aparece completo no card da próxima refeição;
  nas demais, fica oculto por padrão (toque no card abre o `MealDrawer` como hoje, sem mudança
  de comportamento).
- linha/dot vertical da timeline mantida (já é sutil, 1.5px), só com menos padding vertical ao
  redor.

Nenhuma regra de check-in, de substituição ou de horário é alterada — é só densidade e ênfase.

---

## 6. Layout — desktop vs. mobile

### 6.1 Desktop (≥980px)

Remove o `maxWidth:560` da página (mantém apenas no `MealDrawer`, que é um overlay modal e não
faz parte deste redesign). O conteúdo passa a usar até a largura do `.container` (1060px) já
reservado pelo `AppShell`.

```
┌──────────────────────────────────────────────────────────────────┐
│ Combustível do seu metabolismo · Plano de {nutri}    [progresso] │  ← header, largura total
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Seu dia nutricional                     Meta do seu plano         │
│ 1.640 / 2.851 kcal   ▓▓▓▓▓▓▓▓░░░ 58%                              │
│ Proteína 112/143g · Carbo 168/390g · Gordura 48/80g               │
│ [Evolução do dia — gráfico]           [micro-insight]             │  ← largura total
└──────────────────────────────────────────────────────────────────┘

┌───────────────────────────────┐  ┌───────────────────────────────┐
│ Refeições de hoje              │  │ Estimativa diária      Editar │
│ PRÓXIMA: 13:00 Almoço [Registrar]│  │ 2.851 kcal · 143P/390C/80G   │
│ 07:30 Café ✓                    │  │                               │
│ 19:30 Jantar ○                  │  │ Perfil alimentar (compacto)  │
│                                 │  │ Orientações gerais            │
│                                 │  │ Disclaimer                    │
└───────────────────────────────┘  └───────────────────────────────┘
```

Grid: `grid-template-columns: minmax(0,1.4fr) minmax(0,1fr)` (proporção próxima da usada em
`.authLayout`, adaptada), `gap: var(--space-6)`, só a partir de 980px — abaixo disso colapsa
para 1 coluna (mesma técnica de breakpoint já usada em `personalPremium.css`).

**Por que a coluna direita concentra estimativa + perfil + orientações + disclaimer**: são
todos "configuração/referência", não "estado do dia" — ficam juntos e sistematicamente mais
discretos, liberando a coluna esquerda para o que muda a cada refeição (timeline). Isso segue
literalmente a prioridade do prompt (§5): estado → progresso → próxima ação → planejamento →
configuração — as duas colunas expressam essa ordem lateralmente em vez de só verticalmente.

### 6.2 Mobile (até 719px) — ordem vertical

```
Header (compacto)
↓
Seu dia nutricional (hero: energia + macros)
↓
Evolução do dia + micro-insight
↓
Próxima refeição (destaque)
↓
Timeline compacta (demais refeições)
↓
Estimativa diária (compacta, "Editar" expande)
↓
Perfil alimentar · Orientações · Disclaimer
```

Sem grid — pilha vertical, exatamente como hoje, só com os componentes revisados. Scroll
natural é aceito (§10 do prompt); o objetivo é remover scroll **desnecessário** (calculadora
sempre expandida, timeline "gorda"), não eliminar todo scroll.

### 6.3 Tablet (720–979px)

Fica em 1 coluna (mesma regra que o resto do produto usa para este intervalo — sidebar já some
e o conteúdo ainda não tem largura confortável para 2 colunas de leitura). Mesma ordem do
mobile, com un pouco mais de padding lateral (o `.container` já cuida disso).

---

## 7. Tipografia — escala e uso

| Elemento | Hoje | Proposto | Token |
|---|---|---|---|
| kcal do hero | 22px/800 | **34px/800** | `--text-4xl` (novo) |
| % da barra de energia | 12px muted | 13px, ao lado da barra | `--text-sm` |
| valor do macro (`112/143g`) | 13px/600 | **14-16px/700** | `--text-base`/`--text-lg` |
| label do macro (`Proteína`) | 13px muted | 11px uppercase, letter-spacing | `--text-xs` |
| nome da refeição na timeline | 14px/700 | 14px/700 (mantém) | `--text-base` |
| orientação da refeição (não-próxima) | 12px, 2 linhas | oculta por padrão | — |
| estimativa compacta — kcal | — (não existia) | 18px/700 | `--text-xl` |
| labels de seção ("Peso","Objetivo"...) | 11px/700 uppercase inline duplicado | mesmo estilo, extraído para 1 classe utilitária `.field-label-eyebrow` (evita 4 cópias inline) | `--text-xs` |

Extensão mínima de DS proposta: **`--text-4xl: 34px`** em `tokens.css`, ao lado de
`--text-3xl: 26px` já existente — é o único token novo pedido neste redesign, justificado pela
ausência de qualquer tamanho "hero" na escala atual (o maior valor existente, 26px, já é usado
por outros títulos e não teria contraste suficiente com o resto da tela se reaproveitado aqui).

---

## 8. Componentes reutilizados (sem alteração de comportamento)

`card`/`cardPad`, `badge`/`badge-brand`/`badge-neutral`/`badge-success`/`badge-warn`,
`btn`/`btn-primary`/`btn-ghost`/`btn-sm`, `hit-target-44`, `stepper`/`stepper-btn`/
`stepper-value`, `SkeletonPanelCard`, `EmptyState`, `DrawerShell` (via `IntakeLogSheet`, sem
mudança), recharts (`DayEvolutionChart`, sem mudança de dados/lógica), `.container`/`.appShell`
grid já existente.

## 9. Componentes modificados (visual/estrutural, sem mudança de dados ou regra)

- `NutritionPlanViewPage.tsx` — remove `maxWidth:560` da página; adiciona grid 2-colunas
  ≥980px; reordena blocos conforme §6; `MealCard` mais compacto + badges de status.
- `NutritionDaySummary.tsx` — hero com tipografia maior, macros com `.progressFill`, layout
  interno responsivo (energia+macros em linha a partir de 980px).
- `NutritionTargetCard.tsx` — adiciona view compacta para self-estimate salva + transição de
  expand/collapse.
- `tokens.css` — adiciona `--text-4xl`.
- `components.css` — nenhuma classe nova além de, opcionalmente, `.field-label-eyebrow`
  (utilitária, evita duplicação; **não é obrigatória** — se preferir, mantenho inline).

**Não modificado**: `MealDrawer` (overlay de check-in — comportamento e dismiss ficam como
estão; risco pré-existente registrado, não corrigido aqui), `IntakeLogSheet`, qualquer service/
API/backend, `nutritionCalculation.ts`, Truth Layer, P1C, consent, auth.

---

## 10. Estados (contratos, sem exceção)

- **Meta do plano** → badge `badge-brand` "Meta do seu plano" em toda superfície (hero e
  estimativa compacta), sem "≈".
- **Self-estimate** → badge `badge-neutral` "Estimativa diária"/"Estimativa própria", sempre
  com "≈" nos números derivados.
- **Sem meta** → números absolutos, sem barra, sem percentual — comportamento já existente em
  `EnergyProgress`/`AbsoluteRow`, preservado.
- **Zero registros** → `EmptyState` compacto no lugar do gráfico (já existente), **sem**
  reservar altura de gráfico vazio.
- **1+ registro** → hero + barras + gráfico aparecem normalmente.
- **Fibra parcial** → aparece sem barra, com "· dados parciais" (já existente, preservado).
- **Estimativa não configurada (primeira vez)** → calculadora expandida por padrão.
- **Estimativa configurada** → card compacto por padrão; "Editar" expande; "Salvar" recolhe.

---

## 11. Mobile / Capacitor (lente Agent 3)

- Nenhum plugin nativo novo, nenhuma mudança em `capacitor.config.ts`.
- Safe-area: a página hoje usa `padding:"0 16px 40px"` fixo, **sem** `--bottom-nav-h` nem
  `env(safe-area-inset-bottom)` — diferente do padrão já usado em outras telas mobile do
  produto (achado #7 da investigação). Esta tarefa **corrige esse padding** para
  `calc(var(--bottom-nav-h,64px) + 24px + env(safe-area-inset-bottom,0px))`, alinhando com o
  padrão existente — é correção de regressão de safe-area, não escopo novo, e evita que o
  disclaimer fique parcialmente coberto pelo bottom nav em aparelhos com notch.
- Toques: botão "Editar" e "Registrar o que comi" seguem `hit-target-44`. Badges de status na
  timeline são informativos, não interativos — não precisam de 44px.
- Sem teclado nesta tela fora do `NutritionTargetCard` (peso é stepper, não input numérico) e do
  `IntakeLogSheet` (já tratado, fora de escopo).
- Orientação: sem exigência de paisagem.
- **Risco conhecido, não corrigido aqui**: `MealDrawer` sem `DrawerShell` → sem botão-voltar-
  Android nesse overlay específico. Já existia antes desta tarefa; fica registrado, não é
  tocado (ver §1.2 e §9).

## 12. Acessibilidade (lente Agent 4)

- Nenhuma informação depende só de cor: toda barra tem valor numérico ao lado; todo badge de
  status tem texto (`Segui`/`Parcial`/`Pulei`/`Substituí`), não só ícone/cor.
- Contraste: `--text-4xl` no hero usa `COLORS.text`/`--color-text` (mesmo token já validado em
  WCAG AA no restante do DS) — nenhuma cor nova introduzida.
- Transição de expandir/colapsar respeita `prefers-reduced-motion: reduce` (vira instantânea).
- `aria-expanded` no botão "Editar"/toggle, associado ao painel da calculadora (`aria-controls`).
- Ordem de leitura por leitor de tela segue a ordem visual/DOM proposta (hero → macros →
  próxima refeição → timeline → estimativa) — nenhum `order` de CSS Grid desconecta DOM de
  leitura (o grid 2-col usa ordem de colunas que já é a ordem do DOM, não `grid-row`/`order`
  invertendo semântica).
- Botões de status na timeline não interativos não recebem `role="button"` nem tabindex —
  evita foco vazio.

---

## 13. Riscos

1. **`--text-4xl` é o único token novo** — risco baixo, mas precisa ser adicionado a `tokens.css`
   e revisado quanto a não colidir com nenhuma tela que já dependa implicitamente do maior
   tamanho disponível ser 26px (nenhuma encontrada na investigação).
2. **Mudar o valor inicial de `calculatorOpen`** para self-estimate já salva pode, se houver bug
   de detecção de "primeira vez" vs "já salvo", esconder a calculadora de quem nunca configurou
   nada. Mitigação: contrato explícito no harness (§10 da tarefa) — "SEM ESTIMATIVA → expandida"
   como teste obrigatório, com fixture de conta nova.
2b. Nutri Target: usuário que troca de "plano do nutri" para "sem plano" (ex.: nutri removeu
   plano) precisa recalcular corretamente `calculatorOpen` — já é tratado hoje pelo `useEffect`
   existente que reage a `resolved`; só o valor inicial muda, não a reatividade.
3. **Grid 2-colunas é a primeira aplicação desse padrão ao módulo do aluno** — testar
   explicitamente que nenhuma outra tela do aluno (Hoje, Treino) foi afetada (nenhum CSS
   compartilhado é tocado; o grid é local a `NutritionPlanViewPage.tsx`).
4. **Extrair `.field-label-eyebrow`** (se optado) precisa checar que não colide com nenhuma
   classe existente de nome parecido — checagem simples de grep antes de nomear.
5. **Remover `maxWidth:560` da página** pode expor, em telas muito largas (1920px+), texto
   longo de orientação de refeição numa coluna mais larga do que o confortável — mitigado pelo
   `.container` já limitar a 1060px totais e a coluna de timeline ficar em ~1.4fr desse total
   (~600-620px), dentro da faixa de leitura confortável.
6. **`MealDrawer` sem `DrawerShell`** (pré-existente) — não corrigido nesta tarefa; registrado
   para decisão futura, não bloqueia este redesign.

---

## 14. Critérios de aceite

1. Em 1440/1280/1024px, o hero "Seu dia nutricional" e o grid 2-colunas aparecem sem scroll
   vertical até pelo menos a timeline (protocolo + hero + macros + refeições visíveis
   simultaneamente).
2. kcal do hero é visivelmente maior que qualquer outro número da tela.
3. Estimativa própria já salva renderiza **compacta** por padrão em qualquer viewport; toque em
   "Editar" expande; "Salvar" recolhe de volta.
4. Estimativa nunca configurada renderiza **expandida** por padrão.
5. Meta do plano do nutri continua com badge `badge-brand` e sem "≈"; self-estimate continua com
   badge `badge-neutral` e "≈" em todo número derivado.
6. Timeline mostra a próxima refeição em destaque com orientação completa; demais refeições em
   uma linha compacta com badge de status.
7. Nenhum `scrollWidth > clientWidth` em 320/360/390/430/768/1024/1280/1440/1920.
8. Nenhum controle interativo <44px.
9. Dark e light mode legíveis (contraste preservado, nenhuma cor hardcoded nova).
10. `prefers-reduced-motion: reduce` remove a transição de expandir/colapsar.
11. Zero regressão funcional: check-in, registro de macros, cálculo de meta, parser, Truth
    Layer, P1C, consent, navegação — todos intactos (validado por harness + suíte existente).
12. `tsc`, `lint`, `build` e testes (frontend) limpos nos dois repos após a implementação.

---

## 15. Harness — contratos de UI adicionados (sem remover os existentes)

Viewports: 320, 360, 390, 430, 768, 1024, 1280, 1440, 1920 × light/dark.

Para cada viewport: `scrollWidth <= clientWidth`; hero visível sem scroll até timeline em
≥1024px; estimativa compacta quando `resolved` existe e não é o primeiro carregamento;
estimativa expandida quando `resolved === null`; badges de status legíveis (texto presente, não
só cor); controles interativos ≥44px; `aria-expanded` correto no toggle da estimativa; grid
2-colunas presente ≥980px e ausente <980px (1 coluna, ordem vertical do §6.2).

Comando de execução: reaproveita o script de QA em navegador já usado nas fases anteriores
(Chromium headless, fora do repo) — sem framework novo.

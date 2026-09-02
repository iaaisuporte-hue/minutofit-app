# MOBILE_P1_REPORT — S2CORE Mobile Experience P1 (Workout Experience)

**Data:** 02 set 2026
**Escopo:** SPEC "S2CORE Mobile Experience P1 — Workout Experience"
**Módulo:** execução de treino do aluno (prescrito e livre)
**Resultado:** **FAIL** — ver §8. Todo o trabalho de código está feito e verificado em
navegador real; o que falta é validação em aparelho, que este ambiente não permite.

---

## 0. Sobre o gate da P0 (item 58.2)

A SPEC manda confirmar que a P0 está verde antes de começar. **A P0 fechou em FAIL** — e
por um motivo que continua valendo aqui: não há aparelho Android nem projeto iOS neste
ambiente. Os 8 P0 de código estavam verdes e foram **reverificados** ao fim desta fase
(§4, regressão). O mesmo bloqueio derruba **QA-P1-25 e QA-P1-26** desta SPEC.

---

## 1. Estado inicial

Medido antes de tocar em qualquer código, com conta real e ficha de 3 dias.

### O caminho da Home até a primeira série custava 7 interações, 2 delas de teclado

```
1. "Iniciar treino →" na Home   → foi para /app/user/ficha  (NÃO iniciou o treino)
2. "Iniciar treino" na Ficha    → sessão
3. toque no campo carga
4. digitar "80"                 ← TECLADO
5. toque no campo reps
6. digitar "10"                 ← TECLADO
7. marcar a série
```

O botão da Home **dizia** "Iniciar treino →" e navegava para a lista de fichas. O rótulo
prometia uma coisa e entregava outra, e o toque seguinte era procurar um segundo botão com
o mesmo nome lá dentro.

### As ações estavam longe do polegar

Contagem na tela de sessão a 390×844: **5 controles no topo, 10 no meio, 5 na zona do
polegar**. "Finalizar treino" a 591px de um viewport de 844.

### O cronômetro sumia ao sair da tela

O `useRestTimer` trabalha com instante absoluto e o rascunho já guardava `restEndsAt`, então
o descanso nunca *parava* — mas fora da tela de treino não havia onde vê-lo. Para quem está
descansando entre séries, "não consigo ver" e "parou" são a mesma coisa.

### Já existia, e não foi refeito

Descanso automático ao concluir a série, cronômetro sobrevivendo a recarga, chip "última:
X kg", resumo pós-treino com duração/séries/aderência/volume/comparação, RPE, desconforto
por exercício, detecção de PR pelo servidor, compartilhamento (P0), e o motor de edição ao
vivo do treino livre (adicionar/reordenar/remover).

---

## 2. Mudanças implementadas

### 2.1 Início do treino — 7 → 4 interações, zero teclado

| # | Mudança | Arquivo |
|---|---|---|
| §23 | O CTA da Home passa a **iniciar o treino**. O card já sabia o dia (`pickTodayDay`); agora navega direto para a sessão. Ficha vazia continua indo para a ficha, e o rótulo muda para "Ver minha ficha →" — o botão nunca promete o que não faz | `components/PersonalWorkoutCard.tsx` |
| §26 | Folha "+ Outro treino": treino planejado · treino livre · repetir último. O CTA do card segue como caminho de um toque; a folha é o menu das alternativas | `components/StartWorkoutSheet.tsx` (novo), `TodayPage.tsx` |
| §24 | **Repetir último treino.** Sessão de ficha reabre o mesmo dia — deliberadamente **atualizado**, não congelado: quem manda no treino é quem prescreve. Sessão livre é remontada a partir da execução, com carga e reps pré-preenchidas e **nenhuma série marcada** (é referência, não execução) e `clientKey` NOVA, senão o servidor devolveria a sessão antiga como replay idempotente | `workoutSession/repeatWorkout.ts` (novo) |
| — | `exerciseId` passa a ser mapeado no detalhe da sessão. O servidor sempre devolveu a coluna (`SELECT *`); o mapeamento é que a descartava — e sem ela não dá para remontar um treino, porque sessões referenciam `exercises.id`, nunca o nome | `services/workoutSessionApi.ts` |

### 2.2 Barra de ação da série atual — o coração da fase

`SetActionBar` (novo) é uma barra fixa inferior com **a série atual**: "Série 2 de 4", a
última carga conhecida, steppers de carga e repetições, e **CONCLUIR SÉRIE**.

- **§7/§10 — steppers.** ±2,5 kg (o menor par de anilhas) e ±1 rep. A regra que faz o
  stepper valer a pena está em `setSteppers.ts` e é testada isolada: **o primeiro toque com
  o campo vazio ASSUME a referência em vez de somar sobre ela**. Quem levantou 80 kg da
  última vez toca "+" uma vez e vê 80, não 82,5. A referência é a série anterior *deste*
  treino antes da do treino passado — quem já subiu o peso hoje não quer o número da semana
  passada de volta.
- **§6/§45 — posição previsível.** O botão não muda de lugar entre exercícios; quando o
  exercício termina, a mesma posição vira "Próximo exercício →".
- **§5** — a lista de séries continua acima, porque é ela que permite corrigir uma série já
  registrada. O que saiu de lá foi a necessidade de *mirar* nela a cada série.
- **§46** — concluir série não pede confirmação: é reversível.
- Digitação manual continua disponível (§7) — o stepper é o caminho rápido, não uma prisão.

### 2.3 Timer persistente e mini-player (§12/§13)

`WorkoutMiniPlayer` (novo) mostra tempo decorrido, descanso e "Voltar" em qualquer tela.

**Decisão de arquitetura:** o mini-player **não recebe estado por contexto nem por provider**.
Ele lê o mesmo rascunho que a sessão grava e recalcula tudo a partir de instantes absolutos.
Isso o faz mostrar o número certo com a tela de treino desmontada, com o app voltando do
segundo plano, ou com o processo morto e reaberto — **sem mover nada do estado que a P0 já
tinha verificado**.

Para não duplicar o card de retomada da P0, entrou o conceito de **sessão ativa**
(`lastActivityAt` < 3h): mini-player para o treino em curso, card grande para o treino que
ficou aberto e esfriou. Sem essa distinção os dois apareciam na Hoje dizendo a mesma coisa.

### 2.4 Durante a sessão

| Item | Mudança |
|---|---|
| §4 | Tempo decorrido no cabeçalho. `startedAt` já existia; o número nunca aparecia |
| §15 | "Pular por agora" explícito. O exercício **não** é dado como concluído — fica na lista, sem séries |
| §17/§21/§22 | Editar a lista durante a sessão vale nos **dois** modos. Era exclusivo do livre, mas a máquina ocupada é problema de quem tem ficha. **A ficha original não muda**: o `prescribed` enviado ao servidor continua vindo do plano, e só a execução vem da lista editada |
| §27 | Histórico rápido do exercício, **sobre** a sessão. Endpoint novo `GET /training/exercises/:id/history` — a alternativa no cliente seria baixar N sessões inteiras para mostrar três linhas |
| §33 | Aviso de exercícios pendentes antes do resumo, depois do aviso de séries digitadas e não marcadas. Avisa, não bloqueia |
| §47 | Guarda de duplo toque (600ms). `toggleDone` **alterna**: dois toques rápidos marcavam e desmarcavam, e o segundo ainda cancelava o descanso que o primeiro iniciou |
| §38 | Vibração curta (35ms) ao concluir a série |
| §49 | "Offline — salvando no aparelho" / "Sincronizado" (some sozinho). Desde a P0 as séries já eram gravadas localmente; nada dizia isso a quem estava sem sinal |

### 2.5 Notificação de descanso (§39/§40/§41)

`@capacitor/local-notifications`, agendada **no instante em que o descanso começa**, com a
hora absoluta em que deve soar.

O ponto que decide o desenho: com a tela apagada o JavaScript congela — a mesma limitação já
registrada no `CLAUDE.md` para o GPS. Um `setTimeout` para daqui a 90 segundos simplesmente
não dispara. O aviso precisa ser entregue ao **sistema** (AlarmManager /
UNUserNotificationCenter), que o entrega mesmo com o app suspenso. É o que a §40 pede, e o
oposto do que ela proíbe: nenhum foreground service, nada mantendo a CPU acordada.

A permissão é pedida **só quando há um descanso para avisar** — mesma regra contextual que a
P0 aplicou à câmera. É cancelada ao pular o descanso e ao encerrar a sessão, senão renderia
notificação para uma série já feita.

### 2.6 Instrumentação (§51/§52)

Dez eventos no canal que já existia (`POST /user/events` → allow-list → `data_access_audit`).
**Nenhum SDK novo**, como a §51 pede.

`workout.started` · `completed` · `abandoned` · `resumed` · `set_completed` ·
`exercise_skipped` · `exercise_reordered` · `free_started` · `repeat_started` ·
`share_opened`

O payload é tipado e fechado — modo, duração, contagens. **Nenhum evento carrega carga,
repetição, nome de exercício, dor, RPE ou qualquer sinal do corpo.** Eles medem o uso da
tela, que é o que as perguntas do §52 exigem; o pacto de dados do produto não abre exceção
para analytics.

### 2.7 O que a SPEC pediu para NÃO fazer, e não foi feito

- **§9 sugestão de carga** — "caso não exista regra consolidada: não criar algoritmo novo".
  Não existe. Foi para o backlog.
- **§18 substituir exercício** — o motor não está consolidado no módulo do aluno. Backlog.
- **§37 RPE** — já existe no domínio (`session_rpe`, escala Leve/Moderado/Intenso/Máximo).
  Mantido como está.
- **§8 "80 kg × 10"** — `/training/stats` devolve só `lastLoadKg`. A barra mostra a carga,
  que é o número que decide o ajuste; as repetições ficam no histórico rápido, que lê a
  execução real. §17 é explícita sobre não inventar métrica que o domínio não tem.
- **§42 manter tela ligada** — não implementado (era "avaliar"). Backlog.
- **§16 motivos de não execução** — o aviso de pendentes entrou; a coleta de motivo não.
  Backlog.

---

## 3. Evidências

**Contagem de toques, medida antes e depois no mesmo aparelho simulado (390×844):**

```
ANTES  7 interações, 2 com teclado
DEPOIS 4 interações, ZERO teclado
   1. "Iniciar treino →" na Home  → /app/user/treino/2/1   (inicia de verdade)
   2. "+" da carga
   3. "+" das repetições
   4. CONCLUIR SÉRIE
```

**Ergonomia, nos 6 tamanhos da SPEC:**

| Viewport | CONCLUIR SÉRIE | Zona | Stepper | overflow-x |
|---|---|---|---|---|
| 320×568 | 292×48 @510 | polegar | ≥44px | 0 |
| 360×740 | 332×56 @674 | polegar | ≥44px | 0 |
| 375×667 | 347×56 @601 | polegar | ≥44px | 0 |
| 390×844 | 362×56 @778 | polegar | ≥44px | 0 |
| 412×915 | 384×56 @849 | polegar | ≥44px | 0 |
| 430×932 | 402×56 @866 | polegar | ≥44px | 0 |

**Mini-player, saindo da tela de treino:**
```
/app/user/evolucao   Treino em andamento · 0:10 · Descanso 0:58 · Voltar
descanso 0:58 → 0:54 (contando fora da tela de treino)
mini-player y=716–772 · bottom nav y=780 → não sobrepõe
"Voltar" → /app/user/treino/2/1 com o descanso intacto
```

**Repetir último treino:** abriu nova sessão livre com `2.5, 10, 2.5, 10` pré-carregados e
**0/3 séries** marcadas.

**Duplo toque:** dois taps nas mesmas coordenadas do botão grande → `1/20 → 2/20`, não 3.

Capturas: `p1-barra-390.png`, `p1-mini-390.png`, `p1-sheet-390.png`, `p1-manage-390.png`,
`p1-resumo-390.png` (diretório de trabalho do QA).

---

## 4. Testes realizados

**Ambiente:** Chromium (motor da WebView Android), autenticado, backend Node + Postgres
locais em banco criado do zero, ficha de 3 dias com 14 exercícios do catálogo.

| QA | Resultado |
|---|---|
| QA-P1-01 iniciar com 1 toque | ✅ Home → `/user/treino/2/1` |
| QA-P1-02 treino completo sem teclado | ✅ |
| QA-P1-03 alterar carga | ✅ 2.5 → 5 por toque; "−" volta |
| QA-P1-04 alterar repetições | ✅ 10 → 11 |
| QA-P1-05 concluir série | ✅ |
| QA-P1-06 timer automático | ✅ 0:59 sem pedir |
| QA-P1-07 timer após navegação | ✅ 0:58 → 0:54 fora da tela |
| QA-P1-08 mini-player | ✅ nas 3 telas testadas |
| QA-P1-09 minimizar e voltar | ✅ progresso intacto |
| QA-P1-10 bloquear/desbloquear | ✅ (recarga total) séries preservadas |
| QA-P1-11 notificação de descanso | ⚠️ **falta aparelho** |
| QA-P1-12 pular exercício | ✅ avançou sem concluir |
| QA-P1-13 reordenar | ✅ folha abre no treino **prescrito** |
| QA-P1-14 adicionar ao livre | ✅ via busca do catálogo |
| QA-P1-15 treino livre completo | ✅ mesma barra de ação, overflow 0 |
| QA-P1-16 repetir último treino | ✅ nova sessão, cargas de referência, 0 marcadas |
| QA-P1-17 finalizar com pendente | ✅ "1 exercício ainda não foi concluído." |
| QA-P1-18 finalizar completo | ✅ resumo → "Treino salvo" |
| QA-P1-19 detectar PR | ✅ caminho exercitado; sem PR nesta sessão (o servidor decide) |
| QA-P1-20 compartilhar após concluir | ✅ em destaque |
| QA-P1-21 treino offline | ✅ indicador + série lançada com a API fora do ar |
| QA-P1-22 reconectar | ✅ "Sincronizado" e some sozinho |
| QA-P1-23 duplo toque | ✅ 1 série, não 2 |
| QA-P1-24 uma mão | ✅ ação principal na zona do polegar nos 6 tamanhos |
| QA-P1-25 Android real | ❌ **impossível aqui** |
| QA-P1-26 iPhone real | ❌ **impossível aqui** |

**Regressão da P0 (item 58.16):** ✅ 6/6 — falha de rede não apaga o treino, nova tentativa
grava, treino esquecido segue anunciado, logout do personal fora do bottom nav, ícone de
conta em retrato, mini-player não duplica o aviso. Varredura completa de 19 telas × 6
viewports: **zero scroll horizontal**.

**Suítes:** 367 testes do frontend (**+40 novos**: 19 de steppers, 16 de repetir treino,
5 de sessão ativa). `tsc -b` limpo nos dois repos, `eslint` com 0 erros, `npm run build`
limpo.

> Os avisos `VAZIO` que aparecem na varredura (Glossário, Espelho, Plano) são exaustão do
> Chromium headless após 6 contextos sequenciais — reexecutados isoladamente, os três
> renderizam normalmente (3307, 538 e 1139 caracteres) com overflow 0. Mesmo achado da P0.

---

## 5. Métricas instrumentadas

Os dez eventos do §2.6 respondem às perguntas do §52:

| Pergunta do §52 | Como é respondida |
|---|---|
| Quantos iniciam e concluem | `workout.started` × `workout.completed` |
| Tempo médio de treino | `durationS` em `workout.completed` |
| Taxa de abandono | `workout.abandoned` / `started` |
| Uso de treino livre | `workout.free_started`, e `mode` em todos os demais |
| Uso de repetir treino | `workout.repeat_started` |
| Frequência de reordenação | `workout.exercise_reordered` |
| Frequência de skip | `workout.exercise_skipped` + `pendingExercises` no completed |

**LGPD:** nada além de contagens e durações. Ator e titular são a mesma pessoa (o próprio
aluno), como nas rotas irmãs.

---

## 6. Riscos residuais

1. **Nada do caminho nativo rodou em aparelho.** `@capacitor/local-notifications` é novo e o
   agendamento no AlarmManager/UNUserNotificationCenter é justamente o que não dá para
   verificar em navegador. `npx cap sync android` foi executado; **o build não**.
2. **A notificação de descanso é aproximada, por escolha.** Do Android 12 em diante um
   alarme exato exige `SCHEDULE_EXACT_ALARM` (negada por padrão no 13+) ou `USE_EXACT_ALARM`
   (que a Play Store reserva a apps de alarme e relógio). Sem elas o plugin usa
   `setAndAllowWhileIdle`, que o sistema pode atrasar alguns minutos em Doze profundo. Com a
   tela ligada quem avisa na hora é o cronômetro da própria tela, exato; a notificação é a
   rede de segurança de quem guardou o celular. Pedir permissão de alarme exato para um
   descanso de 90 segundos seria o "serviço agressivo" que a §40 proíbe.
3. **O plugin acrescenta duas permissões ao manifesto** por merge:
   `RECEIVE_BOOT_COMPLETED` (restaurar avisos após reiniciar) e `WAKE_LOCK`. Aparecem na
   listagem da Play Store e merecem uma linha na descrição do app.
4. **A barra fixa inferior mudou o layout de todas as sessões.** Medida nos 6 viewports sem
   sobreposição e sem overflow, mas é a mudança de maior superfície desta fase.
5. **Editar a lista no treino prescrito é novo.** A separação prescrito × executado foi
   verificada por leitura de código (o `prescribed` sai de `resolvedItems`, do plano) e pelo
   fluxo de QA, mas não por asserção em banco sobre uma sessão reordenada.
6. **A janela de 3h que separa sessão ativa de esquecida é um palpite calibrado**, não um
   dado. Um treino muito longo com pausa maior que 3h cairia no card de retomada — sem perda
   de dado, só um aviso deslocado.
7. **iOS segue não existindo.** Notificação local, háptico e share sheet têm semânticas
   próprias lá.

---

## 7. Backlog identificado

Registrado em `MOBILE_BACKLOG.md`. Resumo: sugestão de carga (§9, exige regra consolidada),
substituir exercício na sessão (§18, motor não consolidado no aluno), motivos de não
execução (§16), manter tela ligada (§42), repetições da última execução em `/training/stats`
(§8), e os itens de P2/P3 que a própria SPEC listou.

---

## 8. Resultado

## FAIL

Dos 18 critérios do §54, **16 estão atendidos com evidência**: iniciar com pouquíssimos
passos (7→4), execução com uma mão, concluir série direto, carga e repetições fáceis, último
desempenho acessível, timer funcionando, timer persistindo, mini-player, treino livre no
mesmo padrão, reordenação sem alterar a ficha, skip que não conclui, repetir criando nova
sessão, finalização com resumo, conclusão offline, sem registro duplicado, e regressão P0
verde.

Dois não podem ser marcados, e nenhum por opinião:

- *"testes Android estiverem verdes"* e *"testes iOS estiverem verdes"* — **não há aparelho
  Android, não há SDK, e o projeto iOS não existe**. Junto deles cai **QA-P1-11**
  (notificação de descanso), que só se verifica com o app suspenso num aparelho.

**Para fechar:** `npx cap sync android`, gerar o build e executar QA-P1-11/25 num Android
físico — e, para iOS, criar antes a plataforma num macOS.

# MOBILE_BACKLOG — visão consolidada

**Consolidado em:** 03 set 2026, no fechamento da trilha mobile (P0–P3).
**Origem:** unifica os backlogs acumulados nas quatro fases, sem perder histórico.
**Regra:** nada aqui é implementado sem decisão explícita. O fechamento (§22) proíbe
escolher o próximo item automaticamente.

Cada item traz a fase em que apareceu e a severidade. As severidades seguem a convenção do
fechamento: **P0** grave · **P1** atrito real de UX · **P2** melhoria desejável ·
**FUTURE** ideia de produto.

---

## 1. MOBILE UX

### 1.1 Alvos de toque de 29–38px em controles autônomos — P1 · *(P0)*
Sobraram após a varredura: `Configurar agora` (123×29), `Escolher nutricionista` (92×29),
`Ver demonstração` (126×31), `Recarregar` (118×37), seletores do Lab (~120×38),
`Localização desativada` (314×34), `7d` (33×23), aba `IA` do cockpit (38×44).
**Sugestão:** um utilitário de chip com piso de 44px no design system, aplicado de uma vez,
em vez de oito correções pontuais.

### 1.2 Doze diálogos ainda sem `Escape` — P1 · *(fechamento)*
A auditoria do fechamento encontrou **16** diálogos com `role="dialog"` que não escutavam
`Escape` — e o botão voltar do Android os detectava e **engolia o gesto sem fechar nada**.
Os do fluxo de treino foram corrigidos com `useDismissable`. Faltam:
`HomeWorkoutsPage`, `MetabolicScoreCard`, `DailyCheckin`, `WorkoutLogSheet`,
`CookieConsentBanner`, `MetabolicCheckinModal`, `LocationDisclosure`, `RegisterTypeSheet`,
`AccountDataSection`, `ConfirmModal` (team), e os diálogos de academia/personal.
**O hook já existe** (`lib/overlayStack.ts`); é aplicá-lo.

### 1.3 Área de toque do `?` não vence pelo lado de cima — P2 · *(P0)*
`.hit-target-44` levou o alvo de 16×16 para ~44×36: acerta no centro, esquerda, direita e
embaixo; perde para uma `div` vizinha 18px acima. Resolver exige mexer no contexto de
empilhamento da Hoje.

### 1.4 Links inline: revisar caso a caso — P2 · *(P0)*
Alvos de 18–28px dentro de frase são **isentos** pela WCAG 2.5.8 e foram deixados de
propósito. Alguns talvez devessem virar botões autônomos por hierarquia — decisão de design,
não de acessibilidade. Candidatos: "Registrar no painel do dia →" e "Ver leitura completa →".

### 1.5 Botão "Entrar" sob o teclado em 320×568 — P1 · *(P0)*
Com teclado de 268px o campo de senha fica visível (295 de 300px), o botão fica em 355px. Em
320×568 não cabem os dois. Alternativas: submeter no "ir" do teclado, ou barra de ação
ancorada ao teclado.

### 1.6 Faixa de sistema no tema escuro — P1 · *(P0)*
`AppTheme` herda de `Theme.AppCompat.Light.DarkActionBar` enquanto o app tem tema próprio.
Com edge-to-edge, a área atrás das barras mostra o fundo da janela — possível tira clara com
o app em escuro. Exige aparelho para escolher a cor e um build para validar splash e
diálogos nativos.

### 1.7 Aparelhar Admin, Academia e Nutri para mobile — P2 · *(P0)*
A regra de 44px em `.btn`/`.input` (≤719px) alcança essas áreas, que **não foram
auditadas** — o escopo foi limitado aos módulos publicados. Vale a mesma varredura.

### 1.8 Fila de sincronização automática — P1 · *(P0/P1/P2)*
Treino e atividade já são idempotentes por `client_key`, então o reenvio automático é
seguro. Falta a fila: hoje o reenvio continua sendo um toque do usuário ("Tentar novamente").

### 1.9 Indicador de sincronização — ✅ RESOLVIDO na P1/P2
"Offline — salvando no aparelho" e "Sincronizado" existem na sessão de treino e na atividade.
O reenvio automático virou o item 1.8.

### 1.10 "Manter tela ligada durante o treino" — P2 · *(P1)*
A SPEC P1 §42 pede para **avaliar**, desligado por padrão. Precisa de `@capacitor/keep-awake`,
uma preferência persistida e uma decisão sobre onde ela mora.

### 1.11 Auto Pause na atividade — P2 · *(P2)*
A SPEC P2 §23 permite adiar. Com o filtro de ruído e o rascunho de pausas prontos, a base
existe: detectar N leituras abaixo do limiar e pausar sozinho. Falta decidir o limiar por
modalidade e o que fazer no falso positivo (semáforo × fim do treino).

### 1.12 Motivos de exercício não executado — P2 · *(P1)*
O aviso de pendentes entrou (§33); a coleta opcional do motivo — equipamento ocupado, dor,
sem tempo — não. Vale junto com a decisão do que fazer com o dado.

### 1.13 Repetições da última execução em `/training/stats` — P2 · *(P1)*
A SPEC P1 §8 mostra "80 kg × 10". O endpoint devolve só a carga. Acrescentar `lastReps` ao
`exerciseProgression` fecha a lacuna com uma linha de SQL.

### 1.14 Janela de "sessão ativa" (3h) é palpite calibrado — P2 · *(P1)*
Escolhida por raciocínio, não por dado. Com `workout.abandoned` e `workout.resumed`
instrumentados, dá para calibrar.

### 1.15 Sugestão da próxima carga — P1 · *(P1)*
A SPEC P1 §9 autoriza **apenas se já existir lógica segura e determinística**. Não existe.
Exige decidir a regra (linear? por RPE? por reps na falha?) e validá-la — trabalho de produto
com consequência física para o aluno.

### 1.16 Substituir exercício durante a sessão — P1 · *(P1)*
Condicional da SPEC P1 §18: "caso o projeto já possua motor de substituição". O motor de
adaptação existe do lado do personal/readiness, mas **não está consolidado como escolha do
aluno dentro da sessão**. Hoje a saída é reordenar ou remover e adicionar outro.

---

## 2. NATIVE INTEGRATIONS

> Todos os itens desta seção estão classificados como **NATIVE VALIDATION PENDING**. Não são
> falha de implementação: são trabalho que exige JDK + Android SDK e macOS + Xcode, nenhum
> dos quais existe no ambiente em que a trilha foi executada. Cada um está **especificado**
> em `ACTIVITY_DEVICE_ARCHITECTURE.md` §7, com arquivos, permissões, lifecycle e plano de
> teste, contra portas que já existem no código.

### 2.1 Widget Android — *(P2)*
Glance, quatro estados, snapshot em `SharedPreferences`. Deep link
`s2core://workout/today?from=widget` já traduzido, validado e instrumentado.

### 2.2 Widget iOS — *(P2)*
WidgetKit, target de extensão, App Group `group.com.s2core.app`.

### 2.3 Health Connect — *(P2)*
`androidx.health.connect:connect-client`, seis permissões de leitura, `activity-alias` de
rationale exigido pela Play. Porta `HealthDataProvider` pronta; `provedorDeSaude()` devolve
`null` e a ausência é detectável.

### 2.4 HealthKit — *(P2)*
`HKWorkoutType` + rota. Peculiaridade: HealthKit **não informa** se a leitura foi negada.

### 2.5 Foreground Service (Android) e Background Location (iOS) — *(P2)*
**O maior limitador da camada de atividade.** Na web o JS congela em segundo plano: uma
corrida de 40 minutos com o telefone no bolso registra os primeiros segundos.
`WebLocationTracker.suportaSegundoPlano` é `false` e diz a verdade.

### 2.6 Quick Actions — *(P2)*
`shortcuts.xml` e `UIApplicationShortcutItems`, quatro atalhos apontando para
`s2core://...?from=quick_action`.

### 2.7 Projeto iOS não existe — *(P0)*
Não há diretório `ios/`. Criar a plataforma e validar safe areas com Dynamic Island, photo
picker, share sheet e swipe-back é trabalho próprio, com macOS.

### 2.8 Testes em aparelho real e consumo de bateria — *(P0/P1/P2)*
Câmera, galeria, share sheet, notificação de descanso, gesture navigation, notch, suspensão
do processo, e as medições de 30/60/90 min com `dumpsys batterystats`.

### 2.9 Cobertura de teste do caminho nativo — P2 · *(P0)*
`nativeShare.ts` é testado com a camada mockada. Um teste em emulador/aparelho (Appium ou
similar) fecharia a lacuna.

### 2.10 Supressão de reimporte após exclusão — P2 · *(P2)*
Consequência documentada da decisão do §67: excluir aqui não apaga da fonte, então a
atividade pode voltar. Precisa de decisão: suprimir para sempre ou até reconectar a fonte?

### 2.11 Tela de Integrações — P2 · *(P2)*
Especificada (P2 §48–§50) e não construída: sem provedor implementado, mostraria só
"indisponível". Deve nascer **junto** com o primeiro adapter.

### 2.12 Calibrar a janela de deduplicação — P2 · *(P2)*
Os ±3 min e a tolerância de duração são raciocínio, não dado. `possible_duplicate_of` já é
gravado — dá para medir o falso positivo antes de mexer.

### 2.13 Consumir as calorias medidas — P2 · *(P2)*
`calories` (da fonte) e `calories_estimated` (nossa) convivem; nenhum consumidor prefere a
medida quando ela existe. É conservador e correto, mas é dado bom sem uso.

---

## 3. READINESS / INTELLIGENCE

> A P3 está **implementada e congelada**, protegida por feature flag desligada em todos os
> planos. Ver `READINESS_ALGORITHM_V1.md` e `READINESS_ARCHITECTURE.md`. Nada desta seção é
> retomado antes de existirem as fontes fisiológicas.

### 3.1 Fontes de HRV, FC de repouso e duração de sono — P1 · *(P3)*
**O limitador do motor.** `hrvScore` e `restingHrScore` estão implementados e testados e
**nunca recebem dado**: dependem do `HealthDataProvider` (item 2.3/2.4). A cobertura fica em
0,24–0,88 e o card se marca como *experimental* enquanto isso. Quando existir: preencher no
repositório, calcular as medianas de 28 dias, recalibrar os pesos, subir para `1.1`.

### 3.2 Intensidade de dor no check-in — P1 · *(P3)*
`in_pain` é booleano e a tradução é conservadora (`moderate`, nunca `high`). Consequência: **o
veto de dor alta (teto de 40) nunca dispara hoje**, embora implementado e testado. Oferecer
nenhuma/leve/moderada/alta ativa o caminho, e é barato.

### 3.3 Tela da visão do Personal — P1 · *(P3)*
`obterResumoParaPersonal` está implementado e testado, incluindo a minimização (§28). Falta a
rota com `requireActiveConsent` e o card no cockpit.

### 3.4 Primeiro treino de um grupo lê 0% de recuperação — P2 · *(P3)*
Sem pico histórico, a própria carga vira a referência e o déficit é máximo. Autocorrige
quando o baseline tem dado, mas a primeira leitura é mais dura do que deveria.

### 3.5 Calibrar os pesos — P2 · *(P3)*
Escolhidos pela confiabilidade das fontes, não medidos. `workout_effort_feedback` já grava a
percepção pós-treino **com a previsão congelada**. Falta a análise, e ela só faz sentido
depois de algum volume de rollout.

### 3.6 Duração de sono no `SleepScore` — P2 · *(P3)*
Hoje usa só o booleano + baseline. A estrutura já aceita `durationHours` com validação de
plausibilidade; falta a fonte. Número fixo de horas ("8h") segue proibido pela §12.

---

## 4. WEARABLES

### 4.1 Garmin — FUTURE · *(P2)*
Duas vias, **não equivalentes** — o modelo não deve fingir que são:
- **Ecossistema:** Garmin → Health Connect / Apple Health → S2Core. Já suportada pelo modelo
  canônico (`source='garmin'` no enum, `source_app` guarda a procedência real).
- **API direta:** OAuth. Chega muito mais (voltas, cadência, potência, HRV), com obrigações
  contratuais e de revisão que a via ecossistema não tem.

### 4.2 Strava — FUTURE · *(P2)*
Importar, exportar, vincular conta, compartilhar. OAuth e API em fase própria, com aprovação
explícita.

### 4.3 Apple Watch e Wear OS — FUTURE
Advanced metrics. Proibido pela SPEC P3 §80 sem spec própria.

### 4.4 Live Activity e Dynamic Island — FUTURE · *(P1/P2)*

---

## 5. FUTURE PRODUCT

> Itens que as SPECs marcaram como **proibidos sem spec própria e aprovação explícita**.
> Estão aqui para não se perderem, não para serem escolhidos.

- **Machine learning** e modelos preditivos treinados com usuários *(P3 §80)*
- **LLM Coach** e LLM calculando score *(P3 §48/§49/§80)*
- **Diagnóstico, previsão de lesão, prescrição médica** *(P3 §80)*
- **Ajuste autônomo de dieta ou de treino** *(P3 §80)*
- Widget de tela inicial com Readiness *(P3 §54)*
- Notificação matinal de check-in *(P3 §55)*
- Mapa social, heatmap, segmentos, KOM, ranking *(P2 §34)*
- Feed genérico, grafo de amigos, perfil público — **anti-escopo permanente** do `CLAUDE.md`
- "Atividade da Turma" / mural contextual e reações simples — reservados para avaliação
  futura, condicionados à evidência pós-C2/C3 *(Spec 034)*

---

## Observações de método

Cinco lições que a trilha produziu, registradas para a próxima auditoria:

1. **Medir layout com a página em `scrollY=0` produz falso positivo em massa.** A varredura
   automática da P0 acusou 28 "ações cobertas pela barra" que eram **todas** falso positivo.
   Verificar com `scrollIntoView` antes de reportar.

2. **Uma tela pode falhar no QA sem ter defeito.** Chip "coberto" pela barra fixa e telas
   "vazias" em alguns viewports eram artefato do teste — DOM em transição e exaustão do
   Chromium após seis contextos. Medir de novo, isolado, antes de reportar.

3. **Um filtro de ruído se testa com ruído REAL.** O primeiro teste de deriva de GPS simulava
   o aparelho parado como marcha em linha reta, e o filtro corretamente contou aquilo como
   caminhada. Deriva de verdade oscila em torno de um ponto. Consertar o código achando que
   era ele teria quebrado a detecção de caminhada lenta legítima.

4. **Convenção invisível quebra longe da causa.** As migrations da P2 e da P3 usaram a API de
   builder do `node-pg-migrate`, mas da 1823 em diante o repositório usa SQL cru — porque o
   helper de integração as reexecuta com um `pgm` mínimo. Resultado: 17 suítes falhando com
   `pgm.func is not a function`, nenhuma relacionada ao que tinha mudado. Ler as migrations
   vizinhas antes de escrever a próxima.

5. **Contar `env(safe-area-inset-*)` no código não prova safe area.** O app tinha os tokens
   certos em 18 lugares e ainda assim desenhava sob as barras do sistema, porque a causa
   estava na configuração do Capacitor. Auditoria de app empacotado precisa ler a config
   nativa, não só o CSS.

6. **Um contrato que "todo mundo já implementa" precisa ser verificado.** O botão voltar da
   P0 disparava `Escape` assumindo que os diálogos escutavam. Dezesseis não escutavam — e o
   gesto era engolido em silêncio. Registro explícito (`overlayStack`) em vez de evento
   esperançoso.

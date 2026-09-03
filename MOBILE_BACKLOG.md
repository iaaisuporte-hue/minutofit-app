# MOBILE_BACKLOG — achados fora do escopo do P0

Registrado conforme SPEC §42: o que apareceu durante a auditoria e **não** foi implementado,
para não expandir a SPEC. Nada aqui foi tocado no P0.

Classificação: **P1** = atrito real, próximo ciclo · **P2** = melhoria · **Future** = fase própria.

---

## P1

### 1. Alvos de toque de 29–38px em controles autônomos
Sobraram depois da varredura do P0, todos entre 29 e 38px — acima do pior caso, abaixo do
mínimo. Não entraram porque cada um mora num estilo inline diferente e exigiria re-verificar
o layout de cada tela:

| Controle | Tamanho | Tela |
|---|---|---|
| `Configurar agora` | 123×29 | Hoje |
| `Escolher nutricionista…` | 92×29 | Minha equipe |
| `Ver demonstração` | 126×31 | Sugestão de treino |
| `Recarregar` | 118×37 | Sugestão de treino |
| `Rosca Direta` / `Elevação Lateral` | ~120×38 | Movement Lab, Espelho |
| `Localização desativada — toque para rever` | 314×34 | Tracker |
| `7d` (seletor de período) | 33×23 | Hoje |
| `IA` (aba do cockpit) | 38×44 | Personal › Aluno |

**Sugestão:** um utilitário de chip com piso de 44px no design system, aplicado de uma vez,
em vez de oito correções pontuais.

### 2. Indicador de sincronização (§24) — ✅ RESOLVIDO NA P1
A SPEC pede estados discretos "Salvo / Salvando… / Sincronização pendente / Erro ao
sincronizar". A P1 §49 entregou: "Offline — salvando no aparelho" durante a sessão e
"Sincronizado" ao reconectar, que some sozinho. O reenvio automático continua pendente —
virou o item 16.

### 3. Fila de sincronização real (§23) — movido para o item 16
Consolidado com o achado equivalente da P1 para não haver duas entradas para o mesmo
trabalho.

### 4. Faixa de sistema no tema escuro (§30)
`AppTheme` herda de `Theme.AppCompat.Light.DarkActionBar` enquanto o app tem tema próprio.
Com edge-to-edge, a área atrás das barras mostra o fundo da janela — possível tira clara com
o app em escuro. Exige aparelho para escolher a cor e um build para validar splash e
diálogos nativos.

### 5. Botão "Entrar" sob o teclado em 320×568
Medido: com teclado de 268px o campo de senha fica visível (295 de 300px), o botão fica em
355px. Em 320×568 não cabem os dois. Alternativas: submeter no "ir" do teclado, ou uma barra
de ação ancorada ao teclado.

---

## P1 — surgido durante a P1 (Workout Experience)

### 11. Sugestão da próxima carga (SPEC P1 §9)
A SPEC autoriza exibir "Sugestão: 82,5 kg" **apenas se já existir lógica segura e
determinística no produto**, e manda não criar algoritmo novo. Não existe: `/training/stats`
devolve `lastLoadKg` e a progressão bruta, sem regra de incremento. Fazer isso direito exige
decidir a regra (linear? por RPE? por reps na falha?) e validá-la — trabalho de produto com
consequência física para o aluno, não um cálculo a mais na tela.

### 12. Substituir exercício durante a sessão (SPEC P1 §18)
Mesma condicional: "caso o projeto já possua motor de substituição". O motor de adaptação
existe do lado do personal/readiness, mas não está consolidado como escolha do aluno dentro
da sessão. Hoje a saída é reordenar (que entrou) ou remover e adicionar outro.

### 13. Repetições da última execução em `/training/stats` (SPEC P1 §8)
A §8 mostra "Último treino: 80 kg × 10". O endpoint devolve só a carga, então a barra exibe
`Último: 80 kg` e as repetições ficam no histórico rápido (§27). Acrescentar `lastReps` ao
`exerciseProgression` fecharia a lacuna com uma linha de SQL.

### 14. Motivos de exercício não executado (SPEC P1 §16)
O aviso de pendentes entrou (§33); a coleta opcional do motivo — equipamento ocupado, dor,
sem tempo — não. Vale junto com a decisão de o que fazer com o dado: sem consumidor, é
pergunta que só custa um toque.

### 15. "Manter tela ligada durante o treino" (SPEC P1 §42)
A SPEC pede para **avaliar**, desligado por padrão. Precisa de `@capacitor/keep-awake` e de
uma preferência persistida — e de uma decisão sobre onde essa preferência mora, já que hoje
não existe tela de configurações do treino.

### 16. Fila de sincronização automática — parcialmente resolvido na P2
Herdado da P0 (item 3). A P1 acrescentou o indicador; a P2 acrescentou `client_key` também
na **atividade**, então as duas pontas já são idempotentes e um reenvio automático é seguro.
Falta a fila em si: hoje o reenvio continua sendo um toque do usuário.

### 17. Janela de "sessão ativa" é um palpite calibrado
As 3h que separam o mini-player do card de retomada foram escolhidas por raciocínio (um
treino longo com pausa para o almoço ainda é o mesmo treino; o de ontem à noite não), não
por dado. Com `workout.abandoned` e `workout.resumed` instrumentados, dá para calibrar.

---

## P2

### 18. Área de toque do `?` não vence pelo lado de cima
`.hit-target-44` levou o alvo de 16×16 para ~44×36: acerta no centro, esquerda, direita e
embaixo; perde para uma `div` vizinha 18px acima. Resolver exige mexer no contexto de
empilhamento da Hoje.

### 19. Links inline: revisar caso a caso
Os alvos de 18–28px em frase são **isentos** pela WCAG 2.5.8 e foram deixados de propósito.
Alguns talvez devessem virar botões autônomos por hierarquia — decisão de design, não de
acessibilidade. Candidatos: "Registrar no painel do dia →" (176×28) e
"Ver leitura completa →" (largura total × 18).

### 20. Projeto iOS não existe
Não há `ios/`. Criar a plataforma, validar safe areas com Dynamic Island, photo picker,
share sheet e swipe-back (§33) é trabalho próprio, com macOS.

### 21. Aparelhar as demais áreas para mobile
A regra de 44px em `.btn`/`.input` (≤719px) alcança Admin, Academia e Nutri, que **não foram
auditados** — a SPEC limitou o escopo aos módulos publicados. Vale a mesma varredura.

### 22. Cobertura de teste do caminho nativo
`nativeShare.ts` é testado com a camada mockada. Um teste de integração em emulador/aparelho
(Appium ou similar) fecharia a lacuna que causou o FAIL desta entrega.

---

## Surgido durante a P2 (Activity & Device Layer)

### 23. Tracking com a tela apagada exige camada nativa — P1
O risco número um da P2. Na camada web o JS congela em segundo plano e o tracking para: uma
corrida de 40 minutos com o telefone no bolso registra os primeiros segundos. A porta
`LocationTracker` já existe e `suportaSegundoPlano` já diz a verdade; falta o adapter com
foreground service (Android) e background location (iOS). Especificado em
`ACTIVITY_DEVICE_ARCHITECTURE.md` §7.1.

### 24. Auto Pause (SPEC P2 §23) — P2
A SPEC permite adiar explicitamente ("caso não exista base confiável, adicionar ao
backlog"). Com o filtro de ruído e o rascunho de pausas já prontos, a base agora existe:
detectar N leituras consecutivas abaixo do limiar de movimento e pausar sozinho. Falta
decidir o limiar por modalidade e o que fazer no falso positivo (semáforo × fim do treino).

### 25. Supressão de reimporte após exclusão — P2
Consequência documentada da decisão do §67: excluir aqui não apaga da fonte, então a
atividade pode voltar na próxima sincronização. A saída é uma lista de
`(source, source_external_id)` suprimidos, consultada na ingestão. Barato, mas precisa de
decisão de produto: suprimir para sempre ou até o usuário reconectar a fonte?

### 26. Consumir as calorias medidas — P2
`calories` (da fonte) e `calories_estimated` (nossa) convivem, e nenhum consumidor foi
atualizado para preferir a medida quando ela existe. Os motores seguem lendo a estimativa.
É conservador e correto, mas é dado bom sem uso.

### 27. Calibrar a janela de deduplicação — P2
Os ±3 min e a tolerância de duração são raciocínio, não dado. Com `activity.completed`
instrumentado e o campo `possible_duplicate_of` gravado, dá para medir a taxa de falso
positivo antes de mexer.

### 28. Tela de Integrações (SPEC P2 §48–§50) — P2
Especificada e não construída: sem provedor de saúde implementado, ela mostraria só
"indisponível nesta versão". Deve nascer **junto** com o primeiro adapter, com estado
(conectado / não conectado / permissão parcial), "Sincronizar agora" e data da última
sincronização.

---

## Surgido durante a P3 (Readiness)

### 29. Fontes de HRV, FC de repouso e duração de sono — P1
O maior limitador do motor. Os componentes `hrvScore` e `restingHrScore` estão
implementados e testados, mas **nunca recebem dado**: dependem do
`HealthDataProvider` que a P2 deixou especificado e não implementado (falta toolchain
nativa). Enquanto isso a cobertura fica em 0,24–0,88 e a confiança reflete — honestamente,
mas um "Readiness" sem HRV é leitura mais pobre do que o nome sugere. Quando existir:
preencher no repositório, calcular as medianas de 28 dias, recalibrar os pesos e subir para
`ALGORITHM_VERSION = 1.1`.

### 30. Intensidade de dor no check-in — P1
`in_pain` é booleano e a tradução para o motor é conservadora (`moderate`, nunca `high`) —
um booleano não afirma intensidade. Consequência: **o veto de dor alta (teto de 40) nunca
dispara hoje**, embora esteja implementado e testado. Oferecer nenhuma/leve/moderada/alta no
check-in ativa o caminho, e é barato.

### 31. Tela da visão do Personal (SPEC P3 §27) — P1
`obterResumoParaPersonal` está implementado e testado, incluindo a minimização (§28: só
score, estado, confiança, motivos e grupos — nunca componentes nem registro de saúde). Falta
a rota com `requireActiveConsent` e o card no cockpit do aluno.

### 32. Primeiro treino de um grupo lê 0% de recuperação — P2
Sem pico histórico, a própria carga vira a referência e o déficit é máximo: o primeiro treino
de peito da vida da pessoa mostra "Peito 0%". Autocorrige quando o baseline tem dado, mas a
primeira leitura é mais dura do que deveria. Uma referência inicial conservadora resolveria —
sem cair no "comparar todo mundo com o mesmo absoluto" que a §10 proíbe.

### 33. Calibrar os pesos com o feedback já coletado — P2
Os pesos foram escolhidos pela confiabilidade das fontes, não medidos.
`workout_effort_feedback` já grava a percepção pós-treino **com a previsão congelada** (§45,
§47) — o material da calibração está sendo acumulado. Falta a análise, e ela só faz sentido
depois de algum volume de rollout.

### 34. Duração de sono no `SleepScore` — P2
Hoje o componente usa só o booleano `slept_well` + baseline. A estrutura já aceita
`durationHours` (com validação de plausibilidade); falta a fonte. Um número fixo de horas
("8h") segue proibido pela §12.

---

## P3 — explicitamente fora, conforme a SPEC P1 §57, P2 §86–§88 e P3 §80

**Não implementar sem SPEC própria.**

- HRV
- Body Battery
- Training Readiness
- Qualidade do sono · recovery · carga fisiológica
- Recomendação de treino e adaptação automática de intensidade
- Motor de decisão "Como você está hoje?"
- Inteligência baseada em múltiplas métricas

### S2CORE Readiness Engine — ✅ IMPLEMENTADO NA P3
Saiu do backlog. As duas amarras que este item registrava foram cumpridas: breakdown
obrigatório imposto pelo CHECK do banco, e recomendação que nunca substitui a decisão do
humano (a ficha não é alterada; o Personal segue sendo autoridade). Ver
`READINESS_ARCHITECTURE.md` e `READINESS_ALGORITHM_V1.md`. O que resta são os itens 29–34
acima.

### Proibições permanentes da SPEC P3 §80
Não implementar sem SPEC própria e aprovação explícita:
- Machine learning e modelos preditivos treinados com usuários
- LLM Coach · LLM calculando score
- Diagnóstico · previsão de lesão · prescrição médica
- Ajuste autônomo de dieta ou de treino
- Apple Watch / Wear OS advanced metrics

### Garmin (SPEC P2 §87)
Duas vias, e **elas não são equivalentes** — o modelo não deve fingir que são:
- **Via ecossistema:** Garmin → Health Connect / Apple Health → S2Core. Já suportada pelo
  modelo canônico (`source='garmin'` está no enum, `source_app` guarda a procedência real).
  Chega o que o agregador expõe: sessão, distância, FC, às vezes rota.
- **Via API direta:** OAuth com a Garmin. Chega muito mais (voltas, cadência, potência,
  HRV), e vem com obrigações contratuais e de revisão que a via ecossistema não tem.

### Strava (SPEC P2 §88)
Importar, exportar, vincular conta, compartilhar. OAuth e API em fase própria, com aprovação
explícita — a SPEC P2 proíbe implementar sem ela.

---

## Future — explicitamente fora, conforme §42

Registrados só para não se perderem. **Não implementar sem SPEC própria.**

- Widget Android / iOS
- GPS tracker completo, mapa de corrida, distância, ritmo
- Health Connect · Apple Health · Garmin
- Workout Live Activity (iOS)
- Wear OS · Apple Watch
- Notificações inteligentes
- Readiness e recomendação automática de treino
- Caminhada, corrida e bike como tipos de sessão (SPEC P1 §26 e §56)
- Distância, pace, velocidade, mapa e route tracking
- Sensores: frequência cardíaca, passos, calorias de wearable

---

## Observação de método

Duas lições que valem para a próxima auditoria mobile:

1. **Medir com a página em `scrollY=0` produz falso positivo em massa** — já registrado no
   QA de ago/2026 e confirmado de novo aqui: sempre `scrollIntoView` antes de reportar.
2. **Uma tela pode falhar no QA sem ter defeito.** Dois bloqueios desta rodada — o chip de
   histórico "coberto" pela barra fixa e telas "vazias" em alguns viewports — eram artefato
   do próprio teste (DOM em transição e exaustão do Chromium após 6 contextos). Medir de
   novo, isolado, antes de reportar; foi o que separou o defeito real do ruído.
3. **Um filtro de ruído se testa com ruído REAL, não com o que parece ruído.** O primeiro
   teste da deriva de GPS simulava o aparelho parado como uma marcha em linha reta de 2 m —
   e o filtro, corretamente, contou aquilo como caminhada. Deriva de verdade OSCILA em torno
   de um ponto. O teste é que estava errado; consertá-lo achando que era o código teria
   quebrado a detecção de caminhada lenta legítima.
4. **Convenção invisível quebra longe da causa.** As migrations desta série usaram a API de
   builder do `node-pg-migrate`, mas da 1823 em diante o repositório usa SQL cru — porque o
   helper de integração reexecuta as migrations com um `pgm` mínimo. O resultado foram 17
   suítes falhando com `pgm.func is not a function`, nenhuma delas relacionada ao que eu
   tinha mudado. Antes de escrever migration nova, ler as vizinhas.
5. **Contar `env(safe-area-inset-*)` no código não prova safe area** — o app tinha os tokens
   certos em 18 lugares e ainda assim desenhava sob as barras do sistema, porque a causa
   estava na configuração do Capacitor. Auditoria mobile de app empacotado precisa ler a
   config nativa, não só o CSS.

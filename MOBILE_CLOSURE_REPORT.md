# MOBILE_CLOSURE_REPORT — encerramento da trilha mobile S2CORE

**Data:** 03 set 2026
**Escopo:** encerramento formal de P0 · P1 · P2 · P3 e congelamento de escopo
**Estado final:** **READY FOR INTERNAL TESTING**

---

## 1. Resumo executivo

A trilha começou com uma pergunta simples: *o aplicativo funciona bem no celular?* Quatro
fases depois, a resposta honesta é **quase** — e o "quase" tem endereço.

O que a trilha entregou, em uma linha cada:

- **P0** consertou o que impedia usar o app no celular, inclusive um defeito que **apagava o
  treino do aluno** e dizia que tinha salvo.
- **P1** tornou o treino operável com uma mão: **7 interações viraram 4, e nenhuma exige
  teclado**.
- **P2** deu ao app um modelo de atividade com procedência e deduplicação, e consertou uma
  distância de GPS que **inflava sistematicamente**.
- **P3** construiu o motor de prontidão — determinístico, explicável e **desligado**, porque
  metade das entradas fisiológicas ainda não tem fonte.

Três defeitos merecem destaque porque nenhum apareceria sem QA executado de verdade:

| Defeito | Fase | Consequência real |
|---|---|---|
| `confirmFinish` engolia a falha de rede, apagava o rascunho e exibia "Treino salvo" | P0 | **Zero linhas no banco.** Bastava o elevador da academia |
| Distância somava todos os pontos do GPS, sem filtro | P2 | 490 m reais viravam ~1,5 km. Pace, calorias e score derivavam do número inflado |
| Média de recuperação só contava grupos **com** carga | P3 | Um treino de perna comum zerava a prontidão geral: score 0 → "Hoje é recuperação" |

E dois no fechamento, sobre trabalho meu de fases anteriores — registrados porque a lição
importa mais que o conserto:

| Defeito | Onde nasceu |
|---|---|
| 16 diálogos com `role="dialog"` que não escutavam `Escape` — o botão voltar do Android **engolia o gesto sem fechar nada** | P0 §32: assumi um contrato que não era universal |
| Migrations da P2 e da P3 usando a API de builder, derrubando **17 suítes de integração** | Convenção invisível: da migration 1823 em diante o repositório usa SQL cru |

---

## 2. P0 — Mobile UX Hardening

**Status: PASS (código) / NATIVE VALIDATION PENDING**

O relatório original fechou em FAIL por não haver aparelho. Reclassificado aqui: **os 8 P0
de código estão corrigidos e verificados**, e o que falta é validação em hardware — que a
regra do fechamento (§4) manda classificar como pendência nativa, não como falha.

Principais entregas:

- **Perda de treino na falha de rede** — o `catch` comentado como "gamificação best-effort"
  envolvia o registro inteiro. Agora preserva o rascunho e oferece nova tentativa; o reenvio
  é seguro porque o servidor deduplica pela chave natural sob advisory lock.
- **Recuperação de sessão** — o rascunho sempre sobreviveu; faltava um lugar onde ele
  aparecesse. Card na Hoje e na Ficha, com Continuar / Encerrar.
- **Safe areas** — `targetSdk 36` impõe edge-to-edge no Android 15+, e o padrão do Capacitor
  para `adjustMarginsForEdgeToEdge` é `"disable"`. O conteúdo passava sob a status bar e a
  barra de gestos. `env(safe-area-inset-*)` não resolvia: numa WebView ele reporta o recorte
  do display, não as barras.
- **Share sheet e salvar imagem** — `navigator.share` não existe na WebView do Android (o
  botão principal **sumia**) e `<a download>` é inerte. Camada nativa com `@capacitor/share`,
  `/filesystem` e `/camera`.
- **Logout do personal** — era o 6º slot do bottom nav, vizinho de "Programas", e derrubava a
  sessão **sem perguntar**. Voltou a 5 destinos; logout no Perfil com confirmação.
- **"Meu perfil" do personal** — só existia na sidebar ≥980px: era preciso **deitar o
  celular** para trocar tema ou sair.
- **Teclado** — campo em foco a 517px com 410 visíveis, junto do botão de concluir a série.
- **Alvos de toque** — o ícone de Mensagens do aluno media 32×32 em todas as telas.

**Zero scroll horizontal** em 30 telas × 6 viewports.

## 3. P1 — Workout Experience

**Status: PASS (código) / NATIVE VALIDATION PENDING**

Também reclassificado: 16 dos 18 critérios do §54 verificados; os dois restantes são Android
e iOS reais.

**O número da fase: 7 → 4 interações, zero teclado.** E o botão da Home **mentia** — dizia
"Iniciar treino →" e navegava para a lista de fichas.

- **Barra de ação da série atual**, fixa na zona do polegar, posição que não muda entre
  exercícios. Steppers de ±2,5 kg e ±1 rep; o primeiro toque no "+" **assume a referência**
  em vez de somar sobre ela.
- **Mini-player** com tempo e descanso em qualquer tela. Sem contexto nem provider: lê o
  mesmo rascunho e recalcula de instantes absolutos, então acerta com a tela desmontada e
  depois do processo morrer.
- **Repetir último treino**, edição da lista no treino prescrito, histórico rápido do
  exercício, aviso de pendentes, guarda de duplo toque, notificação de descanso agendada no
  sistema (aproximada de propósito — alarme exato exigiria permissão de app de relógio).

## 4. P2 — Activity & Device Layer

**Status: PARTIAL — CORE VERIFIED / NATIVE VALIDATION PENDING**

**Verificado:** modelo canônico de atividade com procedência, deduplicação em três camadas
contra Postgres real, filtro de ruído GPS, persistência incremental e recuperação, sync
idempotente e offline, deep links com allow-list, compartilhamento reusando a P0, analytics
com payload de tipo fechado.

**A terceira defesa de dedup nunca descarta** — grava e marca `possible_duplicate_of`. Um
duplicado visível é um incômodo que o usuário resolve; um treino apagado por semelhança é um
treino que aconteceu e sumiu.

### Pendências nativas — `NATIVE VALIDATION PENDING`

Nenhuma linha foi escrita às cegas. Todas estão especificadas em
`ACTIVITY_DEVICE_ARCHITECTURE.md` §7, com arquivos, permissões, lifecycle e plano de teste,
contra portas que já existem no código:

| Item | Estado |
|---|---|
| Android Widget | especificado, não implementado |
| iOS Widget | especificado, não implementado |
| Health Connect | especificado; porta `HealthDataProvider` pronta |
| HealthKit | especificado; mesma porta |
| Foreground Service (Android) | especificado |
| Background Location (iOS) | especificado |
| Quick Actions | especificado |
| Permissões nativas | declaradas onde possível; validação pendente |
| Testes em aparelho real | não executados |
| Consumo de bateria | não medido |
| App suspenso / tela bloqueada | não validado |

> **A pendência que mais dói:** sem foreground service, tracking com a tela apagada **não
> funciona** — o JS congela em segundo plano. Uma corrida de 40 minutos com o telefone no
> bolso registra os primeiros segundos. `WebLocationTracker.suportaSegundoPlano` é `false` e
> diz a verdade, mas a UI ainda precisa avisar quem vai correr.

## 5. P3 — Readiness & Metabolic Intelligence

**Status: CORE COMPLETE / PHYSIOLOGICAL INPUTS PENDING**

O motor existe, é determinístico, explicável, versionado e testado — **e está desligado**.

### O que está pronto

Seis componentes com pesos centralizados, baseline pessoal e progressivo, cold start que
devolve `null` em vez de fingir precisão, confiança separada do score, vetos de dor como
teto, recuperação por grupo muscular com irradiação para sinergistas, snapshots imutáveis por
versão de algoritmo, e explicabilidade sem expor fórmula.

O algoritmo foi **documentado antes de ser implementado**
(`READINESS_ALGORITHM_V1.md`), e os testes verificam o documento.

### A limitação, dita sem rodeio

Três das entradas que a SPEC lista — **HRV, frequência cardíaca de repouso e duração de
sono** — não têm fonte. Dependem da integração de saúde que a P2 deixou pendente. Os
componentes estão implementados e testados e nunca recebem dado.

Consequência: a cobertura típica fica entre **0,24 e 0,88**. O card agora exibe a cobertura
em porcentagem e se marca como **experimental** abaixo de 0,75, com o "Por quê?" nomeando o
que falta. Um motor chamado "Readiness" sem HRV entrega menos do que o nome promete, e o
produto passou a dizer isso na cara.

### Sobre o conflito com o `CLAUDE.md`

A regra do projeto — *"não criar score único estilo Whoop neste momento"* — foi mantida em
espírito. As três amarras que tornaram o Progress Score aceitável estão reproduzidas:
breakdown obrigatório **imposto pelo CHECK do banco**, `null` quando não dá para afirmar, e
o Lens qualitativo preservado como fonte da adaptação de treino. **O score não ganhou poder
de mexer em ficha que o nível não tinha.**

### Congelamento

Preservado integralmente, conforme §7: código, migrations, testes e arquitetura intactos.
Congelada apenas a **evolução funcional**.

---

## 6. Feature flags

Auditoria completa das features tocadas ou introduzidas em P0–P3, em banco criado do zero:

| Feature | Flag | Free | Pro | Premium | Introduzida em | Dependências |
|---|---|---|---|---|---|---|
| **Prontidão (Readiness)** | `readiness` | ❌ | ❌ | ❌ | **P3** | Nenhuma para funcionar; HRV/FC/sono para ser precisa |
| Treino Livre | `free_workout` | ✅ | ✅ | ✅ | pré-trilha | — |
| Tracker | `tracker` | ✅ | ✅ | ✅ | pré-trilha | GPS do aparelho |
| Registro retroativo | `retro_workout_enabled` | ✅ | ✅ | ✅ | pré-trilha | — |
| Desafios | `challenges` | ✅ | ✅ | ✅ | pré-trilha | — |
| Lab de Movimento | `movement_lab` | ❌ | ✅ | ✅ | pré-trilha | Câmera |
| Lab guiado pela ficha | `movement_lab_guided` | ❌ | ✅ | ✅ | pré-trilha | `movement_lab` |

### Dois achados da auditoria

**1. `readiness` é a única flag nova da trilha inteira** — e ela **vazou para o Premium** na
primeira versão. `PREMIUM_PRODUCT_FEATURES` liga tudo do catálogo por padrão, então a feature
nasceu ativa para todo assinante, o oposto do rollout gradual que a SPEC exigia. Corrigido
com `ROLLOUT_ONLY_FEATURES`, e verificado em banco novo: **desligada nos três planos**.

**2. P0, P1 e P2 entraram sem flag nenhuma.** Isso é um risco real e não uma omissão de
registro: a barra de ação da série, o mini-player, o quick start, o filtro de GPS e a camada
nativa de compartilhamento **mudaram a experiência de todo mundo de uma vez**, sem
kill-switch. Reverter qualquer um exige deploy. Ver §9.

O gate do Readiness é do **servidor** (`requireFeature` na rota); o card do frontend some
sozinho no 403. Não há `hasFeature("readiness")` no cliente — a autoridade é uma só.

---

## 7. Pendências

### Técnicas
- Fila de sincronização automática (o reenvio ainda é um toque do usuário)
- 12 diálogos ainda sem `Escape` — o hook existe, falta aplicar
- Alvos de toque de 29–38px em controles autônomos
- Botão "Entrar" sob o teclado em 320×568
- Admin, Academia e Nutri não auditados para mobile

### Nativas
Tudo da §4: dois widgets, Health Connect, HealthKit, foreground service, background location,
quick actions, permissões, bateria, aparelho real. **Especificadas, não implementadas.**

### Produto
- Sugestão da próxima carga (exige decidir a regra — consequência física para o aluno)
- Substituir exercício na sessão (motor não consolidado do lado do aluno)
- Intensidade de dor no check-in (o veto de dor alta nunca dispara hoje)
- Tela da visão do Personal para prontidão (serviço pronto, tela não)

### Validação
- QA em academia real, com uma mão, com interrupções
- Compartilhamento real no Instagram e WhatsApp
- Rollout do Readiness, degrau a degrau

---

## 8. Regressão final

Executada em navegador real (motor da WebView Android), autenticada, contra backend e
Postgres locais em banco criado do zero.

| Fluxo | Resultado | Cobertura |
|---|---|---|
| **Autenticação** | ✅ PASS | 4/4 — login, logout acessível, confirmação, sessão sobrevive a F5 |
| **Navegação** | ✅ PASS | 6/6 — Home, Perfil, Treinos, Histórico, Tracker, bottom nav; overflow 0 em todas |
| **Treino planejado** | ✅ PASS | 7/7 — iniciar em 1 toque, registrar série, descanso automático, mini-player após "matar" o app, retomar, resumo, gravar |
| **Treino livre** | ✅ PASS | 5/5 — montagem, adicionar exercício, iniciar, mesma barra do prescrito, registrar |
| **Substituição / edição da sessão** | ✅ PASS | 2/2 — folha abre no prescrito, reordenar e remover disponíveis |
| **Compartilhamento** | ✅ PASS | 5/5 — CTA, Story, Feed, câmera, galeria, salvar; overflow 0 |
| **Offline** | ✅ PASS | 5/5 — série sem rede, indicador, falha **não apaga** o treino, sincroniza ao reconectar, rascunho limpo |
| **Background** | ✅ PASS | 2/2 — minimizar e voltar, recarga total |

**Suítes:** 455 testes de frontend (46 arquivos) · 729 unitários e **291 de integração contra
Postgres real** no backend · `tsc`, `eslint` e `build` limpos nos dois repositórios.

> **Ressalva honesta sobre "Substituição":** o fluxo testado é o de **editar a lista da
> sessão** (reordenar, remover, adicionar), que existe e funciona nos dois modos. A
> *substituição por exercício equivalente* — trocar supino por crucifixo com o motor
> sugerindo — **não foi implementada**: a SPEC P1 §18 a condicionava a um motor já
> consolidado do lado do aluno, que não existe. Está na §7 como pendência de produto.

---

## 9. Riscos residuais

1. **Nada foi validado em aparelho real.** Nem Android, nem iOS. Toda a verificação aconteceu
   no motor da WebView, que é o certo para layout e lógica e **não diz nada** sobre câmera,
   share sheet, notificação com o app suspenso, gesto de voltar do sistema ou bateria.

2. **O projeto iOS não existe.** Não há diretório `ios/`. Tudo que a trilha fez é de camada
   web/Capacitor e deve valer lá quando a plataforma for criada — mas isso é previsão, não
   verificação.

3. **P0, P1 e P2 não têm kill-switch.** As mudanças mais estruturais da trilha — barra de
   ação, mini-player, filtro de GPS, camada nativa de compartilhamento — chegam a 100% dos
   usuários de uma vez, e reverter exige deploy. É o maior risco operacional do go-live.

4. **`adjustMarginsForEdgeToEdge: 'auto'` desloca o layout de todas as telas no Android 15+.**
   É a correção certa e nunca foi vista num aparelho.

5. **Tracking com a tela apagada não funciona**, e não é corrigível na camada web.

6. **O Readiness nunca foi visto por um usuário real.** Motor determinístico e testado, com
   cobertura entre 0,24 e 0,88 — nenhuma pessoa olhou para aquele número e disse se ele bate
   com o que sentiu.

7. **A recuperação muscular no primeiro treino de um grupo lê 0%.** Autocorrige com baseline,
   mas a primeira leitura é mais dura do que deveria.

8. **Os pesos do Readiness são raciocínio, não calibração.** O material para calibrar está
   sendo coletado (`workout_effort_feedback`, com a previsão congelada); ninguém calibrou.

---

## 10. Recomendações

Sem roadmap novo — apenas a ordem que a evidência sugere.

**Antes de qualquer linha de código:** rodar o app num Android real, numa academia, fazendo
um treino de verdade. A trilha inteira foi verificada em navegador; a próxima fonte de
requisitos deve ser atrito real, não auditoria.

**Ao instrumentar o go-live**, olhar primeiro o que a §9 lista como risco 3: as mudanças de
P0–P2 chegam sem kill-switch. Se algo der errado na barra de ação ou no filtro de GPS, a
única saída é deploy — vale saber disso antes, não durante.

**Sobre o Readiness:** ele pode ser ligado para uso interno hoje. É o único componente da
trilha com rollout controlado, e é justamente o que mais precisa de olhos humanos antes de
qualquer decisão.

**Duas correções baratas** que destravam caminhos já construídos e testados: intensidade de
dor no check-in (o veto de dor alta existe e nunca dispara) e aplicar `useDismissable` aos 12
diálogos restantes (o hook já existe).

---

## 11. Estado final

## READY FOR INTERNAL TESTING

Não é `PRODUCTION READY`, e a razão é uma só: **nada foi validado em aparelho real.** O
código está verde — 1.475 testes, regressão de oito fluxos, build limpo nos dois
repositórios — mas verde em navegador não é verde em celular, e a trilha inteira existiu para
responder uma pergunta que só um celular na mão responde.

Também não é `BLOCKED`: não há defeito conhecido impedindo o uso. Os três P0 que existiam
foram corrigidos e têm teste de regressão; as pendências restantes são trabalho nativo
especificado, não bugs abertos.

**O app está pronto para ir para as mãos de testadores internos.** É o próximo passo, e é
uma etapa de validação — não de desenvolvimento.

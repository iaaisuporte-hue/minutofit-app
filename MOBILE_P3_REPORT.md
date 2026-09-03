# MOBILE_P3_REPORT — S2CORE Readiness & Metabolic Intelligence

**Data:** 02 set 2026 · SPEC "S2CORE Mobile Experience P3"
**Resultado:** **PARTIAL — MOTOR VERIFICADO / FONTES FISIOLÓGICAS PENDENTES**

---

## 1. Estado inicial

### Já existia, e foi preservado

O projeto **já tinha um motor de prontidão**: o Lens da Spec 008, qualitativo
(verde/amarelo/vermelho), com fatores, microcopy e versionamento próprio. Ele alimenta o
motor de adaptação de treino sob `training_adaptation_policy` — política do Personal,
**default OFF e sem campo de aumento de carga**, restrição CREF deliberada.

A P3 **estendeu** isso; não substituiu. Detalhe em
[`READINESS_ARCHITECTURE.md`](READINESS_ARCHITECTURE.md) §2.

### A auditoria de dados, e o que ela mudou no plano

| Entrada pedida pela §7 | Fonte |
|---|---|
| Percepção (energia, sono, dor, estresse) | ✅ `user_daily_checkins` |
| Carga de treino e por grupo muscular | ✅ `workout_sessions` + `workout_set_logs` + `exercises.body_part` |
| Atividade | ✅ `activity_sessions` (P2) |
| Aderência, metabolismo | ✅ |
| **Sono: duração, consistência** | ❌ só o booleano `slept_well` |
| **HRV** | ❌ **sem fonte** |
| **FC de repouso** | ❌ **sem fonte** |

HRV e FC de repouso dependem da integração de saúde que a P2 deixou pendente por falta de
toolchain nativa. A §1 previu exatamente isso: *"a P3 deve funcionar com dados parciais"*.

### O conflito de produto, declarado

O `CLAUDE.md` proíbe *"score único estilo Whoop neste momento"* e reafirma que *"o Readiness
continua qualitativo"*. **A SPEC pede a nota, e a decisão é sua.** Mas o motivo da regra era
número-resumo **sem interpretação** — e as três amarras que tornaram o Progress Score
aceitável foram reproduzidas: breakdown obrigatório imposto pelo banco, `null` quando não dá
para afirmar, e o qualitativo preservado como fonte da adaptação.

---

## 2. Arquitetura

Documentada em [`READINESS_ARCHITECTURE.md`](READINESS_ARCHITECTURE.md). Duas decisões
estruturais:

**O motor não lê o relógio.** `computeReadiness(input, agora)` — o instante entra por
parâmetro. Sem isso o teste de determinismo (§61) não seria escrevível com honestidade.

**Todo o SQL num arquivo, toda a regra em outro.** O repositório monta a entrada; o motor é
puro. É o que permite testar "sono ruim afeta SÓ o componente de sono" (§69/QA-P3-24).

## 3. Motor implementado

Seis componentes (§6), cada um devolvendo `0–100` **ou `null`**:

| Componente | Peso | Estado |
|---|---|---|
| `subjective` (§19) | 0.28 | ✅ com dado |
| `muscleRecovery` (§16–§18) | 0.24 | ✅ com dado |
| `trainingLoad` (§15) | 0.20 | ✅ com dado |
| `sleep` (§12) | 0.16 | ✅ com dado (booleano + baseline) |
| `hrv` (§13) | 0.08 | ✅ implementado · ❌ **sem fonte** |
| `restingHr` (§14) | 0.04 | ✅ implementado · ❌ **sem fonte** |

A percepção pesa mais que tudo porque hoje é o único sinal com fonte confiável e diária — se
HRV e FC pesassem mais, a redistribuição por ausência dominaria o cálculo todo dia.

**Todos os números em `config.ts`** (§4, §37). Mudar qualquer um é mudar o algoritmo e exige
subir a versão.

## 4. Check-in

Integrado como entrada real (§19, §22): `feeling`, `slept_well`, `in_pain`, `stressed`,
`mental_load_level` são traduzidos para o vocabulário do motor e o snapshot é invalidado ao
responder — o score do dia muda.

A tradução é **conservadora e deliberada**: `in_pain` é booleano e vira `moderate`, nunca
`high`. Um booleano não afirma intensidade, e presumir a pior leitura aplicaria o veto mais
severo (teto de 40) com base num dado que não o sustenta.

## 5. Baselines

Pessoal e progressivo (§10, §63), janela de 28 dias, com mínimo de amostras por métrica.
**Mediana** para HRV e FC de repouso — as duas são notoriamente ruidosas, e uma noite com o
relógio mal posicionado arrastaria a média por quatro semanas.

**Cold start** (§11): 0–6 dias → `score: null`, estado `calibrating`. 7–20 → score com teto
de confiança em `medium`. 21+ → confiança pode chegar a `high`.

## 6. Muscle recovery

O diferencial para musculação, e a razão de o Readiness não poder ser um número só.

Carga por grupo sai de `exercises.body_part` com **irradiação para sinergistas** (§17):
`perna` → quadríceps 1.0, glúteos 0.6, posteriores 0.5. Decaimento exponencial com meia-vida
de 24/36/48 h por intensidade, estendida por RPE ≥ 9 e por desconforto.

> Os coeficientes são **aproximação declarada**, não biomecânica medida. O supino carrega o
> tríceps; 0.4 é a ordem de grandeza. A §18 é explícita: *"não criar falsa precisão
> científica"*.

**Verificado com treino real:** sessão de perna → quadríceps, glúteos e posteriores caem
juntos, e sobem com o tempo.

## 7. Recommendation engine

Cinco níveis (§23) derivados de faixas configuráveis, mais `CHECKIN_FIRST` quando o score é
`null`.

**Vetos de dor são teto, não peso** (§21): dor alta limita o score a 40 e a recomendação a
`LIGHT`; moderada, a 60 e `MODERATE`. O veto **nunca eleva** — testado.

**A ficha nunca é alterada** (§24). A recomendação é texto. O ajuste continua sendo do motor
de adaptação existente, que exige política do Personal explicitamente ligada.

## 8. Explainability

**Para o usuário** (§32): "Por quê?" abre fatores em português com direção (+/−), a
recuperação por grupo com barra, o motivo da confiança e o disclaimer. **Testado que nenhuma
fórmula vaza** — nem peso, nem nome de componente técnico.

**Para auditoria** (§33): o snapshot guarda `components` com valor, peso e razão de ausência.
`GET /readiness/debug` expõe tudo — **só para admin**.

## 9. Segurança e LGPD

| Requisito | Estado |
|---|---|
| Não diagnosticar (§50) | ✅ testado com regex sobre todas as combinações de estado |
| Sem alarmismo (§51) | ✅ FC elevada = "acima do seu padrão recente" |
| Limite de responsabilidade (§52) | ✅ no "Por quê?" |
| Personal vê resumo, não prontuário (§28) | ✅ teste assere as chaves exatas do retorno |
| Analytics sem health data (§71) | ✅ payload de tipo fechado |
| Feature flag para rollout (§74) | ✅ desligada em **todos** os planos |

## 10. QA

**Unitários (§60–§63, §69): 41 testes.** Todos os cenários que a SPEC lista — dados
completos, só check-in, sem HRV, sem sono, carga alta, recuperação baixa, valores inválidos,
cold start, determinismo, isolamento de componentes, baseline, vetos, versionamento e
linguagem.

**Integração com Postgres real: 18 testes.** O CHECK que recusa score sem breakdown, os
CHECKs de domínio, um snapshot por dia, imutabilidade do histórico, cache, invalidação,
resumo do Personal e feedback de esforço.

**UI: 9 testes** + QA em navegador (9/9).

| QA da SPEC | Resultado |
|---|---|
| QA-P3-01 sem dados | ✅ `null` + `calibrating`, nunca zero |
| QA-P3-03 dados completos | ✅ score 73 com baseline estabelecido |
| QA-P3-04 mostrar readiness | ✅ card na Hoje |
| QA-P3-05 "Por quê?" | ✅ fatores, grupos, confiança, disclaimer |
| QA-P3-06/07 check-in atualiza | ✅ |
| QA-P3-10/11 treinar pernas | ✅ quadríceps/glúteos/posteriores caem |
| QA-P3-12/13 passagem de tempo | ✅ recuperação sobe |
| QA-P3-14/15/16 faixas | ✅ |
| QA-P3-17 dor | ✅ teto + mensagem que encaminha ao profissional |
| QA-P3-18 dados insuficientes | ✅ cobertura 0,24 → confiança baixa |
| QA-P3-21/22 visão do Personal | ✅ resumo sem dado bruto |
| QA-P3-23 determinismo | ✅ |
| QA-P3-24 isolamento | ✅ |
| QA-P3-25 ausência ≠ zero | ✅ |
| QA-P3-26 outlier | ✅ HRV 500 ms ignorado, score intacto |
| QA-P3-27 versão persistida | ✅ |
| §73 debug só admin | ✅ 403 para aluno |
| §74 feature flag | ✅ 403 por padrão |

### Três defeitos que só o QA pegou

1. **A flag vazava para o Premium.** `PREMIUM_PRODUCT_FEATURES` liga tudo do catálogo, então
   a `readiness` nasceu ativa para todo assinante — exatamente o que a §74/§75 proíbe.
   Corrigido com `ROLLOUT_ONLY_FEATURES`.
2. **Treinar pernas zerava a prontidão geral.** A média de recuperação considerava só os
   grupos **com carga**; peito, costas e ombros, intactos, ficavam fora da conta. Um treino
   de perna comum dava **score 0 → "Hoje é recuperação"**. Agora a média cobre os onze grupos
   do corpo, com os não treinados valendo 100. Score foi de **0 para 73**, com o motivo
   nomeando as pernas.
3. **Manchete vazia no cache.** O caminho de cache devolvia `headline` e `microcopy` em
   branco, e a tela ficava sem título a partir da segunda visita do dia. As duas passaram a
   ser derivadas do estado — congelá-las no banco faria um snapshot antigo exibir copy
   revisada.

Todos com teste de regressão.

## 11. Regressão

| Fase | Resultado |
|---|---|
| P0 (6 cenários em navegador) | ✅ 6/6 |
| P1 (15 cenários) | ✅ 15/15 |
| P2 (API + tracking com GPS simulado) | ✅ 18/18 |
| Backend unitário | ✅ 729 testes, 48 suítes |
| **Backend integração (banco real)** | ✅ **291 testes, 21 suítes** |
| Frontend | ✅ 445 testes, 45 arquivos |
| `tsc`, `eslint`, `build` | ✅ limpos nos dois repos |

### Dois defeitos meus, de fases anteriores, corrigidos aqui

- **As migrations da P2 e da P3 quebravam a suíte de integração inteira.** Da migration 1823
  em diante o repositório usa **SQL cru via `pgm.db.query`**, porque o helper
  `restorePerformanceSchema` as reexecuta com um `pgm` mínimo. Eu usei a API de builder
  (`pgm.createTable`, `pgm.func`) e derrubei 17 suítes — longe da causa. Reescritas em SQL
  cru e idempotente, com replay duplo verificado.
- **A data do histórico rápido (P1 §27) aparecia como `Date` completo.** O servidor devolvia
  `::date`, o driver do pg entregava um objeto, e a tela mostrava
  `"Wed Sep 02 2026 00:00:00 GMT-0300"` em vez de `02/09`. Corrigido com `to_char` no
  servidor e um guarda no cliente.

### Um defeito pré-existente, encontrado de passagem

O teste de metas (`Performance P4`) falhava entre 21h e meia-noite: usava `CURRENT_DATE - 1`
(UTC) enquanto o serviço avalia o vencimento pelo **dia do aluno**. Nessa janela o banco já
está no dia seguinte e `CURRENT_DATE - 1` vira *hoje* — a meta não expirava e o teste
quebrava por três horas todo dia. É a mesma classe de bug que o `CLAUDE.md` registra ("dia do
aluno, não dia UTC"), desta vez dentro do próprio teste. Corrigido.

## 12. Riscos residuais

1. **Metade das entradas fisiológicas não tem fonte.** HRV, FC de repouso e duração de sono
   dependem da integração de saúde da P2, que ficou pendente por toolchain nativa. A
   cobertura típica hoje fica em **0,24–0,88**, e a confiança reflete isso honestamente — mas
   um "Readiness" sem HRV é uma leitura mais pobre do que o nome sugere.
2. **Recuperação muscular no primeiro treino de um grupo lê 0%.** Sem pico histórico, a
   própria carga vira a referência e o déficit é máximo. Autocorrige quando o baseline tem
   dado, mas o primeiro treino de peito da vida da pessoa mostra "Peito 0%".
3. **Os pesos são raciocínio, não calibração.** 0.28/0.24/0.20/0.16/0.08/0.04 foram
   escolhidos pela confiabilidade das fontes disponíveis. O §45/§47 coleta o material para
   calibrar; ninguém calibrou ainda.
4. **A tradução do check-in perde informação.** `in_pain` booleano vira `moderate`, então o
   veto mais severo (§21, dor alta) **nunca dispara hoje**. O caminho está testado e ativo;
   falta o check-in oferecer intensidade de dor.
5. **A visão do Personal (§27) tem serviço e não tem tela.** `obterResumoParaPersonal` está
   implementado e testado, incluindo a minimização; a rota e a UI no cockpit não foram
   construídas.
6. **Rollout não começou.** A flag está desligada em todos os planos, como a §75 exige. O
   motor nunca foi visto por um usuário real.

## 13. Backlog

Em `MOBILE_BACKLOG.md`. Principais: fontes de HRV/FC/sono (depende da P2 nativa), tela da
visão do Personal, intensidade de dor no check-in, calibração dos pesos com o feedback já
coletado, e os itens do §80 (ML, LLM Coach, diagnóstico, previsão de lesão) que seguem
proibidos.

## 14. Resultado

## PARTIAL — MOTOR VERIFICADO / FONTES FISIOLÓGICAS PENDENTES

Dos 16 critérios do §76, **15 estão atendidos com evidência**: o `ReadinessEngine` existe, o
score é determinístico, a explicação existe, a confiança existe, missing data funciona, o
baseline individual existe, o cold start funciona, o check-in integra ao score, a recuperação
muscular existe, o recommendation engine existe, a ficha não é alterada silenciosamente, os
snapshots são persistidos, o algoritmo é versionado, o QA está verde e a regressão P0/P1/P2
está verde.

O critério restante é a **feature flag** — ela funciona, e é justamente por isso que a fase
não é PASS: `readiness` está desligada em todos os planos, como a §75 manda, e **nenhum
usuário real viu o motor**. Somado a isso, HRV, FC de repouso e duração de sono — três das
entradas que a §7 lista — seguem sem fonte até a camada nativa da P2 existir.

**Para virar PASS:** implementar `HealthDataProvider` (P2 §7.2), preencher HRV/FC/sono,
recalibrar os pesos, subir para `1.1`, e executar o rollout do §75 degrau a degrau.

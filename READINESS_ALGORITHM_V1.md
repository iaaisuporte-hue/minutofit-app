# READINESS_ALGORITHM_V1 — S2CORE Readiness, versão 1.0

**Versão do algoritmo:** `1.0` · persistida em cada snapshot
**Data:** 02 set 2026 · SPEC Mobile P3 §78
**Natureza:** determinístico, sem ML, sem LLM (§48, §49)

> Este documento foi escrito **antes** da implementação, como a §82.7 exige. Ele é o
> contrato: o código implementa isto, e os testes verificam isto.

---

## 0. O que o S2CORE Readiness é, e o que ele não é

**É** um indicador próprio de prontidão para treinar hoje, de 0 a 100, sempre acompanhado
de estado, motivos, confiança e recomendação.

**Não é** — e a §5 é explícita — reprodução ou equivalente de Garmin Training Readiness,
Body Battery, Whoop Recovery ou Oura Readiness. Esses podem virar **entradas**; a saída é
S2CORE.

**Não é** diagnóstico. Nenhuma saída afirma doença, risco clínico ou lesão (§50, §51).

### Conflito com uma decisão registrada, e como ele se resolve

O `CLAUDE.md` do projeto diz, na seção "Evolução possível": *"Não criar score único estilo
Whoop neste momento"*, e a emenda do Progress Score (ago/2026) reafirma que *"o Readiness
continua qualitativo (verde/amarelo/vermelho) — a 'Prontidão' segue sem virar nota"*.

Esta SPEC pede a nota. **A decisão é do usuário e está tomada**, mas ela não anula o motivo
da regra — e o motivo era número-resumo **sem interpretação**. A mesma emenda registrou as
três amarras que tornaram o Progress Score aceitável, e esta implementação as reproduz:

| Amarra do Progress Score | Como o Readiness a cumpre |
|---|---|
| **Breakdown obrigatório**, imposto pelo CHECK do banco | `readiness_snapshot` tem `CHECK (jsonb_array_length(components) > 0)`. Score sem componente não grava |
| **`null` quando não dá para afirmar** | Cold start e cobertura insuficiente devolvem `score: null` + estado `calibrating`, nunca um número inventado |
| **O qualitativo não morre** | O `level` verde/amarelo/vermelho do Lens (Spec 008) **continua sendo a fonte da recomendação e da adaptação**. O número é uma leitura mais fina do mesmo estado, não um segundo motor |

A terceira é a mais importante: **o motor de adaptação de treino continua consumindo o
nível qualitativo**, com a política CREF (`training_adaptation_policy`, default OFF, sem
campo de aumento). O score não ganha poder de alterar ficha que o nível não tinha.

---

## 1. Dados realmente disponíveis (auditoria de 02/set/2026)

A §7 pede que nenhuma entrada seja obrigatória. Isso não é elegância defensiva: metade das
entradas que a SPEC lista **não tem fonte hoje**.

| Entrada (§7) | Fonte | Disponível |
|---|---|---|
| Percepção: energia, sono, dor, estresse | `user_daily_checkins` (`feeling`, `slept_well`, `in_pain`, `stressed`, `nutrition_level`, `mental_load_level`) | ✅ |
| Treino recente e carga | `workout_sessions` + `workout_set_logs` (reps, carga, RPE, desconforto) | ✅ |
| Carga por grupo muscular | `workout_set_logs.exercise_id` → `exercises.body_part` | ✅ |
| Atividade (caminhada/corrida/bike) | `activity_sessions` (P2) | ✅ |
| FC média/máxima de atividade | `activity_sessions.avg_heart_rate` / `max_heart_rate` (P2) | ⚠️ coluna existe; sem fonte até haver integração de saúde |
| Aderência recente | `workout_sessions` × ficha | ✅ |
| Score metabólico | motor existente | ✅ |
| Feedback pós-treino | `athlete_post_workout_checkin` (RPE, dor muscular/articular) | ⚠️ só perfil esportivo |
| **Sono: duração, consistência, interrupções** | — | ❌ só o booleano `slept_well` |
| **HRV** | — | ❌ **sem fonte** |
| **FC de repouso** | — | ❌ **sem fonte** |

> **Consequência assumida:** os componentes `hrv` e `restingHr` **existem no motor e nunca
> têm dado hoje**. Isso é deliberado — a §38 manda tratar ausência como ausência, não como
> zero, e o mecanismo precisa estar construído e testado para o dia em que a integração de
> saúde da P2 for implementada. Enquanto isso, eles baixam a **cobertura**, e a cobertura
> baixa a **confiança**. O usuário vê "Confiança média" e o motivo.

---

## 2. Entrada canônica — `ReadinessInput`

```ts
interface ReadinessInput {
  userId: number;
  date: string;                    // dia do aluno (fuso do app, não UTC)
  subjective: SubjectiveInput | null;   // check-in do dia
  sleep: SleepInput | null;
  hrv: MetricPoint | null;              // sem fonte hoje
  restingHr: MetricPoint | null;        // sem fonte hoje
  trainingLoad: TrainingLoadInput | null;
  muscleLoad: MuscleLoadEntry[];        // [] é válido: ninguém treinou
  activityLoad: ActivityLoadInput | null;
  baseline: Baseline | null;            // null em cold start
  metabolicScore: number | null;
}
```

**Todo campo é opcional.** Um usuário que abriu o app hoje e nunca fez nada produz um
resultado válido: `score: null`, estado `calibrating`, confiança `low`, recomendação
"faça o check-in".

`MetricPoint` carrega `{ value, measuredAt, source }` — porque a §40 exige janela de
validade e a §41 exige política de precedência entre fontes.

---

## 3. Baseline individual (§10, §63)

Comparar todo mundo com o mesmo valor absoluto é o erro que a §10 proíbe. O baseline é
**pessoal e progressivo**.

| Métrica | Janela | Estatística | Mínimo de amostras |
|---|---|---|---|
| Sono (proporção de noites boas) | 28 dias | média | 5 |
| HRV | 28 dias | **mediana** | 7 |
| FC de repouso | 28 dias | **mediana** | 7 |
| Carga de treino semanal | 28 dias | média de 7 dias | 2 semanas |
| Frequência de treino | 28 dias | sessões/semana | 2 semanas |

**Mediana e não média para HRV e FC de repouso.** As duas são notoriamente ruidosas: uma
noite com o relógio mal posicionado produz um valor que arrasta a média por quatro semanas.
A mediana ignora o outlier sem precisar detectá-lo.

**Nunca baseline de um dia só** (§63). Abaixo do mínimo de amostras, o baseline daquela
métrica é `null` e o componente correspondente é tratado como ausente.

### Cold start (§11)

| Dias de histórico | Modo | O que acontece |
|---|---|---|
| 0–6 | `cold_start` | Só check-in e treino recente. **Score é `null`** e o estado é `calibrating` — o app diz "estamos calibrando", não finge precisão |
| 7–20 | `building` | Score sai, com teto de confiança em **`medium`**, mesmo que a cobertura seja alta. O baseline ainda é curto demais |
| 21+ | `established` | Confiança pode chegar a `high` |

---

## 4. Componentes

Seis, cada um devolvendo `0–100` **ou `null`** (ausente). Nenhum devolve 0 por falta de dado
(§38).

### 4.1 `SleepScore` (§12)

Sem duração de sono, o que existe é o booleano do check-in mais o baseline pessoal.

```
base = slept_well === true  ? 80
     : slept_well === false ? 35
     : null

Ajuste por baseline (quem dorme mal quase toda noite não deve ver 35 todo dia
como se fosse notícia; e quem dorme bem sempre deve sentir mais a noite ruim):

  proporção de noites boas no baseline (p, 0..1)
  se slept_well === false e p >= 0.8  → base − 10   (desvio grande do próprio padrão)
  se slept_well === false e p <= 0.4  → base + 10   (é o padrão dela; informa, não pune duas vezes)
  se slept_well === true  e p <= 0.4  → base + 5    (melhorou em relação ao próprio padrão)
```

> Um número fixo de horas ("8 h") está explicitamente fora (§12). Quando houver duração
> real, ela entra aqui como termo adicional — o componente já está isolado para isso.

### 4.2 `HrvScore` (§13) — **sem fonte hoje**

Sempre relativo ao baseline, nunca absoluto:

```
r = hrv_hoje / hrv_baseline
r >= 1.10 → 95     r >= 1.00 → 85     r >= 0.92 → 70
r >= 0.85 → 55     r >= 0.75 → 40     senão     → 25
```

### 4.3 `RestingHrScore` (§14) — **sem fonte hoje**

```
d = fc_hoje − fc_baseline   (bpm)
d <= -3 → 90    d <= 1 → 80    d <= 4 → 62    d <= 7 → 45    senão → 30
```

Nunca diagnostica. A elevação vira o fator `resting_hr.elevated` com o texto *"sua
frequência de repouso está acima do seu padrão recente"* — nunca "você pode estar doente".

### 4.4 `TrainingLoadScore` (§15)

Simples e auditável, como a §15 pede — **sem ACWR**, sem modelo esportivo.

```
carga_sessão = Σ(séries concluídas × reps × carga_kg) / 1000      (musculação)
             + minutos × fator_MET / 10                            (atividade)

razão = carga_7d / carga_média_7d_do_baseline_28d

razão <= 0.7 → 90   (descansado)
razão <= 1.1 → 85   (no padrão)
razão <= 1.4 → 70
razão <= 1.7 → 50
senão        → 32   (pico bem acima do próprio padrão)

Penalidade por sessões consecutivas: −8 por dia consecutivo acima de 3, até −16.
```

### 4.5 `MuscleRecoveryScore` (§16, §17, §18)

O diferencial para musculação, e a razão de o Readiness não poder ser um número só (§29).

**Mapa de grupos** — de `exercises.body_part` (catálogo canônico, 241 exercícios) para os
grupos do modelo, com irradiação para sinergistas:

```
peito       → chest 1.0, triceps 0.4, shoulders 0.3
costas      → back 1.0, biceps 0.4
perna       → quads 1.0, glutes 0.6, hamstrings 0.5
glúteo      → glutes 1.0, hamstrings 0.5, quads 0.3
ombro       → shoulders 1.0, triceps 0.2
bíceps      → biceps 1.0
tríceps     → triceps 1.0
panturrilha → calves 1.0
abdômen     → core 1.0
antebraço   → forearms 1.0
```

> Os coeficientes de sinergia são **aproximação declarada**, não biomecânica medida. O
> supino carrega o tríceps — 0,4 é a ordem de grandeza, não uma constante da literatura. A
> §18 é explícita: *"não criar falsa precisão científica"*.

**Decaimento** (§18) — exponencial simples, meia-vida por intensidade da carga:

```
recuperação(g, t) = 100 − carga_normalizada(g) × 2^(−t / meia_vida)

meia_vida = 24 h   quando carga leve      (< 30% do pico de 28d daquele grupo)
          = 36 h   carga moderada
          = 48 h   carga alta             (> 70% do pico)

Modificadores:
  RPE da sessão >= 9        → meia-vida × 1.15
  desconforto no grupo      → meia-vida × 1.25  e piso de recuperação em 60
```

Estados por grupo: `>= 85` recuperado · `60–84` recuperação parcial · `< 60` em recuperação.

O `MuscleRecoveryScore` global é a média sobre **todos os onze grupos do corpo** — os que
não receberam carga contam como **100 (recuperado)**, não ficam de fora. Quando há treino
previsto, a média é restrita aos grupos daquele treino (§29).

> **Por que "todos", e não só os carregados.** A primeira implementação promediava apenas os
> grupos com carga. Um treino de perna normal deixava quadríceps, glúteos e posteriores em
> 0% — e como eram os únicos na conta, a média global dava 0 e o Readiness inteiro colapsava
> para "recuperação", com o peito, as costas e os ombros intactos. O QA pegou: score 0 depois
> de uma sessão de pernas comum. Peito fresco é informação tão real quanto perna cansada.

### 4.6 `SubjectiveScore` (§19)

Do check-in do dia:

```
energia:  muito alta 95 · alta 85 · normal 72 · baixa 48 · muito baixa 30
sono:     excelente 92 · bom 80 · regular 58 · ruim 35
dor:      nenhuma 90 · leve 72 · moderada 48 · alta 25
estresse: baixo 88 · moderado 68 · alto 42

SubjectiveScore = média das respostas presentes
```

**Dor alta é veto, não peso** — ver §6.

---

## 5. Pesos (§37)

Configuração central em um único objeto versionado. **Nenhum número hardcoded espalhado.**

| Componente | Peso |
|---|---|
| `subjective` | 0.28 |
| `muscleRecovery` | 0.24 |
| `trainingLoad` | 0.20 |
| `sleep` | 0.16 |
| `hrv` | 0.08 |
| `restingHr` | 0.04 |

**Por que a percepção pesa mais que tudo.** Não é falta de ambição técnica: é que hoje ela
é o único sinal com fonte confiável e diária. HRV e FC de repouso somam 0.12 e **nunca têm
dado** — se pesassem mais, a redistribuição do §38 dominaria o cálculo todo dia.

Quando a integração de saúde existir, os pesos mudam **e a versão do algoritmo sobe**.

### Redistribuição por ausência (§38)

Peso de componente ausente é **redistribuído proporcionalmente entre os presentes**, nunca
tratado como zero.

```
score = Σ(componente_i × peso_i) / Σ(peso_i)   , apenas i presentes
```

Se **nenhum** componente está presente → `score: null`, estado `calibrating`.

---

## 6. Vetos (§21)

Certas condições não são "peso baixo": são teto.

| Condição | Efeito |
|---|---|
| Dor **alta** relatada | Score limitado a **40**; recomendação nunca acima de `light`; fator `pain.high` com severidade `block` |
| Dor **moderada** | Score limitado a **60**; recomendação nunca acima de `moderate` |
| Desconforto registrado em grupo do treino de hoje | Recomendação nunca acima de `moderate` **para aquele grupo**, com o texto nomeando a região |

A mensagem de dor **nunca diagnostica** (§21, §50): *"Você relatou desconforto no ombro.
Evite exercícios que agravem a região e considere conversar com seu profissional."*

---

## 7. Outliers (§39)

Valor fora da faixa fisiológica plausível é **marcado como `ignored`**, não usado, e **não
derruba o score**:

| Métrica | Faixa aceita |
|---|---|
| HRV | 5–300 ms |
| FC de repouso | 30–120 bpm |
| Duração de sono | 0–16 h |
| Carga de uma sessão | ≤ 3× o pico histórico do usuário |

Um valor ignorado conta como **ausente** para a cobertura — a confiança cai, o que é a
resposta correta.

## 8. Frescor (§40)

| Dado | Janela de validade |
|---|---|
| Check-in | mesmo dia do aluno |
| HRV, FC de repouso | 36 h |
| Sono | 24 h |
| Carga de treino | 7 dias corridos |
| Carga muscular | 96 h |

Dado fora da janela é **ausente**, não velho-porém-usável. HRV de três dias atrás não é o
HRV de hoje.

## 9. Precedência de fontes (§41)

Quando a mesma métrica chega de mais de uma fonte, vence **uma** — nunca se soma:

```
1. medição direta do S2Core       (ex.: check-in)
2. Apple Health / Health Connect  (agregadores oficiais da plataforma)
3. Garmin / Strava direto         (quando existir)
4. entrada manual
```

Empate na origem resolve pelo `measuredAt` mais recente.

---

## 10. Cobertura e confiança (§8, §9)

**Cobertura** = soma dos pesos dos componentes presentes (0..1). Ela é o dado; a confiança é
a leitura dela.

**Confiança** é `high` · `medium` · `low`:

```
low      se modo = cold_start
         ou cobertura < 0.45
         ou não há check-in do dia

medium   se cobertura < 0.75
         ou modo = building

high     caso contrário
```

> Readiness e confiança são **campos separados** (§9). Um score de 69 com confiança baixa e
> um de 69 com confiança alta significam coisas diferentes, e a UI mostra os dois.

---

## 11. Faixas e recomendação (§4, §23)

Faixas **configuráveis**, num único objeto (§4: "não espalhar números hardcoded").

| Faixa | Estado | Recomendação |
|---|---|---|
| 80–100 | `ready_intense` | `INTENSE` — treino planejado normalmente |
| 65–79 | `ready` | `NORMAL` — manter treino |
| 50–64 | `moderate` | `MODERATE` — reduzir volume/intensidade |
| 35–49 | `light` | `LIGHT` — priorizar técnica e exercícios leves |
| 0–34 | `recover` | `RECOVERY` — mobilidade, caminhada leve, descanso |
| `null` | `calibrating` | `CHECKIN_FIRST` — "faça o check-in" |

**A recomendação nunca altera a ficha** (§24). Ela é texto e uma oferta; o ajuste passa pelo
motor de adaptação existente, que exige política do Personal explicitamente ligada.

---

## 12. Explicabilidade (§3, §32, §33)

**Para o usuário** (§32): lista de fatores com direção (`+`/`−`) e rótulo em português —
"Sono abaixo do seu padrão", "Pernas em recuperação parcial". Nunca a fórmula.

**Para auditoria** (§33): o snapshot guarda `components` com o valor de cada componente, o
peso aplicado, a razão de ausência quando ausente, e a cobertura. É o que permite responder
"por que este número" seis meses depois.

## 13. Versionamento e snapshot (§34, §35, §36)

`readiness_snapshot` grava por dia: `score`, `confidence`, `state`, `recommendation`,
`components` (JSONB), `factors`, `data_completeness`, `algorithm_version`, `mode`.

**Mudar o algoritmo não reescreve o passado** (§36). Um snapshot de `1.0` continua sendo
`1.0` para sempre. É a única forma de comparar previsão e realidade (§45, §47) sem
contaminar a série.

## 14. Exemplos de cálculo

### A — dados completos, tudo bem

```
subjective 82 (×0.28) · muscleRecovery 88 (×0.24) · trainingLoad 85 (×0.20)
sleep 80 (×0.16) · hrv ausente · restingHr ausente
cobertura = 0.88 ; soma pesos presentes = 0.88
score = (82×.28 + 88×.24 + 85×.20 + 80×.16) / 0.88 = 74.2/0.88 ≈ 84
→ 84 · ready_intense · INTENSE · confiança high (modo established)
```

### B — noite ruim e pernas carregadas

```
subjective 52 · trainingLoad 50 · sleep 25
muscleRecovery: quads 41, glutes 55, hamstrings 60; os outros 8 grupos em 100
                → média sobre os 11 = (41+55+60 + 8×100) / 11 ≈ 87
score = (52×.28 + 87×.24 + 50×.20 + 25×.16) / 0.88 ≈ 56
→ 56 · moderate · MODERATE · confiança high
fatores: − sono abaixo do padrão · − pernas em recuperação parcial · − carga acima do padrão

Num DIA DE PERNA a mesma situação pesa muito mais: a média fica restrita a
quads/glutes/hamstrings (≈52) e o score cai para ≈48 → LIGHT.
```

### C — dor alta (veto)

```
score bruto 71 → veto de dor alta → limitado a 40
→ 40 · light · LIGHT · fator block `pain.high`
mensagem: "Você relatou dor. Evite sobrecarregar a região e considere conversar com seu profissional."
```

### D — cold start (dia 2)

```
histórico 2 dias → modo cold_start
→ score null · calibrating · CHECKIN_FIRST · confiança low
"Estamos calibrando seu padrão. Faça o check-in para começar."
```

### E — só check-in, sem treino nenhum

```
subjective 72 presente; demais ausentes
cobertura = 0.28 → score = 72 ; confiança low (cobertura < 0.45)
→ 72 · ready · NORMAL · confiança **baixa**, e a tela diz por quê
```

---

## 15. O que a v1 deliberadamente NÃO faz

- **Machine learning** (§48) — sem dado suficiente, sem auditabilidade, sem QA possível.
- **LLM no cálculo** (§49) — o score é determinístico. LLM pode explicar depois; calcular, nunca.
- **Alterar ficha sozinho** (§24) — recomenda; o ajuste é do motor existente, com política do Personal.
- **Copiar score de terceiros** (§42, §43, §44) — Body Battery e Training Readiness podem
  aparecer como **contexto externo rotulado**, jamais somados ao nosso.
- **Prever lesão, diagnosticar, prescrever** — fora de escopo por segurança, não por prazo.

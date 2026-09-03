# READINESS_ARCHITECTURE — S2CORE Readiness

**Versão:** 1.0 · 02 set 2026 · SPEC Mobile P3 §77
**Algoritmo:** documentado separadamente em [`READINESS_ALGORITHM_V1.md`](READINESS_ALGORITHM_V1.md)

---

## 1. Onde cada coisa mora

```
backend/src/modules/readiness/
├── readiness.engine.ts          ← Lens qualitativo (Spec 008) — PRESERVADO
├── readiness.service.ts         ← serviço do Lens — PRESERVADO
└── v1/                          ← S2CORE Readiness v1 (P3)
    ├── config.ts                ← TODOS os números do algoritmo
    ├── types.ts                 ← ReadinessInput / ReadinessResult
    ├── components.ts            ← seis componentes, funções puras
    ├── engine.ts                ← composição, vetos, confiança
    ├── readinessRepository.ts   ← todo o SQL; nada de regra
    └── readiness.service.ts     ← snapshot, cache, invalidação, resumo do Personal

backend/src/routes/readiness.ts  ← GET /today · GET /debug · POST /effort-feedback
frontend/src/features/readiness/ ← readinessApi · ReadinessCard · readinessEvents
```

**A separação que mais importa:** o motor é **puro e não lê o relógio** — `agora` entra por
parâmetro. Sem isso o teste de determinismo (§61) seria impossível de escrever com
honestidade. Todo o SQL vive no repositório; toda a regra, no motor.

---

## 2. Dois motores de prontidão, e por quê

| | Lens (Spec 008) | S2CORE Readiness v1 (P3) |
|---|---|---|
| Saída | `green` · `yellow` · `red` | 0–100 + estado + confiança |
| Tabela | `user_readiness_snapshot` | `readiness_snapshot` |
| Consumidor | **motor de adaptação de treino** | Home, "Por quê?", visão do Personal |
| Poder | pode disparar adaptação da ficha, sob política CREF do Personal | **nenhum** — só recomenda |
| Versão | `READINESS_VERSION = 1` | `ALGORITHM_VERSION = '1.0'` |

> **O numérico NÃO substituiu o qualitativo, e isso é deliberado.** A adaptação de treino
> continua consumindo o nível do Lens, com `training_adaptation_policy` (default OFF, sem
> campo de aumento de carga — restrição CREF). Se o score ganhasse esse poder, um número
> novo passaria a mexer em ficha de aluno com um caminho que nunca foi auditado para isso.

### O conflito com o CLAUDE.md, e como ele se resolve

O `CLAUDE.md` diz *"não criar score único estilo Whoop neste momento"* e a emenda do Progress
Score reafirma que *"o Readiness continua qualitativo"*. **A SPEC P3 pede a nota, e a decisão
é do usuário.** Mas o motivo da regra era número-resumo **sem interpretação** — e as três
amarras que tornaram o Progress Score aceitável estão reproduzidas aqui:

1. **Breakdown obrigatório, imposto pelo banco.** `chk_readiness_has_components` recusa
   gravar score sem componentes. Regra que vive só na UI é regra que a próxima rota esquece.
2. **`null` quando não dá para afirmar.** Cold start devolve `score: null` e estado
   `calibrating` — nunca um número baixo, que seria lido como "você está mal".
3. **O qualitativo sobrevive** e continua sendo quem decide adaptação.

---

## 3. Fluxo de dados

```
              ┌─────────────────────────────────────────────┐
              │  user_daily_checkins  (percepção do dia)     │
              │  workout_sessions + workout_set_logs (carga) │
              │  exercises.body_part  (mapa muscular)        │
              │  activity_sessions    (P2)                   │
              │  ─── HRV / FC repouso: SEM FONTE hoje ───    │
              └───────────────────┬─────────────────────────┘
                                  ▼
                      readinessRepository.montarEntrada()
                                  ▼
                      ReadinessInput  (tudo opcional)
                                  ▼
                    computeReadiness(input, agora)   ← puro
                       │
                       ├─ 6 componentes → 0–100 ou null
                       ├─ cobertura = Σ pesos presentes
                       ├─ score = Σ(v×p)/Σp   (redistribuição, §38)
                       ├─ vetos de dor (teto, nunca elevação)
                       └─ estado · recomendação · confiança · fatores
                                  ▼
                    readiness_snapshot  (UPSERT do DIA)
                                  ▼
              GET /readiness/today  →  ReadinessCard
```

## 4. Cache e invalidação (§58, §59)

**O snapshot do dia É o cache.** Não há camada extra.

Invalidado (apagado; o próximo GET reconstrói) quando:

| Gatilho | Onde |
|---|---|
| Treino concluído | `workoutSessionService`, **pós-COMMIT** |
| Check-in respondido | `gamificationService.invalidateAfterCheckin` |
| Atividade registrada | idem (passa pelo mesmo check-in) |

> **Apagar, não recalcular na hora.** Recalcular dentro do fluxo do treino acoplaria a
> gravação da sessão ao motor de prontidão, e uma falha aqui derrubaria um treino já
> commitado. É a mesma lei dos outros hooks pós-COMMIT do projeto.

## 5. Rollout (§74, §75)

Feature flag `readiness`, **desligada em todos os planos** — inclusive Premium.

`PREMIUM_PRODUCT_FEATURES` liga tudo do catálogo por padrão, então a feature nasceria ativa
para todo assinante no primeiro deploy. `ROLLOUT_ONLY_FEATURES` existe para impedir isso, e
o QA pegou o vazamento antes: a primeira versão respondia 200 para um Premium.

```
interno → beta fechado → 10% → 25% → 50% → 100%
```
Cada degrau é operação de admin sobre `plan_features`.

## 6. Privacidade (§28, §53, §71)

| Superfície | O que sai |
|---|---|
| `GET /readiness/today` (aluno) | score, estado, confiança, **fatores em português**, recuperação por grupo. **Nunca a fórmula** |
| Resumo do Personal | score, estado, confiança, motivos negativos, recuperação por grupo. **Nunca** componentes, check-in, sono ou registro de saúde — verificado por teste que assere as chaves exatas |
| `GET /readiness/debug` | breakdown completo — **só admin** (§73) |
| Analytics | estado, confiança, modo. **Nunca** score exato nem dado de saúde — payload de tipo fechado (§71) |
| Snapshot | breakdown técnico, para auditoria (§33) |

A rota do Personal aplica `requireActiveConsent` como as irmãs de performance.

## 7. Segurança da linguagem (§50, §51, §52)

- Nenhuma saída afirma doença, risco clínico ou lesão — **testado** com regex sobre todas as
  combinações de estado.
- FC elevada vira *"acima do seu padrão recente"*, nunca sintoma.
- Dor relatada vira *"evite exercícios que agravem a região e considere conversar com seu
  profissional"* — descreve e encaminha, não diagnostica.
- O disclaimer da §52 aparece dentro do "Por quê?".

## 8. O que a v1 não faz, por decisão

| Item | Por quê |
|---|---|
| Machine learning (§48) | Sem dado suficiente, sem auditabilidade, sem QA possível |
| LLM no cálculo (§49) | O score é determinístico. LLM pode explicar depois; calcular, nunca |
| Alterar ficha (§24) | Recomenda. O ajuste é do motor existente, com política do Personal |
| Copiar Body Battery / Training Readiness (§42–§44) | Podem virar **contexto externo rotulado**; jamais somados ao nosso |
| Ajustar o modelo pelo feedback (§47) | O feedback é **coletado** e a divergência **registrada**. Ajuste automático é P4 |

## 9. Extensão: quando HRV e FC de repouso existirem

Os componentes `hrvScore` e `restingHrScore` **já estão implementados e testados** — só nunca
recebem dado, porque a integração de saúde da P2 ficou pendente por falta de toolchain
nativa. Quando o `HealthDataProvider` for implementado:

1. `readinessRepository` passa a preencher `hrv` e `restingHr` com `MetricPoint`
   (`value`, `measuredAt`, `source`) — a janela de validade (§40) e a precedência de fontes
   (§41) já estão codificadas.
2. `carregarBaseline` calcula as **medianas** de 28 dias (hoje devolvem `null`).
3. Os pesos mudam — e `ALGORITHM_VERSION` sobe para `1.1`. Os snapshots de `1.0` permanecem
   `1.0` (§36).

Nada acima disso precisa mudar. Foi por isso que os dois componentes entraram desde já.

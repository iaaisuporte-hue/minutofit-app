# MOBILE_P2_REPORT — S2CORE Mobile Experience P2 (Activity & Device Layer)

**Data:** 02 set 2026
**Escopo:** SPEC "S2CORE Mobile Experience P2 — Activity & Device Layer"
**Resultado:** **PARTIAL — CORE VERIFIED / NATIVE VALIDATION PENDING**

---

## 0. Gate P0/P1 (§1)

A SPEC exige P0 e P1 verdes. As duas fecharam em **FAIL**, e por um motivo que continua
valendo: não há aparelho Android nem projeto iOS neste ambiente. **Não há regressão.**

Reverificado antes de começar e de novo ao final:

| Verificação | Resultado |
|---|---|
| Suíte do frontend | 432 testes, 43 arquivos — verde |
| `tsc -b` frontend / `tsc --noEmit` backend | limpos |
| `eslint` | 0 erros |
| `npm run build` | limpo |
| Regressão P0 (6 cenários em navegador) | 6/6 |
| Regressão P1 (14 cenários em navegador) | 14/14 |

**Gate: UNVERIFIED quanto ao hardware, sem regressão evidente** — que é a condição sob a
qual esta fase foi autorizada a prosseguir.

---

## 1. Arquitetura implementada

Detalhe completo em [`ACTIVITY_DEVICE_ARCHITECTURE.md`](ACTIVITY_DEVICE_ARCHITECTURE.md).
Resumo das decisões que estruturam a fase:

**Dois domínios, uma interface.** Musculação continua em `workout_sessions`; caminhada,
corrida e bike em `activity_sessions`. A união acontece na leitura (§40), não no
armazenamento — um treino é uma árvore de séries, uma atividade é uma trajetória, e forçá-los
na mesma tabela custaria colunas nulas em massa dos dois lados.

**Portas antes de adapters.** `LocationTracker` e `HealthDataProvider` existem como
interfaces. O domínio — filtro, distância, pace, rascunho, recuperação — não sabe de onde os
pontos vêm. Trocar `WebLocationTracker` por um nativo com foreground service não muda uma
linha acima dessa fronteira. Foi assim que a camada nativa ficou plugável **sem** ter sido
escrita.

**O rascunho é o fato; a tela é o espelho.** Todos os números finais saem do rascunho, com
instantes absolutos e duração derivada. É o que faz o tempo com a tela apagada não se perder
e a recuperação reconstruir em vez de recontar.

---

## 2. Widget Android

**Não implementado.** Especificação completa em `ACTIVITY_DEVICE_ARCHITECTURE.md` §7.4:
Glance, arquivos, manifesto, os quatro estados do §8, e a decisão de o widget ler um
snapshot em `SharedPreferences` em vez de chamar a API — widget que faz rede fica lento,
falha offline e acorda o aparelho.

O que **está** pronto do lado do app: o deep link `s2core://workout/today?from=widget` é
traduzido, validado e instrumentado (`widget.workout_started`). O widget encontra a porta
aberta quando for escrito.

## 3. Widget iOS

**Não implementado.** Especificação em §7.4: WidgetKit, target de extensão, e o **App Group
`group.com.s2core.app`** — sem ele a extensão não enxerga nada do app, e é o detalhe que mais
custa descobrir tarde.

---

## 4. Tracking de atividade

| Item | Estado |
|---|---|
| Caminhada, corrida, ciclismo (§13) | ✅ já existiam; agora sobre o novo domínio |
| Duração ativa, distância, pace, velocidade (§17–§21) | ✅ |
| **Métrica principal por modalidade (§21)** | ✅ bike mostra **km/h**; caminhada e corrida, pace. Não é estética: ciclista não pensa em minutos por quilômetro |
| Pausa e retomada (§22) | ✅ gravadas no rascunho com instante absoluto |
| Tela pré-atividade com status de GPS (§14) | ✅ já existia |
| Permissão contextual com finalidade (§15/§16) | ✅ já existia — diálogo antes do prompt do sistema |
| Auto Pause (§23) | ❌ não implementado — a SPEC permite adiar; foi para o backlog |
| **Background com tela apagada (§24)** | ❌ **impossível na camada web** — ver §13 |

## 5. GPS

**O achado que mais muda o número na tela:** não havia filtro nenhum. A distância somava
todos os pontos que o `watchPosition` entregasse, e o GPS de celular não entrega uma
trajetória — entrega uma nuvem. Cada salto de recuperação de fix virava distância
percorrida, e o erro é **sempre na mesma direção: infla**. Pace, calorias e score derivavam
todos desse número.

Quatro rejeições implementadas (§28): precisão > 35 m, salto > 200 m, velocidade acima do
teto da modalidade, e movimento < 3 m (deriva do aparelho parado).

**Medido:** 490 m reais com um teleporte de 500 m no meio → **0,49 km**. Sem filtro, ~1,5 km.

Deliberadamente **não** suavizamos (Kalman) nem interpolamos buracos: os dois melhoram o
traçado e pioram a honestidade do número.

## 6. Persistência

**O segundo achado sério:** a rota vivia apenas no estado do React até "Finalizar". Fechar o
app, receber uma ligação que matasse o processo ou um crash em qualquer ponto de uma corrida
de uma hora apagava a corrida **inteira**. É o mesmo defeito que a P0 corrigiu no treino.

Agora cada ponto é gravado no instante em que chega (§36), e a recuperação (§35) oferece
**Continuar · Finalizar · Descartar** — nenhuma automática, como a SPEC exige.

Verificado com o processo "morto" de verdade (contexto novo com o mesmo storage): 8 pontos
gravados → card de recuperação → finalizar → sincronizado → linha no banco com `source`,
`client_key` e rota.

## 7. Health Connect · 8. Apple Health

**Não implementados.** A porta `HealthDataProvider` existe com o contrato completo, e
`provedorDeSaude()` devolve **`null`** — a ausência é detectável em runtime, e a UI de
Integrações deve mostrar "indisponível nesta versão" em vez de um botão inerte.

O que **está** pronto e é a metade difícil: o servidor **já aceita e deduplica ingestão
externa**. `source`, `source_external_id`, `source_app`, FC média/máxima e calorias medidas
são colunas reais, com CHECK, índices e testes contra Postgres. Quando o plugin nativo
existir, ele chama a mesma rota que já foi verificada.

## 9. Deduplicação

Três defesas, em ordem de confiança — todas testadas contra Postgres real:

1. **`client_key`** — reenvio do mesmo POST devolve a atividade existente (200 +
   `deduplicated: true`), não cria outra.
2. **`source_external_id`** — a mesma corrida importada duas vezes é uma. **A origem faz
   parte da chave**: Health Connect e Garmin podem usar espaços de id independentes, e uma
   colisão acidental não pode fundir duas atividades.
3. **Janela temporal** (±3 min, duração compatível) — **grava assim mesmo** e marca
   `possible_duplicate_of`.

> A terceira defesa nunca descarta, e isso é a decisão central. A §5 proíbe heurística
> destrutiva, e a assimetria é clara: um duplicado visível é um incômodo que o usuário
> resolve; um treino apagado por semelhança é um treino que aconteceu e sumiu.

Anti-loop de escrita (§45) especificado: guardar o `externalId` devolvido pela escrita é o
que faz a defesa 2 reconhecer a volta. Sem esse passo o laço fecha errado.

## 10. Privacidade / LGPD

| Item | Estado |
|---|---|
| Coleta só com atividade iniciada (§68) | ✅ |
| Finalidade explicada antes do prompt (§15/§16) | ✅ já existia |
| Excluir a atividade exclui a rota (§32) | ✅ verificado |
| Exclusão remove **só do S2Core** (§67) | ✅ **decisão documentada** — ver §13.4 |
| **Rota nunca entra na arte compartilhada** (§32/§63) | ✅ com teste |
| **Analytics não pode carregar coordenada** (§70) | ✅ payload de **tipo fechado**, com teste de tipo que quebra a compilação se alguém acrescentar `lat`/`lng` |
| Distância em **faixa**, nunca exata, em analytics | ✅ |
| Logs sem rota, coordenada ou payload sensível (§69) | ✅ |

## 11. QA

**45 cenários da SPEC.** Ambiente: Chromium (motor da WebView Android), autenticado, backend
Node + Postgres locais em banco criado do zero, **GPS simulado** com injeção de
`navigator.geolocation` (pontos exatos, teleporte, precisão ruim e perda de sinal
reproduzíveis).

### Verificados

| QA | Resultado |
|---|---|
| QA-P2-06/07/08 caminhada, corrida, bike | ✅ |
| QA-P2-09/10 pausar e retomar | ✅ GPS desligado na pausa; distância congelada |
| QA-P2-11 finalizar | ✅ |
| QA-P2-14/15 sem internet | ✅ finaliza, guarda no aparelho, indica pendente |
| QA-P2-17 permissão negada | ✅ divulgação + estado tratado |
| QA-P2-18/19/20 baixa precisão, perda e retorno de sinal | ✅ teleporte de 500 m descartado |
| QA-P2-21/22 rota e distância plausível | ✅ 490 m reais → 0,49 km |
| QA-P2-23/24/25/26 app encerrado, reabrir, restaurar, finalizar | ✅ ciclo completo |
| QA-P2-30/31 importar e não duplicar | ✅ nas três defesas |
| QA-P2-32 sincronizar atividade S2Core | ✅ idempotente |
| QA-P2-38/39/40/41/42 compartilhar (foto, Story, Feed) | ✅ reusa P0 inteira |
| §67 exclusão | ✅ 200 → 404; id malformado → 400, não 500 |
| §82 regressão P0/P1 | ✅ 20/20 |

**Suítes:** 432 testes de frontend (**+62 novos**: 20 de filtro GPS, 17 de rascunho, 16 de
deep links, 9 de compartilhamento) e **16 testes de integração contra Postgres real** para o
modelo canônico e a deduplicação.

### Não executados — **falta toolchain, não falta implementação**

QA-P2-01 a 05 (widgets) · QA-P2-12/13 (tela apagada, outro app) · QA-P2-27 a 29 (Health
Connect) · QA-P2-33 a 37 (Apple Health) · QA-P2-43/44/45 (bateria).

## 12. Performance / bateria

**Não medido.** §60 e §81 exigem 30/60/90 minutos de tracking contínuo em aparelho físico
com `dumpsys batterystats`. Sem aparelho, qualquer número aqui seria inventado.

O que a fase fez **a favor** da bateria, e é verificável por leitura: a amostragem não usa
frequência fixa (`watchPosition` entrega quando o receptor tem posição nova — pedir mais
rápido não melhora precisão e gasta bateria), e o filtro descarta ruído **antes** de virar
cálculo. O plano de medição está em `ACTIVITY_DEVICE_ARCHITECTURE.md` §8.

---

## 13. Riscos residuais

1. **Tracking com a tela apagada não funciona, e não é um defeito a corrigir na camada web.**
   O JS congela quando o WebView vai para segundo plano — limitação já registrada como
   decisão consciente no `CLAUDE.md`. `WebLocationTracker.suportaSegundoPlano` é `false` e
   diz a verdade; a UI deve avisar quem vai correr. **É o maior risco desta fase**, porque
   uma corrida de 40 minutos com o telefone no bolso registra os primeiros segundos e para.
2. **Nada de nativo foi compilado.** Nenhum widget, nenhum provedor de saúde, nenhum
   foreground service. A porta está aberta; ninguém passou por ela.
3. **A janela de 3 minutos da terceira defesa é calibrada por raciocínio, não por dado.**
   Duas corridas legítimas de mesma duração começando com 2 min de diferença seriam marcadas
   como possível duplicata. Nada é apagado, mas o rótulo apareceria errado.
4. **Exclusão remove só do S2Core (§67) — decisão, com uma consequência honesta.** Não
   tentamos apagar da fonte externa: apagar aqui é reversível para o usuário (ele reimporta);
   apagar do Health Connect é destruir dado de outra aplicação a partir de um gesto feito
   aqui, que ele pode nem imaginar. **A consequência: uma atividade importada e excluída aqui
   pode voltar na próxima sincronização.** A supressão de reimporte está no backlog.
5. **O modelo canônico mudou uma tabela viva.** `activity_sessions` já tinha dados; a
   migration é aditiva e teve round-trip validado, mas rodou contra banco de teste, não
   contra o volume de produção.
6. **`calories` × `calories_estimated` convivem.** Nenhum consumidor foi atualizado para
   preferir a medida quando ela existe — os motores atuais seguem lendo `calories_estimated`.
   É correto e conservador, mas é dado bom não usado.

---

## 14. Backlog P3

Registrado em `MOBILE_BACKLOG.md`. A SPEC pede **preparar, não implementar** (§86–§88):

- **S2CORE Readiness Engine** (§86) — entradas possíveis já mapeadas; a P2 acrescentou
  atividade recente, FC média/máxima e carga externa como sinais disponíveis. A decisão
  ("Como você está hoje?") **não** foi implementada, e o `CLAUDE.md` tem uma regra própria
  sobre número-resumo que precisa ser respeitada quando ela for.
- **Garmin** (§87) — via ecossistema (já suportado pelo modelo: `source='garmin'` está no
  enum) e direto por API. **Os dados disponíveis nas duas vias não são equivalentes**, e o
  modelo não deve fingir que são.
- **Strava** (§88) — OAuth e API, fase própria.
- Auto Pause (§23), supressão de reimporte após exclusão, consumo de `calories` medidas,
  calibração da janela de dedup.

---

## 15. Resultado

## PARTIAL — CORE VERIFIED / NATIVE VALIDATION PENDING

**Verificado:** o domínio canônico de atividade com procedência e deduplicação em três
camadas; o filtro de ruído GPS e a distância por trajetória; pace, velocidade e a métrica
certa por modalidade; persistência incremental e recuperação de sessão; sincronização
idempotente e offline; deep links validados; compartilhamento reusando a P0; analytics com
payload fechado contra vazamento de rota; e regressão P0/P1 verde.

**Pendente por toolchain:** widget Android, widget iOS, Health Connect, HealthKit,
foreground/background execution, testes físicos e bateria. Nenhum deles foi escrito às
cegas — todos estão especificados em `ACTIVITY_DEVICE_ARCHITECTURE.md` §7, com arquivos,
permissões, lifecycle e plano de teste, prontos para serem implementados contra as portas
que já existem.

A P2 vira PASS quando a camada nativa for compilada e validada em Android e iOS reais.

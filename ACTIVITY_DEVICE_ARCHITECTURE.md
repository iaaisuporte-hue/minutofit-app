# ACTIVITY_DEVICE_ARCHITECTURE — camada de atividade e dispositivos

**Versão:** 1.0 · 02 set 2026
**Escopo:** SPEC Mobile P2 §85. Base técnica da P3.
**Estado:** o domínio e a camada web estão **implementados e verificados**. Os adapters
nativos estão **especificados aqui e não implementados** — ver §9.

---

## 1. Modelo canônico de Atividade

Uma **atividade** é exercício com duração no tempo que **não** é execução de ficha:
caminhada, corrida, ciclismo. Musculação continua em `workout_sessions`, com o motor
próprio das P0/P1.

> **Por que dois domínios e não um.** A §40 pede não fragmentar a UX, e a interface de fato
> os une (histórico e "Iniciar" comuns). Mas as formas são diferentes: um treino é uma
> árvore de exercícios × séries × carga; uma atividade é uma trajetória com métricas
> agregadas. Forçá-los na mesma tabela custaria colunas nulas em massa dos dois lados e um
> discriminador em cada consulta. A união acontece na leitura, não no armazenamento.

### Tabela `activity_sessions`

| Coluna | Origem | Nota |
|---|---|---|
| `id`, `user_id`, `academy_id` | pré-existente | |
| `activity_type` | pré-existente | `walk` · `run` · `cycling` · `cardio` |
| `duration_seconds` | pré-existente | duração **ativa** (sem pausas) |
| `distance_km`, `avg_pace`, `intensity`, `score` | pré-existente | |
| `route_coordinates` | pré-existente | JSONB; a rota vive na própria linha |
| `calories_estimated` | pré-existente | **nossa** conta por MET |
| `started_at`, `ended_at`, `created_at` | pré-existente | |
| **`source`** | P2 | `s2core` · `health_connect` · `apple_health` · `garmin` · `strava` · `manual` · `import` — CHECK no banco |
| **`source_external_id`** | P2 | id **na origem**; chave da dedup |
| **`source_app`** | P2 | app real por trás do agregador (ex.: "Garmin Connect") — §51 |
| **`client_key`** | P2 | idempotência do envio |
| **`avg_heart_rate` / `max_heart_rate`** | P2 | só quando a fonte fornece — §54 |
| **`calories`** | P2 | calorias **medidas pela fonte** |
| **`calories_source`** | P2 | `device` \| `estimated` — §55 |
| **`elevation_gain_m`** | P2 | |
| **`possible_duplicate_of`** | P2 | suspeita da heurística; **nunca apaga** |
| **`updated_at`** | P2 | |

Migration: `1834000000000_activity-canonical-model.js` (round-trip up/down validado).

**`calories` × `calories_estimated` são colunas distintas de propósito.** A §55 proíbe
substituir silenciosamente um dado medido por uma estimativa nossa. Com uma coluna só, um
número do relógio e uma conta por MET ficariam indistinguíveis no histórico e nos motores
que o leem.

---

## 2. Deduplicação

Três defesas, em ordem de confiança. Implementadas em `services/activityService.ts`,
sob `pg_advisory_xact_lock` por usuário (dois POSTs simultâneos não passam limpos pelos
dois SELECTs).

### 1. `client_key` — certeza total
Índice `uniq_activity_client_key` sobre `(user_id, client_key)` **parcial** (`WHERE
client_key IS NOT NULL`). O cliente gera a chave uma vez por atividade e a repete no
reenvio. Replay devolve **200 + `deduplicated: true`** com o id existente; criação devolve
201. Parcial porque atividade sem chave (legado, importação) precisa conviver.

### 2. `source_external_id` — certeza da origem
Índice `uniq_activity_source_external` sobre `(user_id, source, source_external_id)`,
parcial. **A origem faz parte da chave**: Health Connect e Garmin direto podem usar espaços
de id independentes, e uma colisão acidental não pode fundir duas atividades.

### 3. Janela temporal — suspeita, nunca descarte
Quando nenhum identificador existe: mesmo `user_id`, mesmo `activity_type`, início dentro
de **±3 min** e duração compatível (**10% ou 60 s, o que for maior**).

> **A atividade é GRAVADA assim mesmo**, com `possible_duplicate_of` apontando para a que já
> existia. A §5 proíbe heurística destrutiva, e a assimetria é clara: um duplicado visível é
> um incômodo que o usuário resolve; um treino apagado por semelhança é um treino que
> aconteceu e sumiu. Os 3 minutos existem porque relógio de aparelho e de serviço divergem.

Anti-loop de escrita (§45): uma atividade que o S2Core escreve no Health Connect volta na
importação seguinte **com `source_external_id`**, e a defesa 2 a reconhece. O adapter deve
guardar o `externalId` devolvido pela escrita — ver §7.3.

---

## 3. GPS

### Amostragem (§27)
`watchPosition` com `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 15000`.

Não usamos frequência fixa por `setInterval`: pedir mais rápido que o receptor produz não
melhora precisão e gasta bateria; pedir mais devagar corta cantos e **encurta** a distância.
O que reduz custo aqui é o filtro, não a taxa.

### Filtro de ruído (§28) — `features/tracker/gpsFilter.ts`

| Rejeição | Limite | Por quê |
|---|---|---|
| Precisão ruim | `accuracy > 35 m` | O aparelho já admitiu que não sabe onde está |
| Teleporte | salto `> 200 m` entre leituras | Ninguém anda 200 m entre dois pings; é recuperação de fix |
| Velocidade irreal | por modalidade: caminhada 20, corrida 30, bike 70 km/h | Um trecho a 40 km/h a pé é ruído ou é um carro |
| Deriva parada | movimento `< 3 m` | GPS "anda" com o aparelho imóvel; num treino longo isso vira quilômetros |

**Não suavizamos e não interpolamos.** Kalman inventa pontos onde não houve medição;
interpolar inventa percurso onde houve perda de sinal. Os dois melhoram o traçado e pioram
a honestidade do número. Perdeu sinal, aquele trecho não conta — e `descartados` reporta.

**Efeito medido:** 490 m reais com um teleporte de 500 m no meio → **0,49 km**. Sem filtro
seriam ~1,5 km.

### Distância (§29)
Soma de Haversine sobre a trajetória **filtrada**. Nunca velocidade × tempo.

### Pace e velocidade (§30, §21)
`pace = duração ATIVA / distância`. Sem distância devolve `null` (exibido "--"), nunca 0 —
"0:00 /km" seria o pace mais rápido possível. Bike usa **km/h**; caminhada e corrida, pace.

---

## 4. Persistência e recuperação

### Rascunho incremental (§36) — `features/tracker/activityDraft.ts`
Chave **fixa** `s2core:activity:draft` (uma atividade por aparelho). Cada ponto do GPS é
gravado **no instante em que chega**.

> Antes desta fase a rota vivia só no estado do React até "Finalizar": um crash na
> quadragésima quinta minuto apagava a corrida inteira. É o mesmo defeito que a P0 corrigiu
> no treino.

**Tudo é instante absoluto**, nunca contador: `startedAt` e uma lista de `pausas`
(`{inicio, fim}`). A duração é **derivada** na leitura. Um contador por `setInterval`
congela junto com o JS quando a tela apaga e voltaria atrasado exatamente pelo tempo em que
a pessoa continuou correndo.

### Recuperação (§35)
Ao abrir o Tracker, um rascunho com pontos e com atividade recente (< 6 h) abre o card
"Encontramos uma atividade em andamento" com **três ações e nenhuma automática**:
**Continuar** (reusa o rascunho e a `clientKey`), **Finalizar** (aproveita o percurso já
gravado — o caso de quem esqueceu de parar) e **Descartar** (com confirmação, porque o
percurso não existe em nenhum outro lugar). Rascunho mais velho que 6 h é limpo sozinho.

### Sincronização (§37/§38)
Finalizar **não depende de rede**. O envio leva `clientKey`; o rascunho só é apagado
**depois** da confirmação do servidor. Estados na tela: `Sincronizando…` · `Sincronizado`
(some sozinho) · `Salvo no aparelho — sincroniza quando a conexão voltar` (fica).

---

## 5. Privacidade da rota (§32, §68, §69)

| Onde | Regra | Estado |
|---|---|---|
| Coleta | Só com atividade **iniciada pelo usuário**. Sem rastreio de fundo. | ✅ |
| Permissão | Divulgação de finalidade **antes** do prompt do sistema (§15/§16) | ✅ já existia |
| Armazenamento | `route_coordinates` na própria linha, escopado por `user_id` | ✅ |
| Exclusão | Apagar a atividade apaga a rota (mesma linha) | ✅ verificado |
| Compartilhamento | **A rota nunca entra na arte.** Um mapa numa arte publica onde a pessoa mora e a que horas sai de casa. A §63 chama o mapa de "opcional"; aqui a decisão é não incluir. | ✅ com teste |
| Analytics | Payload de tipo **fechado**: não existe caminho para uma coordenada entrar, nem por descuido futuro. Distância vai em **faixa**, nunca exata. | ✅ com teste de tipo |
| Logs | Nenhum log carrega rota ou coordenada | ✅ |

---

## 6. Deep links (§11) — `lib/deepLinks.ts`

| Link | Destino |
|---|---|
| `s2core://workout/today` | `/app/user/ficha` |
| `s2core://workout/session/{planId}/{dayIndex}` | `/app/user/treino/{planId}/{dayIndex}` |
| `s2core://workout/free` | `/app/user/treino-livre` |
| `s2core://activity` | `/app/user/activities` |
| `s2core://activity/start/{walk\|run\|cycling}` | `/app/user/activities?tipo={...}` |
| `s2core://today` · `profile` · `integrations` | destinos gerais |
| `https://app.s2core.com.br/app/user/...` | App Link, prefixos em allow-list |

**Allow-list, não `pathname` direto.** O link chega de fora — notificação, widget, mensagem.
Encaminhar qualquer caminho recebido transforma um link em navegação arbitrária dentro da
sessão autenticada. Link desconhecido cai na Hoje; nunca em lugar nenhum.

`?from=widget|notification|quick_action` viaja no link e responde "quanto o widget é
utilizado?" (§71) sem mecanismo de rastreio novo.

---

## 7. Adapters nativos — **especificação, não implementação**

Nada nesta seção existe em código. É o contrato que a §85 pede, no vocabulário que o
domínio já fala.

### 7.1 `LocationTracker` — background real

**Porta:** `features/tracker/ports/LocationTracker.ts` (existe). **Adapter web:**
`WebLocationTracker` (existe, e declara `suportaSegundoPlano: false` — a UI usa isso para
avisar que a tela precisa ficar ligada).

```ts
interface LocationTracker {
  readonly nome: string;
  readonly suportaSegundoPlano: boolean;
  disponivel(): boolean;
  estadoPermissao(): Promise<PermissaoLocalizacao>;
  solicitarPermissao(): Promise<PermissaoLocalizacao>;
  iniciar(opts: { onPonto: (p: PontoBruto) => void; onErro?: (e: ErroLocalizacao) => void }): () => void;
}
```

**Android** — plugin Capacitor com **foreground service** (§25).

| Item | Definição |
|---|---|
| Arquivos | `android/app/src/main/java/com/s2core/app/location/LocationForegroundService.kt`, `S2LocationPlugin.kt` |
| Permissões | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` (já declaradas), **`FOREGROUND_SERVICE`**, **`FOREGROUND_SERVICE_LOCATION`** (obrigatória no Android 14+) |
| Manifesto | `<service android:name=".location.LocationForegroundService" android:foregroundServiceType="location" android:exported="false"/>` |
| Lifecycle | `startForegroundService()` no `iniciar()` → `startForeground()` com notificação em ≤5 s (senão ANR) → `stopSelf()` no encerramento |
| Notificação | Canal próprio, baixa prioridade, **não dispensável**. Conteúdo: `S2Core — Corrida · 32:41 · 5,04 km`, `contentIntent` = `s2core://activity?from=notification` (§25/§59) |
| API de posição | `FusedLocationProviderClient` com `Priority.PRIORITY_HIGH_ACCURACY`, `setMinUpdateIntervalMillis(1000)` |
| Ponte | Cada posição → `notifyListeners("ponto", {...})`, mesmo shape de `PontoBruto` |
| **Não fazer** | `WAKE_LOCK` para manter a CPU, `ACCESS_BACKGROUND_LOCATION` (desnecessária com foreground service), pedir isenção de otimização de bateria |

**iOS** (§26).

| Item | Definição |
|---|---|
| Arquivos | `ios/App/App/Location/S2LocationPlugin.swift` |
| Capacidade | Background Modes → **Location updates** (somente) |
| `Info.plist` | `NSLocationWhenInUseUsageDescription` com a mesma frase da divulgação já usada no app |
| API | `CLLocationManager` com `allowsBackgroundLocationUpdates = true`, `pausesLocationUpdatesAutomatically = false`, `activityType = .fitness`, `desiredAccuracy = kCLLocationAccuracyBest` |
| Indicador | A tarja azul do sistema aparece — é o contrato com o usuário, não um problema a esconder |
| **Não fazer** | Pedir `NSLocationAlwaysAndWhenInUseUsageDescription` (não é necessário para o caso de uso) |

### 7.2 `HealthDataProvider` — Health Connect e HealthKit

**Porta:** `features/tracker/ports/HealthDataProvider.ts` (existe, sem implementação).
`provedorDeSaude(plataforma)` devolve **`null`** hoje — e a UI de Integrações usa isso para
mostrar "indisponível nesta versão", nunca um botão inerte.

```ts
interface HealthDataProvider {
  readonly nome: "health_connect" | "apple_health";
  readonly escoposNecessarios: EscopoSaude[];
  disponivel(): Promise<boolean>;
  estadoPermissoes(): Promise<Record<EscopoSaude, "concedida"|"negada"|"nao_solicitada">>;
  solicitarPermissoes(escopos: EscopoSaude[]): Promise<boolean>;
  importarAtividades(desde: Date): Promise<AtividadeImportada[]>;
  escreverAtividade?(a: AtividadeParaExportar): Promise<{ externalId: string } | null>;
  lerMetricasDiarias?(dia: Date): Promise<MetricasDiarias | null>;
}
```

**Health Connect** — `android/.../health/HealthConnectPlugin.kt`

| Item | Definição |
|---|---|
| Dependência | `androidx.health.connect:connect-client` |
| Permissões (§42) | **Somente**: `READ_EXERCISE`, `READ_DISTANCE`, `READ_HEART_RATE`, `READ_TOTAL_CALORIES_BURNED`, `READ_STEPS`, `READ_EXERCISE_ROUTE`. Escrita: `WRITE_EXERCISE` — só se a exportação for ativada |
| Manifesto | `<activity-alias android:name="ViewPermissionUsageActivity">` com `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` — exigido pela Play Store |
| Leitura | `ReadRecordsRequest<ExerciseSessionRecord>` por `TimeRangeFilter.after(desde)` |
| Mapeamento de tipo | `EXERCISE_TYPE_RUNNING`→`run`, `WALKING`→`walk`, `BIKING`→`cycling`. **Tipo não mapeado é IGNORADO** — a §43 proíbe transformar qualquer registro de saúde em treino |
| `sourceExternalId` | `record.metadata.id` |
| `sourceApp` | `record.metadata.dataOrigin.packageName` traduzido (§51) |
| Rota (§44) | `ExerciseRouteResult` exige `READ_EXERCISE_ROUTE` e consentimento por sessão. **Ausência de rota é normal**, não erro |

**HealthKit** — `ios/App/App/Health/HealthKitPlugin.swift`

| Item | Definição |
|---|---|
| Capacidade | HealthKit |
| `Info.plist` | `NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription` |
| Tipos (§47) | `HKWorkoutType`, `distanceWalkingRunning`, `distanceCycling`, `heartRate`, `activeEnergyBurned`, `stepCount` |
| Leitura | `HKSampleQuery` sobre `HKWorkout`; `HKWorkoutRouteQuery` para a rota |
| `sourceExternalId` | `workout.uuid.uuidString` |
| `sourceApp` | `workout.sourceRevision.source.name` |
| Peculiaridade | HealthKit **não informa** se a permissão de leitura foi negada (por privacidade). `estadoPermissoes` devolve `nao_solicitada` nesse caso — e a UI não pode prometer distinguir |

### 7.3 Ownership e anti-loop (§45)

1. Escrever no Health Connect/HealthKit **guarda o `externalId` devolvido** na linha da
   atividade (`source_external_id`, com `source` da plataforma).
2. A importação seguinte traz esse mesmo id → a **defesa 2** reconhece → replay, não
   atividade nova.
3. **Sem o passo 1 o laço fecha errado**: a atividade voltaria como importada e o histórico
   teria duas. Por isso a escrita é opcional na interface e **só deve ser ligada junto** com
   a gravação do id.

### 7.4 Widgets

**Android** — `android/app/src/main/java/com/s2core/app/widget/`

| Item | Definição |
|---|---|
| Tecnologia | Glance (`androidx.glance:glance-appwidget`) |
| Arquivos | `WorkoutWidget.kt` (`GlanceAppWidget`), `WorkoutWidgetReceiver.kt` (`GlanceAppWidgetReceiver`), `widget_info.xml` |
| Manifesto | `<receiver>` com `android.appwidget.action.APPWIDGET_UPDATE` |
| Estados (§8) | sem treino → `[Treino livre]`; planejado → nome + `[Iniciar]`; em andamento → cronômetro + `[Continuar]`; concluído → `[Ver resumo]` |
| Fonte do estado | **Não chama a API.** O app grava um snapshot em `SharedPreferences` (via `@capacitor/preferences`) ao mudar de estado; o widget lê. Widget que faz rede fica lento, falha offline e gasta bateria |
| Ação | `actionStartActivity` com `Intent(ACTION_VIEW, "s2core://workout/today?from=widget")` |
| Atualização | `updateAppWidget` disparado pelo app; **sem `updatePeriodMillis` curto** (mínimo real do sistema é 30 min e acorda o aparelho) |

**iOS** — `ios/App/S2CoreWidget/`

| Item | Definição |
|---|---|
| Tecnologia | WidgetKit + SwiftUI, target de extensão próprio |
| Arquivos | `S2CoreWidget.swift`, `WorkoutEntry.swift`, `Provider.swift` |
| Compartilhamento | **App Group** `group.com.s2core.app` — o app escreve o snapshot, o widget lê. Sem isso a extensão não enxerga nada do app |
| Famílias | `.systemSmall` (§9) e `.systemMedium` (§7) |
| Timeline | `TimelineProvider` com política `.never`; o app chama `WidgetCenter.shared.reloadAllTimelines()` ao mudar de estado |
| Ação | `.widgetURL(URL("s2core://workout/today?from=widget"))` |

### 7.5 Quick Actions (§12)

- **Android:** `res/xml/shortcuts.xml` com `<shortcut>` estáticos → Iniciar treino, Treino
  livre, Iniciar caminhada, Iniciar corrida. Quatro, não mais.
- **iOS:** `UIApplicationShortcutItems` no `Info.plist`, mesmos quatro.
- Ambos apontam para `s2core://...?from=quick_action`.

---

## 8. Plano de teste

### Android (§72)
`minSdk 23` · `target 36`. Emulador API 34 + aparelho físico.

1. **Foreground service:** iniciar corrida, bloquear a tela, esperar 10 min, desbloquear —
   pontos continuam e a notificação mostra tempo e distância corretos.
2. **Doze:** `adb shell dumpsys deviceidle force-idle` durante o tracking.
3. **Morte do processo:** `adb shell am kill com.s2core.app` no meio → reabrir → card de
   recuperação com os pontos que já estavam gravados.
4. **Otimização de bateria:** com o app restrito (padrão em Xiaomi/Samsung), confirmar que o
   foreground service sobrevive; se não sobreviver, **documentar** em vez de pedir isenção.
5. **Health Connect:** conectar, negar um escopo, importar, reimportar (não duplica),
   revogar no app do sistema.
6. **Widget:** adicionar, verificar os quatro estados, tocar e cair na sessão certa.
7. **Bateria (§81):** 30/60/90 min com tela apagada, `adb shell dumpsys batterystats`.

### iOS (§73)
`iOS 15+`. Simulador não serve para GPS em background — **aparelho físico obrigatório**.

1. Background location com a tarja azul; app suspenso 15 min.
2. Encerramento pelo sistema por pressão de memória → recuperação.
3. HealthKit: autorizar parcialmente, importar, verificar que negar leitura é indistinguível
   de "sem dados" (limitação da plataforma, não do app).
4. Widget nas duas famílias; App Group lendo o snapshot.
5. Swipe back durante atividade não descarta.
6. Bateria: 30/60/90 min com a tela bloqueada.

---

## 9. Estado por componente

| Componente | Estado |
|---|---|
| Modelo canônico + migration | ✅ implementado e testado (banco real) |
| Deduplicação (3 defesas) | ✅ implementado e testado (16 testes de integração) |
| Filtro de ruído GPS, distância, pace, velocidade | ✅ implementado e testado (20 testes) |
| Rascunho incremental + recuperação | ✅ implementado e testado (17 testes + QA em navegador) |
| Sincronização idempotente e offline | ✅ implementado e verificado |
| Porta `LocationTracker` + adapter web | ✅ implementado |
| Deep links | ✅ implementado e testado (16 testes) |
| Compartilhamento de atividade | ✅ implementado e testado |
| Analytics com payload fechado | ✅ implementado e testado |
| Porta `HealthDataProvider` | ⚠️ **interface apenas** — sem implementação, e `provedorDeSaude()` devolve `null` |
| `LocationTracker` nativo (foreground service / background iOS) | ❌ **não implementado** — §7.1 |
| Health Connect | ❌ **não implementado** — §7.2 |
| HealthKit | ❌ **não implementado** — §7.2 |
| Widget Android | ❌ **não implementado** — §7.4 |
| Widget iOS | ❌ **não implementado** — §7.4 |
| Quick Actions | ❌ **não implementado** — §7.5 |

O motivo é único e está no relatório: não há JDK, Android SDK, Xcode nem Mac neste
ambiente, e a instrução foi **não escrever implementação nativa às cegas**.

# Abandonar treino pendente fecha o app no Android — diagnóstico e correção (15/10/2026)

Status: **CORRIGIDO EM CÓDIGO E TESTES — HOMOLOGAÇÃO ANDROID PENDENTE.** Sem aparelho/SDK neste ambiente, o defeito **não foi reproduzido em Android**: a causa foi demonstrada tecnicamente pelo código nativo e pelo contrato do `startForegroundService`. Logcat não coletado.

## Fluxo exato
Treino iniciado → não finalizado → processo do app morre/reinicia (rascunho fica no localStorage) → Hoje mostra o card "Você possui um treino em andamento" (`ResumeWorkoutCard`) → **Encerrar treino** → confirmar "Encerrar" → `discardInProgressSession` + `cancelarLembretesTreino` + `createWorkoutLiveSurface().parar()`.

## Causa raiz
`parar()` → plugin `WorkoutLive.stop` → `WorkoutLivePlugin.stop` fazia `ContextCompat.startForegroundService(ACTION_STOP)` **sem checar se o serviço existia**. Após a morte do processo, `WorkoutForegroundService.ativo` é falso e o serviço não está em primeiro plano. O `onStartCommand` tratava `ACTION_STOP` com `encerrar()` (`stopForeground` + `stopSelf`) **sem nunca chamar `startForeground()`**. Desde o Android 8 todo `startForegroundService` exige `startForeground()` em segundos; senão o sistema lança `ForegroundServiceDidNotStartInTimeException` e **derruba o processo** (o app "fecha"). O mesmo vale para UPDATE/voz/wake com `ativo=false`.

## O que foi descartado (por leitura do código)
- JS/React: nenhum `App.exitApp()` no projeto; a confirmação usa `ConfirmDialog` → `useOverlay` (pilha de overlays) → o back do Android fecha só a confirmação (`fecharTopo`); sem overlay e sem histórico a bridge só **minimiza** (`minimizeApp`), nunca fecha. Navegação/rota: o card não navega. Estado: o descarte apaga o rascunho; não marca treino concluído.
- Distinção: *Activity encerrada* (exitApp/finish — inexistente), *processo encerrado* (a causa: exceção nativa fatal do FGS), *navegação externa* (nenhuma), *desmontagem por erro React* (o `parar()` é `void` com `.catch`), *treino concluído por engano* (não ocorre).

## Correção
- `WorkoutLivePlugin.stop`: sem serviço ativo → `stopService` (sem contrato de foreground) e resolve.
- `WorkoutForegroundService.onStartCommand`: ação que exige serviço ativo chegando com `ativo=false` → `cumprirContratoDeForeground()` (startForeground mínimo) → `encerrar()` → `START_NOT_STICKY`.
- `ResumeWorkoutCard`: trava contra duplo toque (ref) e `parar()` em try/catch (melhor esforço).
Estado da sessão antes/depois: antes, crash nativo no meio do descarte (rascunho já apagado, app morto, notificação possivelmente órfã); depois, rascunho descartado uma vez, lembretes cancelados, serviço parado sem crash, app aberto.

## Testes (falham antes, passam depois: 6 de 15)
`ResumeWorkoutCard.test.tsx` (abrir confirmação; cancelar preserva; confirmar executa 1×; duplo toque; back com modal fecha só o modal e sem modal `fecharTopo()=false`; falha do plugin não impede o abandono) e `src/test/androidWorkoutServiceContract.test.ts` (guarda de contrato sobre os fontes Java — **não é execução nativa**). Cenários da tabela do pedido não aplicáveis: "abandono durante salvamento" e "erro de rede" (o abandono é local, sem rede/salvamento). Suíte completa e build limpos (ver relatório no chat).

## Homologação Android (obrigatória, pendente)
1. Build do commit desta branch. 2. Iniciar treino, marcar séries, sair sem finalizar. 3. Forçar morte do processo (Configurações › Forçar parada, ou `adb shell am kill com.s2core.app`) e reabrir: card de treino pendente. 4. Encerrar treino → Voltar (preserva) → Encerrar treino → confirmar: **o app permanece aberto**, card some, sem notificação órfã. 5. Repetir com o botão voltar físico com a confirmação aberta (fecha só a confirmação). 6. Confirmar o estado final (sem rascunho; histórico sem treino concluído). 7. `adb logcat -s S2CoreWorkout AndroidRuntime ActivityManager` e anexar (antes da correção deve aparecer `ForegroundServiceDidNotStartInTimeException`).

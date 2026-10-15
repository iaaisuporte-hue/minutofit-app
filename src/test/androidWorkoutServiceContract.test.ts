/**
 * Contrato do serviço de primeiro plano do treino (Android) — o defeito "app fecha ao abandonar treino pendente".
 *
 * Causa: `WorkoutLivePlugin.stop` chamava `startForegroundService(ACTION_STOP)` mesmo sem serviço ativo (processo reiniciado
 * → `ativo` falso). O serviço tratava STOP com `stopForeground` + `stopSelf` sem NUNCA chamar `startForeground()`; desde o
 * Android 8 isso lança `ForegroundServiceDidNotStartInTimeException` e o sistema derruba o processo.
 *
 * Este teste lê os FONTES Java (não há SDK/JVM Android no CI do SPA): é um guarda de contrato, não uma execução nativa. A
 * verificação real é no aparelho (ver docs/qa) — e o `bundleRelease` do workflow compila o Java.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const __dirname: string;
const dir = resolve(__dirname, "../../android/app/src/main/java/com/s2core/app/workout");
const plugin = readFileSync(resolve(dir, "WorkoutLivePlugin.java"), "utf8");
const service = readFileSync(resolve(dir, "WorkoutForegroundService.java"), "utf8");

const metodo = (src: string, assinatura: string) => {
  const i = src.indexOf(assinatura);
  expect(i, `método ${assinatura} existe`).toBeGreaterThan(-1);
  let depth = 0; let j = src.indexOf("{", i);
  const start = j;
  for (; j < src.length; j++) { if (src[j] === "{") depth++; if (src[j] === "}" && --depth === 0) break; }
  return src.slice(start, j + 1);
};

describe("WorkoutLivePlugin.stop", () => {
  const stop = metodo(plugin, "public void stop(PluginCall call)");
  it("sem serviço ativo NÃO usa startForegroundService (usa stopService e resolve)", () => {
    const semAtivo = stop.slice(0, stop.indexOf("enviarAcao(WorkoutForegroundService.ACTION_STOP"));
    expect(semAtivo).toMatch(/!WorkoutForegroundService\.estaAtivo\(\)/);
    expect(semAtivo).toMatch(/stopService\(/);
    expect(semAtivo).toMatch(/call\.resolve\(\);\s*return;/);
    expect(semAtivo).not.toMatch(/startForegroundService|enviarAcao\(/);
  });
  it("com serviço ativo continua enviando ACTION_STOP", () => {
    expect(stop).toMatch(/enviarAcao\(WorkoutForegroundService\.ACTION_STOP/);
  });
});

describe("WorkoutForegroundService.onStartCommand", () => {
  const onStart = metodo(service, "public int onStartCommand(");
  it("ação que exige serviço ativo, chegando com ativo=false, cumpre o contrato de startForeground ANTES de encerrar", () => {
    const guarda = onStart.slice(onStart.indexOf("if (!ativo && exigeServicoAtivo(acao))"));
    expect(guarda).toMatch(/cumprirContratoDeForeground\(\);\s*encerrar\(\);\s*return START_NOT_STICKY;/);
  });
  it("a guarda vem antes do switch e cobre STOP/UPDATE/voz/wake (os caminhos que antes só davam break/encerrar sem startForeground)", () => {
    expect(onStart.indexOf("exigeServicoAtivo(acao)")).toBeLessThan(onStart.indexOf("switch (acao)"));
    const lista = metodo(service, "private static boolean exigeServicoAtivo(");
    for (const a of ["ACTION_STOP", "ACTION_UPDATE", "ACTION_ENABLE_VOICE", "ACTION_DISABLE_VOICE", "ACTION_WAKE_STOP", "ACTION_WAKE_SUSPEND", "ACTION_WAKE_RESUME"]) expect(lista).toContain(a);
    expect(lista).not.toContain("ACTION_START");
  });
  it("cumprirContratoDeForeground realmente chama startForeground, sem deixar exceção escapar", () => {
    const corpo = metodo(service, "private void cumprirContratoDeForeground()");
    expect(corpo).toMatch(/startForeground\(NOTIFICACAO_ID/);
    expect(corpo).toMatch(/catch \(Exception/);
  });
});

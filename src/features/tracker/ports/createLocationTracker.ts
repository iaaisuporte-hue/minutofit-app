import { getPlatform } from "../../../lib/platform";
import type { LocationTracker } from "./LocationTracker";
import { NativeLocationTracker } from "./NativeLocationTracker";
import { WebLocationTracker } from "./WebLocationTracker";

/**
 * Escolhe a implementação de `LocationTracker` para esta plataforma.
 *
 * Só o Android tem o serviço de primeiro plano (P1B). iOS cai na web: o
 * `BackgroundLocationPlugin` só existe do lado Android, e chamar um método
 * dele onde o plugin nativo não existe rejeita com "not implemented" — pior
 * do que usar a implementação que já funciona, com a limitação conhecida e já
 * sinalizada por `suportaSegundoPlano`. Ver Fase 28 da SPEC: iOS em segundo
 * plano é arquitetura para uma fase futura, não substituição silenciosa aqui.
 *
 * Importar `NativeLocationTracker` estaticamente é seguro em qualquer
 * plataforma: `registerPlugin` só registra um descritor no `Capacitor` global
 * — a rejeição "not implemented" só acontece se um MÉTODO for chamado sem
 * implementação por trás, e isto nunca acontece aqui fora do Android.
 */
export function createLocationTracker(): LocationTracker {
  if (getPlatform() === "android") return new NativeLocationTracker();
  return new WebLocationTracker();
}

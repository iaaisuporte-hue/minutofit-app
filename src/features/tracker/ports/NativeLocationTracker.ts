import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { PontoBruto } from "../gpsFilter";
import type { ErroLocalizacao, EstadoTrackerVisivel, LocationTracker, PermissaoLocalizacao } from "./LocationTracker";

/** Ponto como a ponte Java entrega — mesmos nomes de campo do lado nativo. */
interface PontoNativo {
  lat: number;
  lng: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
  sequence: number;
}

interface EstadoPlugin {
  available: boolean;
  running: boolean;
  paused: boolean;
}

interface ResultadoDreno {
  points: PontoNativo[];
  running: boolean;
}

interface PermissaoPlugin {
  location: "granted" | "denied" | "prompt" | "prompt-with-rationale";
}

/**
 * Contrato do plugin nativo `BackgroundLocationPlugin.java` (Android).
 *
 * `checkPermissions`/`requestPermissions` não são implementados no Java: o
 * Capacitor os gera sozinho a partir do `@Permission(alias = "location", ...)`
 * declarado no plugin — é o mesmo mecanismo usado por plugins oficiais como
 * `@capacitor/camera`.
 */
interface BackgroundLocationPluginApi {
  isAvailable(): Promise<EstadoPlugin>;
  start(opts: { title?: string; text?: string }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  drain(): Promise<ResultadoDreno>;
  updateState(opts: {
    elapsed: string;
    distance: string;
    metricValue: string;
    metricUnit: string;
  }): Promise<void>;
  checkPermissions(): Promise<PermissaoPlugin>;
  requestPermissions(): Promise<PermissaoPlugin>;
  addListener(eventName: "location", listener: (p: PontoNativo) => void): Promise<PluginListenerHandle>;
}

const BackgroundLocation = registerPlugin<BackgroundLocationPluginApi>("BackgroundLocation");

function paraPontoBruto(p: PontoNativo): PontoBruto {
  return { lat: p.lat, lng: p.lng, accuracy: p.accuracy, altitude: p.altitude, timestamp: p.timestamp };
}

function traduzirPermissao(estado: PermissaoPlugin["location"]): PermissaoLocalizacao {
  if (estado === "granted") return "concedida";
  if (estado === "denied") return "negada";
  return "nao_solicitada";
}

/**
 * `LocationTracker` sobre o serviço de primeiro plano do Android (P1B).
 *
 * Diferente da web, aqui `iniciar()` NÃO é "começar a escutar" — é "subir o
 * Foreground Service", que precisa sobreviver a pausas (a notificação não pode
 * piscar) e ao WebView sendo suspenso (o serviço é quem garante que o GPS
 * continua). `pausar()`/`retomar()` chegam ao serviço como ações próprias,
 * sem derrubá-lo; só `iniciar()`/o cleanup dele sobem e derrubam de verdade.
 *
 * ## Ao vivo × drenado
 *
 * Com o app em primeiro plano, o evento `location` chega aqui e vira `onPonto`
 * na hora — é o caminho que faz o mapa atualizar em tempo real. Com o WebView
 * suspenso o evento não chega a lugar nenhum; o serviço acumula, e é
 * `drenar()` (chamado pela tela ao detectar a volta ao primeiro plano) que
 * recupera esses pontos. Os dois caminhos alimentam o MESMO rascunho — a UI
 * não precisa saber qual dos dois trouxe um ponto.
 */
export class NativeLocationTracker implements LocationTracker {
  readonly nome = "android-foreground-service";
  readonly suportaSegundoPlano = true;

  private handle: PluginListenerHandle | null = null;

  disponivel(): boolean {
    return true;
  }

  async estadoPermissao(): Promise<PermissaoLocalizacao> {
    try {
      const r = await BackgroundLocation.checkPermissions();
      return traduzirPermissao(r.location);
    } catch {
      return "nao_solicitada";
    }
  }

  async solicitarPermissao(): Promise<PermissaoLocalizacao> {
    try {
      const r = await BackgroundLocation.requestPermissions();
      return traduzirPermissao(r.location);
    } catch {
      return "negada";
    }
  }

  /** `true` entre `iniciar()` e `parar()` — evita que um listener tardio de uma
   *  sessão anterior alimente `onPonto` de uma sessão nova. */
  private cancelado = true;

  iniciar(opts: { onPonto: (p: PontoBruto) => void; onErro?: (e: ErroLocalizacao) => void }): void {
    this.cancelado = false;

    void BackgroundLocation.addListener("location", (p) => {
      if (!this.cancelado) opts.onPonto(paraPontoBruto(p));
    }).then((h) => {
      if (this.cancelado) void h.remove();
      else this.handle = h;
    });

    // Título/texto genéricos por ora: a notificação com tempo/distância/pace
    // ao vivo é a P1C, que ainda não começou (SPEC §10 desta fase).
    void BackgroundLocation.start({ title: "S2Core", text: "Registrando sua atividade." }).catch((err) => {
      const msg = String((err as { message?: string })?.message ?? err);
      opts.onErro?.({ tipo: /permission/i.test(msg) ? "permissao_negada" : "indisponivel" });
    });
  }

  pausar(): void {
    void BackgroundLocation.pause().catch(() => {});
  }

  retomar(): void {
    void BackgroundLocation.resume().catch(() => {});
  }

  /**
   * Seguro chamar sem uma sessão em curso: o plugin trata `stop()` como
   * idempotente do lado Java (ver `LocationForegroundService.encerrar`), e é
   * exatamente esse caminho que fecha o risco de `START_STICKY` reviver o
   * serviço depois de o processo morrer sem ninguém do lado web para desligá-lo.
   */
  parar(): void {
    this.cancelado = true;
    this.handle?.remove().catch(() => {});
    this.handle = null;
    void BackgroundLocation.stop().catch(() => {});
  }

  async drenar(): Promise<PontoBruto[]> {
    try {
      const r = await BackgroundLocation.drain();
      return r.points.map(paraPontoBruto);
    } catch {
      return [];
    }
  }

  /**
   * Fire-and-forget, como pausar()/retomar(): perder uma atualização de
   * notificação não é motivo para propagar erro para a tela do treino — a
   * próxima chamada (1s depois) corrige sozinha.
   */
  atualizarEstadoVisivel(estado: EstadoTrackerVisivel): void {
    void BackgroundLocation.updateState({
      elapsed: estado.tempoLabel,
      distance: estado.distanciaLabel,
      metricValue: estado.metricaValor,
      metricUnit: estado.metricaUnidade,
    }).catch(() => {});
  }
}

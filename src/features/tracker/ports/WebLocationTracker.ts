import type { PontoBruto } from "../gpsFilter";
import type { ErroLocalizacao, LocationTracker, PermissaoLocalizacao } from "./LocationTracker";

/**
 * `LocationTracker` sobre `navigator.geolocation` (web, PWA e WebView).
 *
 * É a implementação REAL usada hoje. Ela funciona com o app aberto e a tela
 * ligada, que é o caso do treino ao ar livre com o telefone no braço ou na mão.
 *
 * ## Amostragem (SPEC §27)
 *
 * `watchPosition` com `enableHighAccuracy: true` e `maximumAge: 0`: o sistema
 * entrega quando tem posição nova, tipicamente a cada 1–2 s em céu aberto.
 * Não usamos `setInterval` para pedir posição em frequência fixa — pedir mais
 * rápido do que o receptor produz não melhora a precisão, só gasta bateria; e
 * pedir mais devagar do que ele produz corta cantos da trajetória e ENCURTA a
 * distância.
 *
 * `timeout: 15000` reconhece a realidade do primeiro fix: em ambiente urbano
 * ele leva mais de 10 s com frequência, e um timeout curto derrubaria a
 * atividade justo no minuto inicial.
 *
 * O que reduz o custo aqui não é diminuir a taxa de leitura — é o filtro
 * (`gpsFilter`), que descarta o que não é movimento antes de virar distância.
 */
export class WebLocationTracker implements LocationTracker {
  readonly nome = "web-geolocation";

  /**
   * `false`, e isto é a verdade, não uma limitação a esconder: com a tela
   * apagada o JS congela e `watchPosition` para de entregar. A UI usa este
   * valor para avisar antes de a pessoa sair correndo.
   */
  readonly suportaSegundoPlano = false;

  disponivel(): boolean {
    return typeof navigator !== "undefined" && !!navigator.geolocation;
  }

  async estadoPermissao(): Promise<PermissaoLocalizacao> {
    if (!this.disponivel()) return "indisponivel";
    try {
      // `navigator.permissions` não existe em todo WebView; sem ele não há como
      // saber sem pedir, e "não solicitada" é a resposta honesta.
      const perms = (navigator as Navigator & {
        permissions?: { query: (d: { name: PermissionName }) => Promise<PermissionStatus> };
      }).permissions;
      if (!perms?.query) return "nao_solicitada";
      const st = await perms.query({ name: "geolocation" as PermissionName });
      if (st.state === "granted") return "concedida";
      if (st.state === "denied") return "negada";
      return "nao_solicitada";
    } catch {
      return "nao_solicitada";
    }
  }

  /**
   * Na web não existe "pedir permissão" isolado: o prompt aparece na primeira
   * leitura. Fazemos uma leitura única — que é o gesto mínimo capaz de abrir o
   * diálogo — e traduzimos o resultado.
   */
  async solicitarPermissao(): Promise<PermissaoLocalizacao> {
    if (!this.disponivel()) return "indisponivel";
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve("concedida"),
        (err) => resolve(err.code === err.PERMISSION_DENIED ? "negada" : "nao_solicitada"),
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    });
  }

  /** `watchPosition` em curso, para pausar sem perder a inscrição. */
  private watchId: number | null = null;
  private opcoes: { onPonto: (p: PontoBruto) => void; onErro?: (e: ErroLocalizacao) => void } | null = null;

  iniciar(opts: { onPonto: (p: PontoBruto) => void; onErro?: (e: ErroLocalizacao) => void }): void {
    if (!this.disponivel()) {
      opts.onErro?.({ tipo: "indisponivel" });
      return;
    }
    this.opcoes = opts;
    this.escutar();
  }

  /** Pausa solta o receptor: manter o GPS ligado sem usar só gasta bateria. */
  pausar(): void {
    this.pararRecepcao();
  }

  retomar(): void {
    if (this.opcoes) this.escutar();
  }

  /** Seguro chamar sem uma sessão em curso: `pararRecepcao` já é no-op nesse caso. */
  parar(): void {
    this.opcoes = null;
    this.pararRecepcao();
  }

  /** Nada acumula na web: quem coleta é o próprio JavaScript, que dorme junto. */
  async drenar(): Promise<PontoBruto[]> {
    return [];
  }

  private pararRecepcao(): void {
    if (this.watchId === null) return;
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }

  private escutar(): void {
    const opts = this.opcoes;
    if (!opts || this.watchId !== null) return;

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        opts.onPonto({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          altitude: pos.coords.altitude ?? null,
          timestamp: pos.timestamp || Date.now(),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) opts.onErro?.({ tipo: "permissao_negada" });
        else if (err.code === err.TIMEOUT) opts.onErro?.({ tipo: "timeout" });
        else opts.onErro?.({ tipo: "sinal_perdido" });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }
}

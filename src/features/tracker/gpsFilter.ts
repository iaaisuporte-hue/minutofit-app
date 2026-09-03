import { getDistanceBetweenPointsKm } from "./geometry";
import type { Activity } from "./types";

/**
 * Filtro de ruído GPS (SPEC Mobile P2 §28) e distância por trajetória (§29).
 *
 * ## O problema que isto resolve
 *
 * Antes, `calculateRouteDistanceKm` somava TODOS os pontos que o
 * `watchPosition` entregasse. O GPS de celular não entrega uma trajetória: ele
 * entrega uma nuvem. Entre prédios, dentro de um túnel ou no primeiro minuto
 * antes do fix estabilizar, ele produz saltos de dezenas de metros que nunca
 * aconteceram — e cada salto virava distância percorrida. O efeito é sempre na
 * mesma direção: a distância INFLA. Quem caminhou 3 km via 3,8 km, e o pace, o
 * gasto calórico e o score derivavam todos desse número inflado.
 *
 * ## As quatro rejeições, e por que cada uma
 *
 * 1. **Precisão ruim** (`accuracy` > 35 m). O aparelho já está dizendo que não
 *    sabe onde está. Usar o ponto mesmo assim é escolher acreditar em quem
 *    acabou de admitir a dúvida.
 * 2. **Teleporte** (salto > 200 m entre leituras consecutivas). Nenhuma pessoa
 *    se move 200 m entre dois pings de GPS; isso é o receptor recuperando o fix.
 * 3. **Velocidade irreal** (acima do teto do tipo de atividade). Um trecho de
 *    caminhada a 40 km/h é ruído ou é um carro — nos dois casos não é a
 *    caminhada.
 * 4. **Deriva parada** (movimento abaixo de 3 m). Com o aparelho imóvel o GPS
 *    "anda" alguns metros por minuto. Somar essa deriva dá quilômetros num
 *    treino longo sem que ninguém tenha saído do lugar.
 *
 * ## O que NÃO fazemos
 *
 * Não suavizamos a trajetória (Kalman, média móvel) e não interpolamos buracos.
 * Suavizar inventa pontos onde não houve medição; interpolar inventa percurso
 * onde houve perda de sinal. Os dois melhoram a aparência do traçado e pioram a
 * honestidade do número. Perdeu sinal, a distância daquele trecho não conta —
 * e é isso que o `pontosDescartados` reporta.
 */

/** Um ponto cru, como o `watchPosition` entrega. */
export interface PontoBruto {
  lat: number;
  lng: number;
  /** Precisão horizontal em METROS, quando o aparelho informa. */
  accuracy?: number | null;
  /** Instante da leitura (ms). */
  timestamp: number;
  /** Altitude em metros, quando disponível. */
  altitude?: number | null;
}

/** Ponto aceito, já com a distância que ele acrescentou. */
export interface PontoAceito extends PontoBruto {
  /** Metros acrescentados em relação ao ponto aceito anterior. */
  deltaM: number;
  /** Velocidade instantânea do trecho, km/h. */
  kmh: number;
}

/** Precisão pior que isto e o ponto não entra. */
export const PRECISAO_MAXIMA_M = 35;

/** Salto maior que isto entre leituras é recuperação de fix, não movimento. */
export const SALTO_MAXIMO_M = 200;

/** Abaixo disto é deriva do receptor parado, não deslocamento. */
export const MOVIMENTO_MINIMO_M = 3;

/**
 * Teto de velocidade por modalidade (km/h).
 *
 * Deliberadamente ACIMA do que o `SPEED_THRESHOLDS` da validação heurística
 * usa: aquele decide se a SESSÃO inteira parece fraude; este decide se UM
 * trecho é ruído. Um pico isolado numa descida de bicicleta é plausível; o
 * mesmo pico numa caminhada, não.
 */
export const VELOCIDADE_MAXIMA_KMH: Record<Activity["type"], number> = {
  walk: 20,
  run: 30,
  cycling: 70,
};

export type MotivoDescarte = "precisao" | "salto" | "velocidade" | "parado";

export interface ResultadoFiltro {
  /** Pontos aceitos, na ordem. */
  pontos: PontoAceito[];
  /** Distância acumulada em km, só dos trechos aceitos. */
  distanciaKm: number;
  /** Quantos pontos foram rejeitados, por motivo — alimenta o diagnóstico. */
  descartados: Record<MotivoDescarte, number>;
  /** Ganho de elevação acumulado (m), quando há altitude. */
  ganhoElevacaoM: number;
}

function vazio(): ResultadoFiltro {
  return {
    pontos: [],
    distanciaKm: 0,
    descartados: { precisao: 0, salto: 0, velocidade: 0, parado: 0 },
    ganhoElevacaoM: 0,
  };
}

/**
 * Filtra a trajetória e devolve a distância percorrida.
 *
 * Incremental por natureza: rodar sobre a lista inteira a cada ponto novo é
 * O(n) e, para uma corrida de uma hora a um ponto por segundo, são 3600
 * elementos — barato o bastante para não valer a complexidade de manter estado
 * parcial, e muito mais fácil de testar.
 */
export function filtrarTrajetoria(
  brutos: PontoBruto[],
  tipo: Activity["type"],
): ResultadoFiltro {
  const r = vazio();
  if (!brutos || brutos.length === 0) return r;

  const tetoKmh = VELOCIDADE_MAXIMA_KMH[tipo] ?? VELOCIDADE_MAXIMA_KMH.run;
  let anterior: PontoBruto | null = null;
  let altitudeAnterior: number | null = null;

  for (const p of brutos) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;

    // (1) precisão — vale inclusive para o primeiro ponto: começar a rota num
    // ponto ruim contamina o primeiro trecho inteiro.
    if (p.accuracy != null && Number.isFinite(p.accuracy) && p.accuracy > PRECISAO_MAXIMA_M) {
      r.descartados.precisao += 1;
      continue;
    }

    if (!anterior) {
      anterior = p;
      r.pontos.push({ ...p, deltaM: 0, kmh: 0 });
      altitudeAnterior = p.altitude ?? null;
      continue;
    }

    const metros = getDistanceBetweenPointsKm(anterior, p) * 1000;

    // (2) teleporte
    if (metros > SALTO_MAXIMO_M) {
      r.descartados.salto += 1;
      continue;
    }

    // (4) deriva com o aparelho parado. Antes da checagem de velocidade porque
    // um movimento de 1 m num intervalo de 100 ms produz uma velocidade
    // altíssima que seria classificada como "irreal" — o motivo certo é este.
    if (metros < MOVIMENTO_MINIMO_M) {
      r.descartados.parado += 1;
      continue;
    }

    const segundos = Math.max(0.001, (p.timestamp - anterior.timestamp) / 1000);
    const kmh = (metros / 1000) / (segundos / 3600);

    // (3) velocidade irreal para a modalidade
    if (kmh > tetoKmh) {
      r.descartados.velocidade += 1;
      continue;
    }

    r.pontos.push({ ...p, deltaM: metros, kmh });
    r.distanciaKm += metros / 1000;

    // Elevação: só o ganho, e só quando a variação é grande o bastante para não
    // ser ruído do barômetro/GPS vertical (que é bem pior que o horizontal).
    if (p.altitude != null && altitudeAnterior != null) {
      const subida = p.altitude - altitudeAnterior;
      if (subida > 1) r.ganhoElevacaoM += subida;
    }
    if (p.altitude != null) altitudeAnterior = p.altitude;

    anterior = p;
  }

  r.distanciaKm = Math.round(r.distanciaKm * 1000) / 1000;
  r.ganhoElevacaoM = Math.round(r.ganhoElevacaoM);
  return r;
}

/**
 * Pace em minutos por km (SPEC §30).
 *
 * `duracaoAtivaS` é o tempo SEM as pausas — passar o tempo de parede daria um
 * pace pior a cada semáforo, e a pessoa foi orientada a pausar justamente para
 * que isso não acontecesse.
 *
 * Devolve `null`, e não 0, quando não há distância: zero seria exibido como
 * "0:00 /km", que é o pace mais rápido possível. `null` a UI mostra como "--".
 */
export function calcularPace(duracaoAtivaS: number, distanciaKm: number): number | null {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) return null;
  if (!Number.isFinite(duracaoAtivaS) || duracaoAtivaS <= 0) return null;
  return duracaoAtivaS / 60 / distanciaKm;
}

/** Velocidade média em km/h — a métrica principal da bike (§21). */
export function calcularVelocidadeKmh(duracaoAtivaS: number, distanciaKm: number): number | null {
  if (!Number.isFinite(distanciaKm) || distanciaKm <= 0) return null;
  if (!Number.isFinite(duracaoAtivaS) || duracaoAtivaS <= 0) return null;
  return distanciaKm / (duracaoAtivaS / 3600);
}

/** "6:24" a partir de 6.4 min/km. Minutos e segundos, como se lê pace. */
export function formatarPace(pace: number | null): string {
  if (pace == null || !Number.isFinite(pace) || pace <= 0) return "--";
  const min = Math.floor(pace);
  const seg = Math.round((pace - min) * 60);
  // 6.999 arredonda para 7:00, não para 6:60.
  const [m, s] = seg === 60 ? [min + 1, 0] : [min, seg];
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * A métrica principal da modalidade (§19/§20/§21).
 *
 * Bike mostra velocidade; caminhada e corrida mostram pace. Não é preferência
 * estética: ciclista não pensa em minutos por quilômetro, e exibir pace numa
 * bike é dar o número certo na unidade errada.
 */
export function metricaPrincipal(
  tipo: Activity["type"],
  duracaoAtivaS: number,
  distanciaKm: number,
): { valor: string; unidade: string; rotulo: string } {
  if (tipo === "cycling") {
    const v = calcularVelocidadeKmh(duracaoAtivaS, distanciaKm);
    return { valor: v == null ? "--" : v.toFixed(1), unidade: "km/h", rotulo: "Velocidade média" };
  }
  const p = calcularPace(duracaoAtivaS, distanciaKm);
  return { valor: formatarPace(p), unidade: "/km", rotulo: "Pace médio" };
}

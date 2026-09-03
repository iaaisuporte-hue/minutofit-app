import type { WorkoutShareExercise } from "../../pages/user/lib/shareWorkoutImage";
import { ACTIVITY_META } from "./constants";
import { formatarPace, calcularVelocidadeKmh, calcularPace } from "./gpsFilter";
import type { Activity } from "./types";

/**
 * Compartilhamento da atividade (SPEC Mobile P2 §63/§64/§65).
 *
 * Reusa a infraestrutura da P0 inteira — o compositor de canvas, os dois
 * formatos, o scrim de legibilidade sobre foto, a foto de fundo pela câmera ou
 * galeria e o share sheet nativo. A §64 é explícita: "não duplicar
 * implementação da câmera". Aqui só se traduz uma atividade no vocabulário que
 * aquele compositor já entende.
 *
 * ## O que entra na arte, e o que não entra
 *
 * Duração, distância, ritmo (ou velocidade), FC média e calorias — o que a §65
 * lista, e **somente quando o dado existe**. Um card com "FC média: --" é pior
 * que um card sem a linha.
 *
 * **A rota NUNCA entra.** A §32 classifica percurso como dado sensível de
 * privacidade, e um mapa numa arte compartilhada em rede social publica onde a
 * pessoa mora e a que horas ela sai de casa. O §63 chama o mapa de "opcional";
 * aqui a decisão é não incluir — e ela é registrada, não esquecida.
 */

/** Manchete da arte: "CORRIDA CONCLUÍDA". */
export function eyebrowDaAtividade(tipo: Activity["type"]): string {
  return `${ACTIVITY_META[tipo].label.toUpperCase()} CONCLUÍDA`;
}

/**
 * O destaque da arte: distância quando houve, senão a duração.
 *
 * Quem correu 5 km quer ver "5,14 km"; quem fez 40 minutos de bicicleta
 * ergométrica sem GPS quer ver o tempo. O número que a pessoa conta é o número
 * que a arte mostra.
 */
export function focoDaAtividade(a: Activity): string {
  if (a.distance > 0) return `${a.distance.toFixed(2).replace(".", ",")} km`;
  const min = Math.round(a.duration / 60);
  return `${min} min`;
}

/**
 * As linhas do painel — mesmo shape da mini tabela de exercícios.
 *
 * `name` vira o rótulo à esquerda e `reps` o valor à direita; é a estrutura que
 * o compositor já desenha, sem precisar de um painel novo.
 */
export function linhasDaAtividade(a: Activity): WorkoutShareExercise[] {
  const linhas: WorkoutShareExercise[] = [];

  const h = Math.floor(a.duration / 3600);
  const m = Math.floor((a.duration % 3600) / 60);
  const s = a.duration % 60;
  linhas.push({
    name: "Duração",
    reps: h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`,
  });

  if (a.distance > 0) {
    linhas.push({ name: "Distância", reps: `${a.distance.toFixed(2).replace(".", ",")} km` });

    // A unidade segue a modalidade (§21): bike em km/h, o resto em pace.
    if (a.type === "cycling") {
      const v = calcularVelocidadeKmh(a.duration, a.distance);
      if (v != null) linhas.push({ name: "Velocidade média", reps: `${v.toFixed(1).replace(".", ",")} km/h` });
    } else {
      const p = calcularPace(a.duration, a.distance);
      if (p != null) linhas.push({ name: "Pace médio", reps: `${formatarPace(p)} /km` });
    }
  }

  if (a.calories && a.calories > 0) {
    linhas.push({ name: "Calorias", reps: `${a.calories} kcal` });
  }

  return linhas;
}

/** Texto que acompanha o compartilhamento. Sem local, sem horário, sem rota. */
export function textoDaAtividade(a: Activity): string {
  const partes = [`${ACTIVITY_META[a.type].label} concluída 💪`];
  const chips: string[] = [];
  if (a.distance > 0) chips.push(`${a.distance.toFixed(2).replace(".", ",")} km`);
  chips.push(`${Math.round(a.duration / 60)} min`);
  partes.push(chips.join(" · "));
  partes.push("Treine com inteligência metabólica — S2Core");
  return partes.join("\n");
}

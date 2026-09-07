/**
 * Corpus PT-BR do parser determinístico (P5B — critério "≥80% resolvido por
 * regra, ≥150 frases", ver plano P5 §23/P5B §30).
 *
 * Cada caso é `[frase, intent esperado (ou null), contexto opcional]`.
 * `expectIntent` compara só os campos presentes no esperado — `matches`,
 * `observation` etc. só quando o caso realmente testa esses campos.
 */
import { describe, expect, it } from "vitest";
import { parseVoiceCommand, type VoiceIntent, type VoiceParseContext } from "./voiceIntent";

type Caso = [string, Partial<VoiceIntent> | null, VoiceParseContext?];

const CASOS: Caso[] = [
  // ── conclusão de série (dígitos, extenso, unidades) ─────────────────────
  ["fiz 12 com 28 quilos", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 12 com 28", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["12 com 28", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 10 com 30 quilos", { type: "complete_set", reps: 10, loadKg: 30 }],
  ["consegui 8 com 30", { type: "complete_set", reps: 8, loadKg: 30 }],
  ["completei 10 com 25", { type: "complete_set", reps: 10, loadKg: 25 }],
  ["terminei 12 com 20", { type: "complete_set", reps: 12, loadKg: 20 }],
  ["doze com vinte e oito", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz doze com vinte e oito quilos", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz oito com trinta", { type: "complete_set", reps: 8, loadKg: 30 }],
  ["só 12", { type: "complete_set", reps: 12, loadKg: null }],
  ["somente 10", { type: "complete_set", reps: 10, loadKg: null }],
  ["apenas 8", { type: "complete_set", reps: 8, loadKg: null }],
  ["fiz 8 com 27,5", { type: "complete_set", reps: 8, loadKg: 27.5 }],
  ["fiz 8 com vinte e sete vírgula cinco", { type: "complete_set", reps: 8, loadKg: 27.5 }],
  ["fiz 6 com vinte e oito e meio", { type: "complete_set", reps: 6, loadKg: 28.5 }],
  ["fiz 12 de 28 quilos", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 12 reps com 28", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 12 repetições com 28 quilos", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["concluir série", { type: "complete_set", reps: null, loadKg: null }],
  ["concluiu série", { type: "complete_set", reps: null, loadKg: null }],
  ["fiz 10", { type: "complete_set", reps: 10, loadKg: null }],
  ["fiz cinco", { type: "complete_set", reps: 5, loadKg: null }],
  ["fiz vinte", { type: "complete_set", reps: 20, loadKg: null }],
  ["fiz quinze com quarenta", { type: "complete_set", reps: 15, loadKg: 40 }],
  ["fiz 12 com 28 kg", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 12 com 28 kilos", { type: "complete_set", reps: 12, loadKg: 28 }],
  ["fiz 9 com 22", { type: "complete_set", reps: 9, loadKg: 22 }],
  ["fiz 7 com 18 quilos", { type: "complete_set", reps: 7, loadKg: 18 }],
  ["fiz 11 com 33", { type: "complete_set", reps: 11, loadKg: 33 }],

  // ── "N de M" — meta de reps vs carga, dependente de contexto ────────────
  ["fiz 10 de 12", { type: "complete_set", reps: 10, targetReps: 12, loadKg: null }, { plannedReps: "12" }],
  ["fiz 10 de 12", { type: "complete_set", reps: 10, targetReps: 12, loadKg: null }, { plannedReps: "10-12" }],
  ["fiz 10 de 30 quilos", { type: "complete_set", reps: 10, loadKg: 30 }, { plannedReps: "12" }],
  ["fiz 10 de 12", { type: "complete_set", reps: 10, loadKg: 12 }],

  // ── observação embutida na conclusão ────────────────────────────────────
  ["fiz 10 de 12 porque senti uma fisgada", { type: "complete_set", reps: 10, targetReps: 12 }, { plannedReps: "12" }],
  ["fiz 8 com 30, estava pesado demais", { type: "complete_set", reps: 8, loadKg: 30 }],
  ["fiz 10 porque perdi força", { type: "complete_set", reps: 10 }],
  ["fiz 12 tranquilo", { type: "complete_set", reps: 12 }],

  // ── carga/reps avulsos (sem concluir) ────────────────────────────────────
  ["30 quilos", { type: "set_load", loadKg: 30 }],
  ["coloca 30", { type: "set_load", loadKg: 30 }],
  ["coloca 30 quilos", { type: "set_load", loadKg: 30 }],
  ["subi para 32 e meio", { type: "set_load", loadKg: 32.5 }],
  ["baixa para 25", { type: "set_load", loadKg: 25 }],
  ["diminui para 20", { type: "set_load", loadKg: 20 }],
  ["aumenta para 35", { type: "set_load", loadKg: 35 }],
  ["sobe para 40", { type: "set_load", loadKg: 40 }],
  ["coloca 12 repetições", { type: "set_reps", reps: 12 }],
  ["coloca 10 reps", { type: "set_reps", reps: 10 }],
  ["quarenta quilos", { type: "set_load", loadKg: 40 }],

  // ── navegação ────────────────────────────────────────────────────────────
  ["próximo exercício", { type: "next_exercise" }],
  ["próximo", { type: "next_exercise" }],
  ["avança", { type: "next_exercise" }],
  ["avança para o próximo", { type: "next_exercise" }],
  ["anterior", { type: "previous_exercise" }],
  ["exercício anterior", { type: "previous_exercise" }],
  ["volta um", { type: "previous_exercise" }],
  ["volta", { type: "previous_exercise" }],
  [
    "vai para o supino inclinado",
    { type: "go_to_exercise", nameQuery: "supino inclinado", matches: ["Supino Inclinado"] },
    { sessionExerciseNames: ["Supino Inclinado", "Tríceps Corda", "Rosca Direta"] },
  ],
  [
    "vai para o supino",
    { type: "go_to_exercise", nameQuery: "supino" },
    { sessionExerciseNames: ["Supino Reto", "Supino Inclinado", "Rosca Direta"] },
  ],
  [
    "vai pro leg press",
    { type: "go_to_exercise", nameQuery: "leg press", matches: ["Leg Press 45"] },
    { sessionExerciseNames: ["Leg Press 45", "Cadeira Extensora"] },
  ],
  [
    "ir para tríceps",
    { type: "go_to_exercise", nameQuery: "triceps", matches: ["Tríceps Corda"] },
    { sessionExerciseNames: ["Tríceps Corda", "Rosca Direta"] },
  ],

  // ── descanso ─────────────────────────────────────────────────────────────
  ["pausa o descanso", { type: "pause_rest" }],
  ["pausa descanso", { type: "pause_rest" }],
  ["pausar", { type: "pause_rest" }],
  ["retoma o descanso", { type: "resume_rest" }],
  ["retomar", { type: "resume_rest" }],
  ["continua o descanso", { type: "resume_rest" }],
  ["pula o descanso", { type: "skip_rest" }],
  ["pular descanso", { type: "skip_rest" }],
  ["mais 15 segundos", { type: "extend_rest", seconds: 15 }],
  ["mais 30 segundos", { type: "extend_rest", seconds: 30 }],
  ["mais quinze segundos", { type: "extend_rest", seconds: 15 }],
  ["mais trinta segundos", { type: "extend_rest", seconds: 30 }],

  // ── consultas ────────────────────────────────────────────────────────────
  ["qual exercício estou", { type: "query_current_exercise" }],
  ["qual exercício", { type: "query_current_exercise" }],
  ["que exercício é esse", { type: "query_current_exercise" }],
  ["que série é essa", { type: "query_current_set" }],
  ["qual série", { type: "query_current_set" }],
  ["qual o próximo", { type: "query_next_exercise" }],
  ["quem é o próximo", { type: "query_next_exercise" }],
  ["quanto tempo de treino", { type: "query_workout_elapsed" }],
  ["quanto tempo treinando", { type: "query_workout_elapsed" }],
  ["quanto falta", { type: "query_rest_remaining" }],
  ["quanto falta do descanso", { type: "query_rest_remaining" }],
  ["qual foi minha última carga", { type: "query_previous_load" }],
  ["qual a carga anterior", { type: "query_previous_load" }],
  ["quantas reps fiz na série anterior", { type: "query_previous_reps" }],
  ["quantas repetições na anterior", { type: "query_previous_reps" }],

  // ── observação avulsa ────────────────────────────────────────────────────
  ["anota que essa carga ficou pesada", { type: "add_observation" }],
  ["anota que senti o ombro", { type: "add_observation" }],
  ["anote que a execução ficou ruim", { type: "add_observation" }],
  ["registra que doeu o joelho", { type: "add_observation" }],
  ["anota aí que estava difícil", { type: "add_observation" }],

  // ── substituição ─────────────────────────────────────────────────────────
  ["essa máquina está ocupada", { type: "request_exercise_substitution", reason: "equipment_unavailable" }],
  ["a máquina quebrou", { type: "request_exercise_substitution", reason: "equipment_unavailable" }],
  ["o aparelho está ocupado", { type: "request_exercise_substitution", reason: "equipment_unavailable" }],
  ["troca esse exercício", { type: "request_exercise_substitution" }],
  ["quero substituir", { type: "request_exercise_substitution" }],
  ["substituir por causa da dor", { type: "request_exercise_substitution", reason: "pain_discomfort" }],

  // ── finalizar ────────────────────────────────────────────────────────────
  ["finalizar treino", { type: "finish_workout" }],
  ["finaliza o treino", { type: "finish_workout" }],
  ["encerrar o treino", { type: "finish_workout" }],
  ["quero finalizar o treino", { type: "finish_workout" }],
  ["encerra treino", { type: "finish_workout" }],

  // ── diálogo ──────────────────────────────────────────────────────────────
  ["sim", { type: "confirm" }],
  ["confirma", { type: "confirm" }],
  ["isso", { type: "confirm" }],
  ["pode", { type: "confirm" }],
  ["não", { type: "deny" }],
  ["cancela", { type: "deny" }],
  ["repete", { type: "repeat" }],
  ["ajuda", { type: "help" }],
  ["desfaz", { type: "undo" }],
  ["desfazer", { type: "undo" }],
  ["desliga a voz", { type: "voice_off" }],
  ["desligar voz", { type: "voice_off" }],

  // ── mais variações de conclusão (números maiores, unidades, dedupe) ────
  ["fiz 20 com 60 quilos", { type: "complete_set", reps: 20, loadKg: 60 }],
  ["fiz 16 com 45", { type: "complete_set", reps: 16, loadKg: 45 }],
  ["fiz 14 com 38", { type: "complete_set", reps: 14, loadKg: 38 }],
  ["fiz 13 com 24 quilos", { type: "complete_set", reps: 13, loadKg: 24 }],
  ["fiz quatro com cinquenta", { type: "complete_set", reps: 4, loadKg: 50 }],
  ["fiz três com sessenta", { type: "complete_set", reps: 3, loadKg: 60 }],
  ["fiz dois com oitenta", { type: "complete_set", reps: 2, loadKg: 80 }],
  ["fiz seis com noventa", { type: "complete_set", reps: 6, loadKg: 90 }],
  ["consegui 12", { type: "complete_set", reps: 12, loadKg: null }],
  ["completei 8", { type: "complete_set", reps: 8, loadKg: null }],

  // ── mais carga/reps avulsos ──────────────────────────────────────────────
  ["coloca 45 quilos", { type: "set_load", loadKg: 45 }],
  ["coloca 22 e meio", { type: "set_load", loadKg: 22.5 }],
  ["sobe para 50 quilos", { type: "set_load", loadKg: 50 }],
  ["baixa para 15 quilos", { type: "set_load", loadKg: 15 }],
  ["coloca 15 repetições", { type: "set_reps", reps: 15 }],

  // ── mais navegação ───────────────────────────────────────────────────────
  ["exercício seguinte", { type: "next_exercise" }],
  ["volta dois", { type: "previous_exercise" }],
  [
    "vai para a rosca direta",
    { type: "go_to_exercise", nameQuery: "rosca direta", matches: ["Rosca Direta"] },
    { sessionExerciseNames: ["Rosca Direta", "Rosca Martelo"] },
  ],
  [
    "vai para a rosca",
    { type: "go_to_exercise", nameQuery: "rosca" },
    { sessionExerciseNames: ["Rosca Direta", "Rosca Martelo"] },
  ],

  // ── mais descanso ────────────────────────────────────────────────────────
  ["pausa", { type: "pause_rest" }],
  ["pause o descanso", { type: "pause_rest" }],
  ["continua", { type: "resume_rest" }],
  ["pula", { type: "skip_rest" }],

  // ── mais consultas ───────────────────────────────────────────────────────
  ["quantos minutos de treino", { type: "query_workout_elapsed" }],
  ["quanto tempo falta do descanso", { type: "query_rest_remaining" }],
  ["qual minha última carga nesse exercício", { type: "query_previous_load" }],
  ["quantas reps na série anterior", { type: "query_previous_reps" }],
  ["que série estou fazendo", { type: "query_current_set" }],

  // ── mais observação ──────────────────────────────────────────────────────
  ["anota que o joelho incomodou", { type: "add_observation" }],
  ["anota que ficou fácil", { type: "add_observation" }],
  ["registre que a amplitude ficou curta", { type: "add_observation" }],

  // ── mais substituição ────────────────────────────────────────────────────
  ["essa barra está ocupada", { type: "request_exercise_substitution", reason: "equipment_unavailable" }],
  ["esse banco quebrou", { type: "request_exercise_substitution", reason: "equipment_unavailable" }],
  ["substitui esse exercício, está doendo", { type: "request_exercise_substitution", reason: "pain_discomfort" }],

  // ── mais finalizar ───────────────────────────────────────────────────────
  ["vou finalizar o treino", { type: "finish_workout" }],
  ["encerra esse treino", { type: "finish_workout" }],

  // ── mais diálogo ─────────────────────────────────────────────────────────
  ["confirmo", { type: "confirm" }],
  ["exato", { type: "confirm" }],
  ["negativo", { type: "deny" }],
  ["repetir", { type: "repeat" }],
  ["comandos", { type: "help" }],
  ["desativa a voz", { type: "voice_off" }],

  // ── falsos positivos / ambiguidades — não podem virar comando ─────────
  ["", null],
  ["oi tudo bem", null],
  ["nossa que treino difícil", null],
  ["ele falou alguma coisa", null],
  // O parser só reconhece "fiz/consegui/completei/terminei" (1ª pessoa) ou
  // número já no início da frase — "fez" (3ª pessoa) precedido de "meu
  // amigo" não casa com nenhuma das duas formas, então isto fica null por
  // construção, não por sorte.
  ["meu amigo fez 12 com 28", null],
  ["acho que talvez", null],
  ["essa música é boa", null],
  ["o personal falou alguma coisa", null],
  ["bom dia", null],
  ["obrigado", null],
];

describe("corpus PT-BR do parser (P5B)", () => {
  it(`tem pelo menos 150 frases (tem ${CASOS.length}) — trava de regressão do tamanho do corpus`, () => {
    expect(CASOS.length).toBeGreaterThanOrEqual(150);
  });

  it.each(CASOS)("%s", (frase, esperado, ctx) => {
    const { intent } = parseVoiceCommand(frase, ctx);
    if (esperado === null) {
      expect(intent).toBeNull();
      return;
    }
    expect(intent).not.toBeNull();
    for (const chave of Object.keys(esperado) as (keyof VoiceIntent)[]) {
      // @ts-expect-error -- comparação campo a campo dirigida pelo esperado
      expect(intent?.[chave]).toEqual(esperado[chave]);
    }
  });
});

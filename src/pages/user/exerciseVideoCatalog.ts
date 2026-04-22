import type { MuscleGroup } from "./workoutHistory";

export interface ExerciseVideoItem {
  id: string;
  name: string;
  title: string;
  videoId: string;
  durationMin: number;
  muscleGroups: MuscleGroup[];
  alwaysAvailable: true;
}

// Placeholder video IDs from homeWorkoutCatalog — replace with actual exercise demos when available.
export const exerciseVideoCatalog: ExerciseVideoItem[] = [
  // Home — light
  { id: "ex-marcha-no-lugar",     name: "Marcha no lugar",     title: "Marcha no lugar",     videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],   alwaysAvailable: true },
  { id: "ex-mobilidade",          name: "Mobilidade",          title: "Mobilidade",          videoId: "iAr4u2ZPZ8U", durationMin: 1, muscleGroups: ["mobility"], alwaysAvailable: true },
  { id: "ex-elevacao-de-quadril", name: "Elevação de quadril", title: "Elevação de quadril", videoId: "GILHw-y3tIQ", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },

  // Home — moderate / intense (shared)
  { id: "ex-agachamento-livre",   name: "Agachamento livre",   title: "Agachamento livre",   videoId: "GILHw-y3tIQ", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },
  { id: "ex-polichinelo",         name: "Polichinelo",         title: "Polichinelo",         videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],   alwaysAvailable: true },
  { id: "ex-flexao-inclinada",    name: "Flexão inclinada",    title: "Flexão inclinada",    videoId: "9jepCOgl7kc", durationMin: 1, muscleGroups: ["chest"],    alwaysAvailable: true },
  { id: "ex-avanco-reverso",      name: "Avanço reverso",      title: "Avanço reverso",      videoId: "XNSFtgnhywk", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },
  { id: "ex-dead-bug",            name: "Dead bug",            title: "Dead bug",            videoId: "qJWPx_JiLfo", durationMin: 1, muscleGroups: ["core"],    alwaysAvailable: true },
  { id: "ex-joelho-alto-rapido",  name: "Joelho alto rápido",  title: "Joelho alto rápido",  videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],   alwaysAvailable: true },
  { id: "ex-mountain-climber",    name: "Mountain climber",    title: "Mountain climber",    videoId: "qJWPx_JiLfo", durationMin: 1, muscleGroups: ["core"],    alwaysAvailable: true },
  { id: "ex-prancha-com-toque",   name: "Prancha com toque",   title: "Prancha com toque",   videoId: "qJWPx_JiLfo", durationMin: 1, muscleGroups: ["core"],    alwaysAvailable: true },

  // Gym — light
  { id: "ex-caminhada-na-esteira",    name: "Caminhada na esteira",    title: "Caminhada na esteira",    videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],  alwaysAvailable: true },
  { id: "ex-leg-press-leve",          name: "Leg press (leve)",        title: "Leg press leve",          videoId: "GILHw-y3tIQ", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },
  { id: "ex-remada-sentada-leve",     name: "Remada sentada (leve)",   title: "Remada sentada leve",     videoId: "1RSbIQK2h7k", durationMin: 1, muscleGroups: ["back"],    alwaysAvailable: true },
  { id: "ex-prancha",                 name: "Prancha",                 title: "Prancha",                 videoId: "qJWPx_JiLfo", durationMin: 1, muscleGroups: ["core"],    alwaysAvailable: true },

  // Gym — moderate
  { id: "ex-corrida-leve-na-esteira", name: "Corrida leve na esteira", title: "Corrida leve na esteira", videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],  alwaysAvailable: true },
  { id: "ex-leg-press",               name: "Leg press",               title: "Leg press",               videoId: "GILHw-y3tIQ", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },
  { id: "ex-supino",                  name: "Supino",                  title: "Supino",                  videoId: "9jepCOgl7kc", durationMin: 1, muscleGroups: ["chest"],   alwaysAvailable: true },
  { id: "ex-remada-sentada",          name: "Remada sentada",          title: "Remada sentada",          videoId: "1RSbIQK2h7k", durationMin: 1, muscleGroups: ["back"],    alwaysAvailable: true },

  // Gym — intense
  { id: "ex-intervalos-no-remo",              name: "Intervalos no remo",              title: "Intervalos no remo",              videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],  alwaysAvailable: true },
  { id: "ex-agachamento-goblet",              name: "Agachamento goblet",              title: "Agachamento goblet",              videoId: "GILHw-y3tIQ", durationMin: 1, muscleGroups: ["legs"],    alwaysAvailable: true },
  { id: "ex-puxada-alta",                     name: "Puxada alta",                     title: "Puxada alta",                     videoId: "1RSbIQK2h7k", durationMin: 1, muscleGroups: ["back"],    alwaysAvailable: true },
  { id: "ex-levantamento-terra-com-halteres", name: "Levantamento terra com halteres", title: "Levantamento terra c/ halteres",  videoId: "1RSbIQK2h7k", durationMin: 1, muscleGroups: ["back"],    alwaysAvailable: true },
  { id: "ex-sprint-na-bike",                  name: "Sprint na bike",                  title: "Sprint na bike",                  videoId: "VklDGSnPU34", durationMin: 1, muscleGroups: ["cardio"],  alwaysAvailable: true },
];

export function findExerciseVideo(name: string): ExerciseVideoItem | undefined {
  return exerciseVideoCatalog.find((e) => e.name === name);
}

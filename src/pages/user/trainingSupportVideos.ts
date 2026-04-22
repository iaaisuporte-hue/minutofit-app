import { homeWorkoutCatalog, type HomeWorkoutItem } from "./homeWorkoutCatalog";
import type { MuscleGroup } from "./workoutHistory";

export type SupportVideoMatch = {
  video: HomeWorkoutItem;
  inferredGroups: MuscleGroup[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hash(value: string) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function createSupportVideo(
  id: string,
  title: string,
  videoId: string,
  muscleGroups: MuscleGroup[],
  durationMin = 1
): HomeWorkoutItem {
  return {
    id,
    title,
    youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    muscleGroups,
    badges: ["Apoio"],
    durationMin,
    accessibility: {
      visual: true,
      auditory: true,
      motor: true,
      notes: ["Vídeo de apoio usado para demonstrar a execução do exercício."],
    },
  };
}

const EXERCISE_SUPPORT_VIDEOS: Array<{ aliases: string[]; video: HomeWorkoutItem }> = [
  {
    aliases: ["flexao inclinada", "incline push-up", "incline push up"],
    video: createSupportVideo("support-incline-push-up", "Incline Push-Up", "yAbg3_pJKvw", ["chest", "arms"]),
  },
  {
    aliases: ["dead bug"],
    video: createSupportVideo("support-dead-bug", "Dead Bug", "PsqCDbiflsg", ["core"]),
  },
  {
    aliases: ["plank shoulder tap", "shoulder tap plank", "prancha com toque no ombro"],
    video: createSupportVideo("support-plank-shoulder-tap", "Plank Shoulder Tap", "8aiEd9jTrqM", ["core", "shoulders"]),
  },
  {
    aliases: ["reverse lunge", "afundo reverso"],
    video: createSupportVideo("support-reverse-lunge", "Reverse Lunge", "xrPteyQLGAo", ["legs"]),
  },
  {
    aliases: ["jumping jacks", "polichinelo"],
    video: createSupportVideo("support-jumping-jacks", "Jumping Jacks", "5cGbc15CO1Q", ["cardio"]),
  },
  {
    aliases: ["march in place", "marcha no lugar", "high-knee march", "high knee march"],
    video: createSupportVideo("support-march-in-place", "March in Place", "VklDGSnPU34", ["cardio"]),
  },
  {
    aliases: ["mobility flow", "mobilidade", "alongamento", "aquecimento"],
    video: createSupportVideo("support-mobility-flow", "Mobility Flow", "iAr4u2ZPZ8U", ["mobility"]),
  },
  {
    aliases: ["bodyweight squat", "agachamento livre", "agachamento"],
    video: createSupportVideo("support-bodyweight-squat", "Bodyweight Squat", "XNSFtgnhywk", ["legs"]),
  },
  {
    aliases: ["glute bridge", "ponte de gluteo", "ponte de glúteo"],
    video: createSupportVideo("support-glute-bridge", "Glute Bridge", "xFmJtxVn5qo", ["legs", "core"]),
  },
  {
    aliases: ["mountain climber", "escalador"],
    video: createSupportVideo("support-mountain-climber", "Mountain Climber", "VklDGSnPU34", ["cardio", "core"]),
  },
];

function findExplicitVideo(activity: string) {
  const normalized = normalize(activity);
  return EXERCISE_SUPPORT_VIDEOS.find((entry) => entry.aliases.some((alias) => normalized.includes(normalize(alias))))?.video ?? null;
}

function inferGroupsFromText(text: string): MuscleGroup[] {
  const normalized = normalize(text);
  const groups = new Set<MuscleGroup>();

  if (
    normalized.includes("aquec") ||
    normalized.includes("mobil") ||
    normalized.includes("along") ||
    normalized.includes("respira")
  ) {
    groups.add("mobility");
  }

  if (
    normalized.includes("cardio") ||
    normalized.includes("corrida") ||
    normalized.includes("bike") ||
    normalized.includes("pedal") ||
    normalized.includes("caminhada") ||
    normalized.includes("hiit") ||
    normalized.includes("high knees") ||
    normalized.includes("rower")
  ) {
    groups.add("cardio");
  }

  if (
    normalized.includes("agach") ||
    normalized.includes("leg press") ||
    normalized.includes("lunge") ||
    normalized.includes("reverse lunge") ||
    normalized.includes("afundo") ||
    normalized.includes("passada") ||
    normalized.includes("stiff") ||
    normalized.includes("glute") ||
    normalized.includes("panturrilha")
  ) {
    groups.add("legs");
  }

  if (
    normalized.includes("supino") ||
    normalized.includes("peito") ||
    normalized.includes("push-up") ||
    normalized.includes("push up") ||
    normalized.includes("flexao") ||
    normalized.includes("chest press") ||
    normalized.includes("crossover")
  ) {
    groups.add("chest");
  }

  if (
    normalized.includes("remada") ||
    normalized.includes("costas") ||
    normalized.includes("row") ||
    normalized.includes("seated row") ||
    normalized.includes("cable row") ||
    normalized.includes("lat pulldown") ||
    normalized.includes("puxada")
  ) {
    groups.add("back");
  }

  if (
    normalized.includes("triceps") ||
    normalized.includes("biceps") ||
    normalized.includes("rosca") ||
    normalized.includes("arm") ||
    normalized.includes("braco")
  ) {
    groups.add("arms");
  }

  if (
    normalized.includes("ombro") ||
    normalized.includes("shoulder") ||
    normalized.includes("elevacao lateral") ||
    normalized.includes("desenvolvimento")
  ) {
    groups.add("shoulders");
  }

  if (
    normalized.includes("prancha") ||
    normalized.includes("plank") ||
    normalized.includes("dead bug") ||
    normalized.includes("bird dog") ||
    normalized.includes("abdominal") ||
    normalized.includes("core") ||
    normalized.includes("hollow")
  ) {
    groups.add("core");
  }

  return Array.from(groups);
}

function fallbackCandidates() {
  return homeWorkoutCatalog.filter((item) => item.alwaysAvailable || item.muscleGroups.includes("mobility"));
}

export function resolveSupportVideoForActivity(activity: string, workoutFocus?: string): SupportVideoMatch | null {
  const explicitVideo = findExplicitVideo(activity);
  if (explicitVideo) {
    return {
      video: explicitVideo,
      inferredGroups: explicitVideo.muscleGroups,
    };
  }

  const inferredGroups = [
    ...new Set([...inferGroupsFromText(activity), ...inferGroupsFromText(workoutFocus ?? "")]),
  ];

  const candidates = inferredGroups.length
    ? homeWorkoutCatalog.filter((item) => item.muscleGroups.some((group) => inferredGroups.includes(group)))
    : fallbackCandidates();

  const pool = candidates.length ? candidates : fallbackCandidates();
  if (!pool.length) return null;

  const seed = `${normalize(activity)}|${normalize(workoutFocus ?? "")}|${new Date().toISOString().slice(0, 10)}`;
  const index = hash(seed) % pool.length;

  return {
    video: pool[index],
    inferredGroups,
  };
}

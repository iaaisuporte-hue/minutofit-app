import type { MuscleGroup } from "./workoutHistory";

export type HomeWorkoutItem = {
  id: string;
  title: string;
  youtubeUrl: string;
  videoId: string;
  muscleGroups: MuscleGroup[];
  badges: string[];
  alwaysAvailable?: boolean;
  durationMin: number;
};

export const homeWorkoutCatalog: HomeWorkoutItem[] = [
  {
    id: "short-peito",
    title: "Short Peito",
    youtubeUrl: "https://www.youtube.com/shorts/9jepCOgl7kc",
    videoId: "9jepCOgl7kc",
    muscleGroups: ["chest"],
    badges: ["Peito", "Short"],
    durationMin: 1,
  },
  {
    id: "short-abdomen",
    title: "Short Abdômen",
    youtubeUrl: "https://www.youtube.com/shorts/qJWPx_JiLfo",
    videoId: "qJWPx_JiLfo",
    muscleGroups: ["core"],
    badges: ["Abdômen", "Short"],
    durationMin: 1,
  },
  {
    id: "short-bracos-costas",
    title: "Short Braços e Costas",
    youtubeUrl: "https://www.youtube.com/shorts/1RSbIQK2h7k",
    videoId: "1RSbIQK2h7k",
    muscleGroups: ["arms", "back"],
    badges: ["Braços", "Costas", "Short"],
    durationMin: 1,
  },
  {
    id: "short-queima-gordura",
    title: "Short Queima Gordura",
    youtubeUrl: "https://www.youtube.com/shorts/VklDGSnPU34",
    videoId: "VklDGSnPU34",
    muscleGroups: ["cardio"],
    badges: ["Cardio", "Sempre liberado"],
    alwaysAvailable: true,
    durationMin: 1,
  },
  {
    id: "short-perna-gluteo",
    title: "Short Perna e Glúteo",
    youtubeUrl: "https://www.youtube.com/shorts/GILHw-y3tIQ",
    videoId: "GILHw-y3tIQ",
    muscleGroups: ["legs"],
    badges: ["Pernas", "Glúteo", "Short"],
    durationMin: 1,
  },
  {
    id: "short-aquecimento",
    title: "Short Aquecimento",
    youtubeUrl: "https://www.youtube.com/shorts/iAr4u2ZPZ8U",
    videoId: "iAr4u2ZPZ8U",
    muscleGroups: ["mobility"],
    badges: ["Aquecimento", "Sempre liberado"],
    alwaysAvailable: true,
    durationMin: 1,
  },
  {
    id: "short-alongamento",
    title: "Short Alongamento",
    youtubeUrl: "https://www.youtube.com/shorts/9sRAh9tzz5Y",
    videoId: "9sRAh9tzz5Y",
    muscleGroups: ["mobility"],
    badges: ["Alongamento", "Sempre liberado"],
    alwaysAvailable: true,
    durationMin: 1,
  },
  {
    id: "short-triceps",
    title: "Short Tríceps",
    youtubeUrl: "https://www.youtube.com/shorts/AYlciKmfUvo",
    videoId: "AYlciKmfUvo",
    muscleGroups: ["arms"],
    badges: ["Tríceps", "Short"],
    durationMin: 1,
  },
  {
    id: "short-perna",
    title: "Short Perna",
    youtubeUrl: "https://www.youtube.com/shorts/XNSFtgnhywk",
    videoId: "XNSFtgnhywk",
    muscleGroups: ["legs"],
    badges: ["Pernas", "Short"],
    durationMin: 1,
  },
];

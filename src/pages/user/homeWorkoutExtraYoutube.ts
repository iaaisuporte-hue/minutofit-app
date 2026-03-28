/** Curadoria extra (vídeos longos) para abrir a partir dos cards em Treinos em casa. */
export const HOME_EXTRA_YOUTUBE_BY_GROUP = {
  chest: [
    { title: "Chest Workout for Beginners", url: "https://www.youtube.com/watch?v=tgPRuPJ7j0U", duration: "15 min" },
    { title: "Complete Chest Workout", url: "https://www.youtube.com/watch?v=jT5d-4hCL6o", duration: "20 min" },
    { title: "Chest and Triceps", url: "https://www.youtube.com/watch?v=y5Vy-qI5xyk", duration: "25 min" },
    { title: "Upper Chest Focus", url: "https://www.youtube.com/watch?v=3AJtJ5_dVrY", duration: "18 min" },
  ],
  leg: [
    { title: "Leg Workout for Beginners", url: "https://www.youtube.com/watch?v=ZY9f8pDAzLg", duration: "20 min" },
    { title: "Full Leg Day Workout", url: "https://www.youtube.com/watch?v=8Rg2N_g186s", duration: "30 min" },
    { title: "Legs and Glutes", url: "https://www.youtube.com/watch?v=1yMiSwzWU2Y", duration: "25 min" },
    { title: "Lower Body Strength", url: "https://www.youtube.com/watch?v=l49kJPBJEfE", duration: "22 min" },
  ],
} as const;

export type HomeExtraYoutubeGroup = keyof typeof HOME_EXTRA_YOUTUBE_BY_GROUP;

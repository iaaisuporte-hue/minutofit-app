import { getPlatform } from "../../../../lib/platform";
import { NativeWorkoutLiveSurface } from "./NativeWorkoutLiveSurface";
import { WebWorkoutLiveSurface } from "./WebWorkoutLiveSurface";
import type { WorkoutLiveSurface } from "./WorkoutLiveSurface";

/** Mesma escolha por plataforma da P1C: só o Android tem serviço próprio. */
export function createWorkoutLiveSurface(): WorkoutLiveSurface {
  if (getPlatform() === "android") return new NativeWorkoutLiveSurface();
  return new WebWorkoutLiveSurface();
}

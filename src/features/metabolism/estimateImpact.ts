export function estimateCheckinImpact(muscleGroupCount: number, currentStreak: number): number {
  let delta = 0;
  if (muscleGroupCount >= 1) delta += 4;
  if (muscleGroupCount >= 3) delta += 2;
  if (currentStreak >= 1) delta += 1;
  return delta;
}

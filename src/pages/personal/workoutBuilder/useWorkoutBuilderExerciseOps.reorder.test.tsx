import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useWorkoutBuilderExerciseOps } from "./useWorkoutBuilderExerciseOps";
import type { WorkoutExercise } from "./builderTypes";

const ex = (id: string): WorkoutExercise => ({ exerciseId: id, name: id, sets: "3", reps: "10", rest: "60s" });

function setup() {
  return renderHook(() => {
    const [daysItems, setDaysItems] = useState<Record<number, WorkoutExercise[]>>({ 0: [ex("a"), ex("b"), ex("c")], 1: [ex("x"), ex("y")] });
    const ops = useWorkoutBuilderExerciseOps({ selectedDayIdx: 0, setDaysItems });
    return { daysItems, ...ops };
  });
}
const order = (r: ReturnType<typeof setup>, day = 0) => r.result.current.daysItems[day].map((i) => i.exerciseId).join("");

// Reordenar por toque/teclado (P1): botões ↑/↓ chamam `moveExercise`; o arrastar só existia para mouse.
describe("builder — mover exercício sem arrastar (P1)", () => {
  it("sobe e desce trocando com o vizinho", () => {
    const r = setup();
    act(() => r.result.current.moveExercise(1, -1));
    expect(order(r)).toBe("bac");
    act(() => r.result.current.moveExercise(1, 1));
    expect(order(r)).toBe("bca");
  });

  it("não sai dos limites (primeiro não sobe, último não desce)", () => {
    const r = setup();
    act(() => r.result.current.moveExercise(0, -1));
    act(() => r.result.current.moveExercise(2, 1));
    expect(order(r)).toBe("abc");
  });

  it("só mexe no dia selecionado e preserva os itens (sem perder nem duplicar)", () => {
    const r = setup();
    act(() => r.result.current.moveExercise(0, 1));
    expect(order(r, 1)).toBe("xy");
    expect([...order(r)].sort().join("")).toBe("abc");
  });
});

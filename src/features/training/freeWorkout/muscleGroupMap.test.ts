/**
 * Tradução body_part → grupo do servidor.
 *
 * Existe porque o servidor sanitiza `muscleGroups` contra um enum em inglês e
 * descarta o que não casa EM SILÊNCIO: um mapa errado aqui não quebra nada
 * visível na hora — só produz um histórico em que o treino de costas não conta
 * como treino de costas.
 */
import { describe, expect, it } from "vitest";
import {
  bodyPartToServerGroup,
  deriveGroupsFromExercises,
  deriveTitleGroupsPt,
  describeTitleGroupsPt,
  freeWorkoutTitle,
} from "./muscleGroupMap";

describe("bodyPartToServerGroup", () => {
  it("cobre os valores reais do catálogo", () => {
    expect(bodyPartToServerGroup("peito")).toBe("chest");
    expect(bodyPartToServerGroup("costas")).toBe("back");
    expect(bodyPartToServerGroup("perna")).toBe("legs");
    expect(bodyPartToServerGroup("glúteo")).toBe("legs");
    expect(bodyPartToServerGroup("panturrilha")).toBe("legs");
    expect(bodyPartToServerGroup("ombro")).toBe("shoulders");
    expect(bodyPartToServerGroup("bíceps")).toBe("arms");
    expect(bodyPartToServerGroup("tríceps")).toBe("arms");
    expect(bodyPartToServerGroup("antebraço")).toBe("arms");
    expect(bodyPartToServerGroup("abdômen")).toBe("core");
    expect(bodyPartToServerGroup("cardio")).toBe("cardio");
    expect(bodyPartToServerGroup("mobilidade")).toBe("mobility");
    expect(bodyPartToServerGroup("aquecimento")).toBe("mobility");
  });

  it("normaliza acento, caixa e espaço — o banco não é a única fonte", () => {
    expect(bodyPartToServerGroup("Abdômen")).toBe("core");
    expect(bodyPartToServerGroup("ABDOMEN")).toBe("core");
    expect(bodyPartToServerGroup("  Glúteo ")).toBe("legs");
  });

  it("valor desconhecido, vazio ou nulo cai em full_body — nunca lança", () => {
    // "funcional" existe no seed e não tem grupo próprio no enum do servidor.
    expect(bodyPartToServerGroup("funcional")).toBe("full_body");
    expect(bodyPartToServerGroup("")).toBe("full_body");
    expect(bodyPartToServerGroup(null)).toBe("full_body");
    expect(bodyPartToServerGroup(undefined)).toBe("full_body");
  });
});

describe("deriveGroupsFromExercises", () => {
  it("ordena por frequência, do dominante ao acessório", () => {
    const grupos = deriveGroupsFromExercises([
      { bodyPart: "bíceps" },
      { bodyPart: "costas" },
      { bodyPart: "costas" },
      { bodyPart: "costas" },
    ]);
    expect(grupos).toEqual(["back", "arms"]);
  });

  it("deduplica: cinco exercícios de peito são um grupo só", () => {
    const grupos = deriveGroupsFromExercises([
      { bodyPart: "peito" },
      { bodyPart: "peito" },
      { bodyPart: "peito" },
    ]);
    expect(grupos).toEqual(["chest"]);
  });

  it("empate mantém a ordem em que o aluno escolheu", () => {
    const grupos = deriveGroupsFromExercises([{ bodyPart: "ombro" }, { bodyPart: "peito" }]);
    expect(grupos).toEqual(["shoulders", "chest"]);
  });

  it("agrupa o que o enum agrupa: bíceps e tríceps são um único 'arms'", () => {
    expect(deriveGroupsFromExercises([{ bodyPart: "bíceps" }, { bodyPart: "tríceps" }])).toEqual([
      "arms",
    ]);
  });

  it("lista vazia devolve full_body — histórico precisa de um grupo", () => {
    expect(deriveGroupsFromExercises([])).toEqual(["full_body"]);
  });

  it("bodyPart ausente não some da lista", () => {
    expect(deriveGroupsFromExercises([{}, { bodyPart: null }])).toEqual(["full_body"]);
  });
});

describe("deriveTitleGroupsPt", () => {
  it("usa o rótulo que o aluno reconhece: Bíceps, não Braços", () => {
    const rotulos = deriveTitleGroupsPt([
      { bodyPart: "costas" },
      { bodyPart: "costas" },
      { bodyPart: "bíceps" },
    ]);
    expect(rotulos).toEqual(["Costas", "Bíceps"]);
  });

  it("limita aos grupos dominantes — título não vira lista de compras", () => {
    const rotulos = deriveTitleGroupsPt([
      { bodyPart: "perna" },
      { bodyPart: "perna" },
      { bodyPart: "glúteo" },
      { bodyPart: "abdômen" },
      { bodyPart: "cardio" },
    ]);
    expect(rotulos).toEqual(["Pernas", "Glúteo"]);
  });

  it("respeita o limite pedido", () => {
    const rotulos = deriveTitleGroupsPt(
      [{ bodyPart: "peito" }, { bodyPart: "ombro" }, { bodyPart: "tríceps" }],
      3,
    );
    expect(rotulos).toEqual(["Peito", "Ombros", "Tríceps"]);
  });

  it("body_part fora do catálogo cai no rótulo do grupo derivado", () => {
    expect(deriveTitleGroupsPt([{ bodyPart: "algo que não existe" }])).toEqual(["Corpo inteiro"]);
  });

  it("lista vazia não inventa rótulo", () => {
    expect(deriveTitleGroupsPt([])).toEqual([]);
  });
});

describe("describeTitleGroupsPt", () => {
  it("um grupo só é o próprio rótulo", () => {
    expect(describeTitleGroupsPt([{ bodyPart: "peito" }, { bodyPart: "peito" }])).toBe("Peito");
  });

  it("dois grupos são afirmados inteiros", () => {
    expect(describeTitleGroupsPt([{ bodyPart: "costas" }, { bodyPart: "bíceps" }])).toBe(
      "Costas e Bíceps",
    );
  });

  it("com mais de dois grupos o título não afirma que treinou só dois", () => {
    const titulo = describeTitleGroupsPt([
      { bodyPart: "peito" },
      { bodyPart: "costas" },
      { bodyPart: "perna" },
      { bodyPart: "bíceps" },
    ]);
    expect(titulo).toBe("Peito, Costas e mais");
  });

  it("o corte respeita a frequência: o grupo dominante nunca cai no 'e mais'", () => {
    const titulo = describeTitleGroupsPt([
      { bodyPart: "abdômen" },
      { bodyPart: "perna" },
      { bodyPart: "perna" },
      { bodyPart: "perna" },
      { bodyPart: "cardio" },
    ]);
    expect(titulo).toBe("Pernas, Abdômen e mais");
  });

  it("lista vazia não inventa rótulo", () => {
    expect(describeTitleGroupsPt([])).toBe("");
  });
});

describe("freeWorkoutTitle", () => {
  it("leva o mesmo rótulo da tela para o histórico", () => {
    expect(freeWorkoutTitle([{ bodyPart: "costas" }, { bodyPart: "bíceps" }])).toBe(
      "Treino livre · Costas e Bíceps",
    );
  });

  it("treino de corpo inteiro não vira 'Peito e Costas'", () => {
    expect(
      freeWorkoutTitle([
        { bodyPart: "peito" },
        { bodyPart: "costas" },
        { bodyPart: "perna" },
        { bodyPart: "ombro" },
      ]),
    ).toBe("Treino livre · Peito, Costas e mais");
  });

  it("sem exercício fica só 'Treino livre'", () => {
    expect(freeWorkoutTitle([])).toBe("Treino livre");
  });
});

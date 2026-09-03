/**
 * Cliente da Biblioteca de Exercícios Personalizados do Personal.
 *
 * Cobre o fluxo de upload em 2 passos (mesmo padrão de `progressPhotosApi.ts`)
 * e o tratamento do 409 de nome duplicado, que a UI precisa reconhecer por
 * tipo (não por string genérica) para trocar a mensagem.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const authFetch = vi.fn();
vi.mock("./apiClient", () => ({ authFetch: (...args: unknown[]) => authFetch(...args) }));

import {
  archiveMyExercise,
  createMyExercise,
  DuplicateExerciseNameError,
  listMyExercises,
  restoreMyExercise,
  updateMyExercise,
  uploadPersonalExerciseMedia,
} from "./personalExercisesApi";

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listMyExercises", () => {
  it("monta a querystring e devolve a lista", async () => {
    authFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { exercises: [{ id: "1" }] } }));

    const rows = await listMyExercises({ q: "supino", status: "archived", limit: 10, offset: 5 });

    expect(rows).toEqual([{ id: "1" }]);
    const [url] = authFetch.mock.calls[0];
    expect(url).toContain("/personal/exercises?");
    expect(url).toContain("q=supino");
    expect(url).toContain("status=archived");
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("lista vazia quando o backend não devolve `exercises`", async () => {
    authFetch.mockResolvedValue(jsonResponse(200, { success: true, data: {} }));
    expect(await listMyExercises()).toEqual([]);
  });
});

describe("createMyExercise / updateMyExercise", () => {
  it("cria com sucesso e devolve o exercício", async () => {
    const exercise = { id: "abc", name: "Supino inclinado" };
    authFetch.mockResolvedValue(jsonResponse(201, { success: true, data: { exercise } }));

    const result = await createMyExercise({ name: "Supino inclinado", bodyPart: "peito" });

    expect(result).toEqual(exercise);
    const [url, init] = authFetch.mock.calls[0];
    expect(url).toContain("/personal/exercises");
    expect(init.method).toBe("POST");
  });

  it("409 DUPLICATE_NAME vira DuplicateExerciseNameError, reconhecível por tipo", async () => {
    authFetch.mockResolvedValue(jsonResponse(409, { success: false, error: "DUPLICATE_NAME" }));

    await expect(createMyExercise({ name: "Supino", bodyPart: "peito" })).rejects.toBeInstanceOf(
      DuplicateExerciseNameError,
    );
  });

  it("outro erro qualquer não vira DuplicateExerciseNameError", async () => {
    authFetch.mockResolvedValue(jsonResponse(400, { success: false, error: "invalid_body_part" }));

    await expect(createMyExercise({ name: "Supino", bodyPart: "" })).rejects.toThrow("invalid_body_part");
  });

  it("PATCH também reconhece o 409 de nome duplicado", async () => {
    authFetch.mockResolvedValue(jsonResponse(409, { success: false, error: "DUPLICATE_NAME" }));

    await expect(updateMyExercise("abc", { name: "Supino" })).rejects.toBeInstanceOf(DuplicateExerciseNameError);
  });

  it("503 vira storage_unavailable, tratável separadamente", async () => {
    authFetch.mockResolvedValue(jsonResponse(503, { success: false, error: "storage_unavailable" }));
    await expect(createMyExercise({ name: "Supino", bodyPart: "peito" })).rejects.toThrow("storage_unavailable");
  });
});

describe("archiveMyExercise / restoreMyExercise", () => {
  it("arquiva e devolve o exercício atualizado", async () => {
    const exercise = { id: "abc", status: "archived" };
    authFetch.mockResolvedValue(jsonResponse(200, { success: true, data: { exercise } }));

    expect(await archiveMyExercise("abc")).toEqual(exercise);
    expect(authFetch.mock.calls[0][0]).toContain("/personal/exercises/abc/archive");
  });

  it("restaurar propaga 409 como DuplicateExerciseNameError (nome colide com ativo homônimo)", async () => {
    authFetch.mockResolvedValue(jsonResponse(409, { success: false, error: "DUPLICATE_NAME" }));
    await expect(restoreMyExercise("abc")).rejects.toBeInstanceOf(DuplicateExerciseNameError);
  });
});

describe("uploadPersonalExerciseMedia — fluxo de 2 passos", () => {
  it("pede a URL assinada, faz o PUT no storage e registra os metadados", async () => {
    const globalFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", globalFetch);

    authFetch
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          data: { uploadUrl: "https://storage.example/put-here", storageKey: "exercise-media/1/abc/x.jpg", expiresIn: 300 },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(201, { success: true }));

    const file = new File(["conteudo"], "foto.jpg", { type: "image/jpeg" });
    await uploadPersonalExerciseMedia("abc", file, { isPrimary: true });

    // Passo 1: pede upload-url.
    expect(authFetch.mock.calls[0][0]).toContain("/personal/exercises/abc/media/upload-url");
    // Passo intermediário: PUT direto no storage, fora do backend.
    expect(globalFetch).toHaveBeenCalledWith(
      "https://storage.example/put-here",
      expect.objectContaining({ method: "PUT" }),
    );
    // Passo 2: registra a mídia com a storageKey devolvida no passo 1.
    const [registerUrl, registerInit] = authFetch.mock.calls[1];
    expect(registerUrl).toContain("/personal/exercises/abc/media");
    expect(JSON.parse(registerInit.body)).toEqual({
      kind: "upload",
      storageKey: "exercise-media/1/abc/x.jpg",
      isPrimary: true,
    });

    vi.unstubAllGlobals();
  });

  it("PUT falho no storage aborta antes de registrar a mídia", async () => {
    const globalFetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", globalFetch);

    authFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        data: { uploadUrl: "https://storage.example/put-here", storageKey: "k", expiresIn: 300 },
      }),
    );

    const file = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    await expect(uploadPersonalExerciseMedia("abc", file)).rejects.toThrow("upload_failed");
    // Só o passo 1 (upload-url) foi chamado no backend — nunca o registro.
    expect(authFetch).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});

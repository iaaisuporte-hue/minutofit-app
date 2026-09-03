/**
 * Cliente da Biblioteca de Exercícios Personalizados do Personal
 * (`/api/personal/exercises/*`, Sprint P1).
 *
 * Mesmo padrão de `progressPhotosApi.ts`: `unwrap<T>` centraliza o
 * tratamento de erro, e mídia sobe em 2 passos (upload-url assinada → PUT
 * direto no storage → registro dos metadados). A diferença aqui é o `kind`
 * do registro — `upload` (imagem, via storage) ou `youtube` (link, sem
 * upload nenhum) — porque o domínio não guarda vídeo binário (spec).
 */
import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";
import type { Exercise, ExerciseSummary } from "./exercisesApi";

export type PersonalExerciseStatusFilter = "active" | "archived" | "all";

export type PersonalExerciseInput = {
  name: string;
  bodyPart: string;
  targetMuscle?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  tags?: string[];
  instructions?: string[];
  tips?: string[];
};

export type PersonalExercisePatch = Partial<PersonalExerciseInput>;

type UploadTarget = { uploadUrl: string; storageKey: string; expiresIn: number };

/**
 * 409 de nome duplicado NA PRÓPRIA biblioteca (D2/D12) — diferente do aviso
 * de "parecido com o catálogo global", que é client-side e não bloqueia.
 * A UI reconhece este erro por `instanceof` para trocar a mensagem genérica
 * por uma específica ("Você já tem um exercício ativo com esse nome").
 */
export class DuplicateExerciseNameError extends Error {
  constructor() {
    super("DUPLICATE_NAME");
    this.name = "DuplicateExerciseNameError";
  }
}

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
  const payload = await parseJson(response);
  if (!response.ok) {
    if (response.status === 503) throw new Error("storage_unavailable");
    if (payload?.error === "DUPLICATE_NAME") throw new DuplicateExerciseNameError();
    throw new Error(payload?.error || fallback);
  }
  return (payload?.data ?? null) as T;
}

export async function listMyExercises(filter: {
  q?: string;
  status?: PersonalExerciseStatusFilter;
  limit?: number;
  offset?: number;
} = {}): Promise<ExerciseSummary[]> {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.status) params.set("status", filter.status);
  if (filter.limit != null) params.set("limit", String(filter.limit));
  if (filter.offset != null) params.set("offset", String(filter.offset));
  const qs = params.toString();
  const response = await authFetch(`${API_URL}/personal/exercises${qs ? `?${qs}` : ""}`);
  const data = await unwrap<{ exercises: ExerciseSummary[] }>(response, "Não foi possível carregar seus exercícios.");
  return data?.exercises ?? [];
}

export async function createMyExercise(input: PersonalExerciseInput): Promise<Exercise> {
  const response = await authFetch(`${API_URL}/personal/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ exercise: Exercise }>(response, "Não foi possível criar o exercício.");
  return data.exercise;
}

export async function updateMyExercise(exerciseId: string, patch: PersonalExercisePatch): Promise<Exercise> {
  const response = await authFetch(`${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await unwrap<{ exercise: Exercise }>(response, "Não foi possível salvar as alterações.");
  return data.exercise;
}

export async function archiveMyExercise(exerciseId: string): Promise<Exercise> {
  const response = await authFetch(`${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}/archive`, {
    method: "POST",
  });
  const data = await unwrap<{ exercise: Exercise }>(response, "Não foi possível arquivar o exercício.");
  return data.exercise;
}

export async function restoreMyExercise(exerciseId: string): Promise<Exercise> {
  const response = await authFetch(`${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}/restore`, {
    method: "POST",
  });
  const data = await unwrap<{ exercise: Exercise }>(response, "Não foi possível restaurar o exercício.");
  return data.exercise;
}

/** Passo 1 — pede uma URL assinada de upload (PUT direto no storage). */
async function getUploadTarget(exerciseId: string, contentType: string, byteSize: number): Promise<UploadTarget> {
  const response = await authFetch(
    `${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}/media/upload-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType, byteSize }),
    },
  );
  return unwrap<UploadTarget>(response, "Não foi possível iniciar o envio da imagem.");
}

/** Passo 2 (imagem) — registra a mídia após o PUT no storage. */
async function registerMedia(
  exerciseId: string,
  body: { kind: "upload"; storageKey: string; isPrimary?: boolean } | { kind: "youtube"; url: string; isPrimary?: boolean },
): Promise<void> {
  const response = await authFetch(`${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await unwrap<null>(response, "Não foi possível registrar a mídia.");
}

/**
 * Fluxo completo de upload de imagem: pede URL assinada → PUT do arquivo
 * direto no storage → registra os metadados. Vídeo não sobe binário nesta
 * sprint — usar `registerYoutubeLink`.
 */
export async function uploadPersonalExerciseMedia(
  exerciseId: string,
  file: File,
  opts: { isPrimary?: boolean } = {},
): Promise<void> {
  const target = await getUploadTarget(exerciseId, file.type, file.size);
  const put = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("upload_failed");
  await registerMedia(exerciseId, { kind: "upload", storageKey: target.storageKey, isPrimary: opts.isPrimary });
}

export async function registerYoutubeLink(
  exerciseId: string,
  url: string,
  opts: { isPrimary?: boolean } = {},
): Promise<void> {
  await registerMedia(exerciseId, { kind: "youtube", url, isPrimary: opts.isPrimary });
}

export async function deleteMyExerciseMedia(exerciseId: string, mediaId: string): Promise<void> {
  const response = await authFetch(
    `${API_URL}/personal/exercises/${encodeURIComponent(exerciseId)}/media/${encodeURIComponent(mediaId)}`,
    { method: "DELETE" },
  );
  await unwrap<null>(response, "Não foi possível remover a mídia.");
}

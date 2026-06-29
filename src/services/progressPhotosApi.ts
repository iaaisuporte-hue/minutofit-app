import { API_URL, parseJson } from "./apiBase";
import { authFetch } from "./apiClient";

export type ProgressPose = "front" | "side" | "back" | "other";

export type ProgressPhoto = {
  id: number;
  takenAt: string;
  pose: ProgressPose | null;
  note: string | null;
  url: string;
  expiresIn: number;
};

type UploadTarget = { uploadUrl: string; storageKey: string; expiresIn: number };

async function unwrap<T>(response: Response, fallback: string): Promise<T> {
  const payload = await parseJson(response);
  if (!response.ok) {
    // Storage não configurado → 503: erro claro, não silencioso.
    if (response.status === 503) throw new Error("storage_unavailable");
    throw new Error(payload?.error || fallback);
  }
  return (payload?.data ?? null) as T;
}

/** Passo 1 — pede uma URL assinada de upload (PUT direto no storage). */
async function getUploadTarget(contentType: string, byteSize: number): Promise<UploadTarget> {
  const response = await authFetch(`${API_URL}/user/progress/photos/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType, byteSize }),
  });
  return unwrap<UploadTarget>(response, "Não foi possível iniciar o envio da foto.");
}

/** Passo 2 — registra a foto após o PUT no storage. */
async function registerPhoto(input: {
  storageKey: string;
  takenAt?: string;
  pose?: ProgressPose;
  note?: string;
}): Promise<ProgressPhoto> {
  const response = await authFetch(`${API_URL}/user/progress/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await unwrap<{ photo: ProgressPhoto }>(response, "Não foi possível salvar a foto.");
  return data.photo;
}

/**
 * Fluxo completo de upload: pede URL assinada → PUT do arquivo direto no storage
 * → registra os metadados. Devolve a foto pronta (com URL de leitura assinada).
 */
export async function uploadProgressPhoto(
  file: File,
  meta: { pose?: ProgressPose; note?: string; takenAt?: string } = {},
): Promise<ProgressPhoto> {
  const target = await getUploadTarget(file.type, file.size);
  const put = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("upload_failed");
  return registerPhoto({ storageKey: target.storageKey, ...meta });
}

export async function listProgressPhotos(): Promise<ProgressPhoto[]> {
  const response = await authFetch(`${API_URL}/user/progress/photos`);
  const data = await unwrap<{ photos: ProgressPhoto[] }>(response, "Não foi possível carregar as fotos.");
  return data?.photos ?? [];
}

export async function deleteProgressPhoto(id: number): Promise<void> {
  const response = await authFetch(`${API_URL}/user/progress/photos/${id}`, { method: "DELETE" });
  await unwrap<null>(response, "Não foi possível remover a foto.");
}

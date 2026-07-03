import { useEffect, useRef, useState } from "react";
import { COLORS } from "../../styles/colors";
import {
  listProgressPhotos,
  uploadProgressPhoto,
  deleteProgressPhoto,
  type ProgressPhoto,
  type ProgressPose,
} from "../../services/progressPhotosApi";
import { ConfirmModal } from "../team/ConfirmModal";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic"]);

const POSE_LABEL: Record<ProgressPose, string> = {
  front: "Frente",
  side: "Lado",
  back: "Costas",
  other: "Outro",
};

function formatDate(iso: string): string {
  // iso = 'YYYY-MM-DD' (sem timezone) — evita shift de fuso.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function ProgressPhotosSection() {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pose, setPose] = useState<ProgressPose>("front");
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      setPhotos(await listProgressPhotos());
      setStorageUnavailable(false);
    } catch (e) {
      if (e instanceof Error && e.message === "storage_unavailable") setStorageUnavailable(true);
      else setError("Não foi possível carregar suas fotos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Formato não suportado. Use JPG, PNG, WEBP ou HEIC.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Imagem muito grande (máximo 10MB).");
      return;
    }
    setUploading(true);
    try {
      const photo = await uploadProgressPhoto(file, { pose });
      setPhotos((prev) => [photo, ...prev]);
    } catch (e) {
      if (e instanceof Error && e.message === "storage_unavailable") setStorageUnavailable(true);
      else setError("Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setUploading(false);
    }
  }

  // Princípio VIII: remoção destrutiva usa ConfirmModal, nunca window.confirm.
  async function confirmDelete() {
    const id = confirmDeleteId;
    if (id == null) return;
    setDeleting(true);
    const prev = photos;
    setPhotos((p) => p.filter((x) => x.id !== id)); // otimista
    try {
      await deleteProgressPhoto(id);
    } catch {
      setPhotos(prev); // reverte
      setError("Não foi possível remover a foto.");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <section className="metabolic-history-page" style={{ display: "grid", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <div className="metabolic-eyebrow">Fotos de progresso</div>
        <h2 className="metabolic-section-title">Sua evolução visual</h2>
        <p className="metabolic-section-copy">
          Só você vê estas fotos. Um profissional só tem acesso se você compartilhar explicitamente
          em <strong>Minha equipe</strong> (permissão “Fotos de evolução”).
        </p>
      </div>

      {storageUnavailable ? (
        <div className="badge badge-warn" role="status">
          O envio de fotos está temporariamente indisponível. Tente mais tarde.
        </div>
      ) : (
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontSize: "var(--text-sm)", color: COLORS.muted, display: "flex", alignItems: "center", gap: 8 }}>
            Ângulo
            <select
              value={pose}
              onChange={(ev) => setPose(ev.target.value as ProgressPose)}
              disabled={uploading}
              style={{ padding: "6px 10px", borderRadius: "var(--radius-lg)", border: `1px solid ${COLORS.border}`, background: COLORS.panel, color: COLORS.text }}
            >
              {(Object.keys(POSE_LABEL) as ProgressPose[]).map((p) => (
                <option key={p} value={p}>{POSE_LABEL[p]}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-accent" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Enviando…" : "Adicionar foto"}
          </button>
          <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={handleFile} />
        </div>
      )}

      {error && <div className="badge badge-warn" role="alert">{error}</div>}

      {loading ? (
        <p className="metabolic-section-copy">Carregando suas fotos…</p>
      ) : photos.length === 0 ? (
        !storageUnavailable && (
          <div className="metabolic-empty">
            <p className="metabolic-section-copy">
              Você ainda não registrou fotos. Uma foto de frente, lado e costas a cada poucas semanas
              ajuda a enxergar a evolução que a balança não mostra.
            </p>
          </div>
        )
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {photos.map((photo) => (
            <figure
              key={photo.id}
              style={{
                margin: 0,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                background: COLORS.panelDeep,
                display: "grid",
              }}
            >
              <div style={{ position: "relative", aspectRatio: "3 / 4", background: COLORS.panel }}>
                <img
                  src={photo.url}
                  alt={`Progresso ${photo.pose ? POSE_LABEL[photo.pose] : ""} — ${formatDate(photo.takenAt)}`}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(photo.id)}
                  aria-label="Remover foto"
                  title="Remover"
                  style={{
                    position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%",
                    border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", cursor: "pointer",
                    fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  ×
                </button>
              </div>
              <figcaption style={{ padding: "8px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "var(--text-xs)", color: COLORS.text, fontWeight: "var(--font-semibold)" }}>
                  {formatDate(photo.takenAt)}
                </span>
                {photo.pose && (
                  <span style={{ fontSize: "var(--text-xs)", color: COLORS.muted }}>{POSE_LABEL[photo.pose]}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {confirmDeleteId != null && (
        <ConfirmModal
          title="Remover esta foto?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Remover"
          destructive
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </section>
  );
}

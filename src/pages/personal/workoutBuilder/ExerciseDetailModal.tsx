import { useEffect, useMemo, useState } from "react";
import { getExerciseById, type Exercise } from "../../../services/exercisesApi";
import { WB } from "./workoutBuilderTheme";
import { WbButton } from "./WorkoutBuilderUi";

interface Props {
  exerciseId: string;
  alreadyAdded: boolean;
  onAdd: () => void;
  onClose: () => void;
}

export function ExerciseDetailModal({ exerciseId, alreadyAdded, onAdd, onClose }: Props) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  // Animation: alternate between frame 0 and frame 1
  const [showFrame1, setShowFrame1] = useState(false);
  const [frame1Error, setFrame1Error] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setExercise(null);
    setImgError(false);
    setShowFrame1(false);
    setFrame1Error(false);
    void (async () => {
      try {
        const data = await getExerciseById(exerciseId);
        if (!cancelled) setExercise(data);
      } catch {
        if (!cancelled) setError("Não foi possível carregar os detalhes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [exerciseId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const primaryMedia = exercise?.media.find((m) => m.isPrimary) ?? exercise?.media[0] ?? null;
  const mediaUrl = !imgError ? (primaryMedia?.url ?? null) : null;
  const isYoutube = primaryMedia?.mediaType === "youtube";

  // Derive second frame URL for free-exercise-db images (0.jpg → 1.jpg)
  const frame1Url = useMemo(() => {
    if (!mediaUrl || isYoutube || frame1Error) return null;
    if (mediaUrl.includes("/0.jpg")) return mediaUrl.replace("/0.jpg", "/1.jpg");
    return null;
  }, [mediaUrl, isYoutube, frame1Error]);

  // Alternate frames when frame1 is available
  useEffect(() => {
    if (!frame1Url) { setShowFrame1(false); return; }
    const id = setInterval(() => setShowFrame1((v) => !v), 700);
    return () => clearInterval(id);
  }, [frame1Url]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--color-surface)",
          borderRadius: 14,
          boxShadow: "0 20px 60px rgba(15,23,42,0.2)",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          display: "grid",
          gap: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px 10px",
            borderBottom: `1px solid ${WB.border}`,
            position: "sticky",
            top: 0,
            background: "var(--color-surface)",
            zIndex: 2,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 15, color: WB.text }}>
            {loading ? "Carregando…" : (exercise?.name ?? "Exercício")}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: WB.muted,
              fontSize: 20,
              lineHeight: 1,
              padding: "2px 6px",
            }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 16, display: "grid", gap: 14 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: WB.muted, padding: "24px 0", fontSize: 13 }}>
              Carregando detalhes…
            </div>
          ) : error ? (
            <div style={{ textAlign: "center", color: WB.danger ?? "#EF4444", fontSize: 13, padding: "16px 0" }}>
              {error}
            </div>
          ) : exercise ? (
            <>
              {/* Media */}
              {mediaUrl && !isYoutube ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {/* Cross-fade between frame 0 and frame 1 when available */}
                  <div
                    style={{
                      position: "relative",
                      width: 240,
                      height: 240,
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#F1F5F9",
                      flexShrink: 0,
                    }}
                  >
                    {/* Frame 0 (base) */}
                    <img
                      src={mediaUrl}
                      alt={exercise.name}
                      width={240}
                      height={240}
                      onError={() => setImgError(true)}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 10,
                        transition: frame1Url ? "opacity 0.3s ease" : undefined,
                        opacity: frame1Url ? (showFrame1 ? 0 : 1) : 1,
                      }}
                    />
                    {/* Frame 1 (overlay, only when available) */}
                    {frame1Url ? (
                      <img
                        src={frame1Url}
                        alt=""
                        aria-hidden="true"
                        width={240}
                        height={240}
                        onError={() => setFrame1Error(true)}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          borderRadius: 10,
                          transition: "opacity 0.3s ease",
                          opacity: showFrame1 ? 1 : 0,
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              ) : mediaUrl && isYoutube ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <a
                    href={mediaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: `1px solid ${WB.border}`,
                      color: WB.text,
                      textDecoration: "none",
                      fontSize: 13,
                      fontWeight: 600,
                      background: "var(--color-bg-main)",
                    }}
                  >
                    Assistir no YouTube
                  </a>
                </div>
              ) : (
                <div
                  style={{
                    height: 120,
                    borderRadius: 10,
                    background: "#F1F5F9",
                    display: "grid",
                    placeItems: "center",
                    color: WB.muted,
                    fontSize: 13,
                  }}
                >
                  Sem mídia disponível
                </div>
              )}

              {/* Meta chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[
                  exercise.targetMuscle,
                  ...exercise.secondaryMuscles.slice(0, 2),
                  exercise.equipment,
                ]
                  .filter(Boolean)
                  .map((label) => (
                    <span
                      key={label}
                      style={{
                        padding: "3px 9px",
                        borderRadius: 999,
                        border: `1px solid ${WB.border}`,
                        fontSize: 11,
                        fontWeight: 600,
                        color: WB.text,
                        background: "var(--color-bg-main)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </span>
                  ))}
              </div>

              {/* Instructions */}
              {exercise.instructions.length > 0 ? (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: WB.muted,
                      marginBottom: 8,
                    }}
                  >
                    Execução
                  </div>
                  <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                    {exercise.instructions.map((step, i) => (
                      <li key={i} style={{ fontSize: 13, color: WB.text, lineHeight: 1.5 }}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {/* Tips (colapsável) */}
              {exercise.tips.length > 0 ? (
                <div>
                  <button
                    type="button"
                    onClick={() => setTipsOpen((v) => !v)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: WB.muted,
                    }}
                  >
                    <span>{tipsOpen ? "▲" : "▼"}</span>
                    Dicas ({exercise.tips.length})
                  </button>
                  {tipsOpen ? (
                    <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 5 }}>
                      {exercise.tips.map((tip, i) => (
                        <li key={i} style={{ fontSize: 13, color: WB.muted, lineHeight: 1.45 }}>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {!loading && exercise ? (
          <div
            style={{
              padding: "12px 16px",
              borderTop: `1px solid ${WB.border}`,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              position: "sticky",
              bottom: 0,
              background: "var(--color-surface)",
            }}
          >
            <WbButton variant="ghost" onClick={onClose}>Fechar</WbButton>
            <WbButton
              variant="primary"
              disabled={alreadyAdded}
              onClick={onAdd}
              title={alreadyAdded ? "Já adicionado" : undefined}
            >
              {alreadyAdded ? "Já na lista" : "Adicionar à ficha"}
            </WbButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

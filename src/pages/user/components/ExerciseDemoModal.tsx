import { useEffect, useState } from "react";
import { searchExercises, type ExerciseSummary } from "../../../services/exercisesApi";
import { COLORS } from "../../../styles/colors";

/**
 * Normaliza a descrição livre do exercício (ex: "5 min de mobilidade global",
 * "Flexão tradicional: 4 séries de 10 a 15") no núcleo do movimento, para casar
 * com a biblioteca de exercícios (que carrega os GIFs do free-exercise-db).
 */
function cleanExerciseQuery(activity: string): string {
  let q = activity.trim();
  // corta "N min/séries/x de", "4 séries de 10 a 15 repetições", etc.
  q = q.replace(
    /^\s*\d+\s*(a\s*\d+)?\s*(min(utos)?|s[ée]ries?|x|reps?|repeti[çc][õo]es)\b\.?\s*(de\s+)?/i,
    ""
  );
  // remove sufixo após ":" ou "—" (instruções de série/rep)
  q = q.split(/[:—–]/)[0];
  const words = q.split(/[\s,]+/).filter(Boolean).slice(0, 3);
  return words.join(" ") || activity;
}

/** GIF do free-exercise-db vem como frames /0.jpg e /1.jpg — anima alternando. */
function frame1FromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("/0.jpg")) return url.replace("/0.jpg", "/1.jpg");
  return null;
}

function useThumbTick() {
  const [tick, setTick] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((v) => !v), 700);
    return () => clearInterval(id);
  }, []);
  return tick;
}

/**
 * Modal de demonstração de exercício por NOME (texto livre vindo do treino
 * sugerido). Busca na biblioteca e exibe o GIF (mesma fonte usada quando a ficha
 * vem do professor). Sem match → mensagem honesta, nunca clique morto.
 */
export function ExerciseDemoModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState<ExerciseSummary | null>(null);
  const showFrame1 = useThumbTick();

  // O componente é remontado por exercício (key={name} no render), então o estado
  // inicial (loading=true) já cobre o reset — o efeito só dispara a busca.
  useEffect(() => {
    let alive = true;
    searchExercises({ q: cleanExerciseQuery(name), limit: 1 })
      .then((rows) => {
        if (alive) setExercise(rows[0] ?? null);
      })
      .catch(() => {
        if (alive) setExercise(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [name]);

  const gifUrl =
    exercise?.primaryMediaUrl &&
    (exercise.primaryMediaType === "gif" || exercise.primaryMediaType === "image")
      ? exercise.primaryMediaUrl
      : null;
  const frame1 = frame1FromUrl(gifUrl);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1300,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.panel,
          borderRadius: 18,
          padding: 18,
          maxWidth: 420,
          width: "100%",
          display: "grid",
          gap: 12,
          boxShadow: "0 24px 60px rgba(0,0,0,.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text, lineHeight: 1.3 }}>
            {exercise?.name ?? name}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 32,
              height: 32,
              flexShrink: 0,
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.panelSoft,
              cursor: "pointer",
              color: COLORS.muted,
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "1 / 1",
            maxHeight: 300,
            borderRadius: 12,
            overflow: "hidden",
            background: COLORS.panelSoft,
            display: "grid",
            placeItems: "center",
          }}
        >
          {loading ? (
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Carregando demonstração…</div>
          ) : gifUrl ? (
            <>
              <img
                key={gifUrl}
                src={gifUrl}
                alt={exercise?.name ?? name}
                decoding="async"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  transition: frame1 ? "opacity 0.3s ease" : undefined,
                  opacity: frame1 ? (showFrame1 ? 0 : 1) : 1,
                }}
              />
              {frame1 ? (
                <img
                  src={frame1}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    transition: "opacity 0.3s ease",
                    opacity: showFrame1 ? 1 : 0,
                  }}
                />
              ) : null}
            </>
          ) : (
            <div style={{ color: COLORS.muted, fontSize: 13, textAlign: "center", padding: 16, lineHeight: 1.5 }}>
              Ainda não temos demonstração para este exercício.
              <br />
              Siga o nome do movimento e mantenha a execução controlada.
            </div>
          )}
        </div>

        {exercise && (exercise.targetMuscle || exercise.equipment) ? (
          <div style={{ fontSize: 12, color: COLORS.muted }}>
            {exercise.targetMuscle}
            {exercise.equipment ? ` · ${exercise.equipment}` : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}

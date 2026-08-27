import { useEffect, useRef, useState } from "react";
import {
  buildShareText,
  canShareWorkoutImage,
  composeWorkoutImage,
  copyShareText,
  downloadComposedImage,
  shareImageBlob,
  type ComposedImage,
  type WorkoutShareExercise,
  type WorkoutShareFormat,
  type WorkoutShareStats,
} from "../lib/shareWorkoutImage";

type Props = {
  focus: string;
  dayName?: string;
  /** Estatísticas seguras opcionais para enriquecer o card e o texto. */
  stats?: WorkoutShareStats | null;
  /** Exercícios executados — viram a mini tabela do card. */
  exercises?: WorkoutShareExercise[] | null;
  onClose: () => void;
};

/**
 * Preview e compartilhamento da conquista do treino (estilo GymRats/Strava):
 * o aluno escolhe/tira uma foto que vira o fundo do card, vê o resultado e
 * compartilha. O share() parte do botão "Compartilhar" (gesto do usuário).
 */
export function ShareWorkoutModal({ focus, dayName, stats, exercises, onClose }: Props) {
  const [image, setImage] = useState<ComposedImage | null>(null);
  const [composing, setComposing] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [format, setFormat] = useState<WorkoutShareFormat>("story");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Capacidade de share nativo (≈ mobile). No desktop cai nos fallbacks abaixo.
  const nativeShare = canShareWorkoutImage();

  async function recompose(bg: File | null, fmt: WorkoutShareFormat) {
    setComposing(true);
    setError(null);
    try {
      const img = await composeWorkoutImage({ focus, dayName, backgroundFile: bg, format: fmt, stats, exercises });
      setImage(img);
    } catch {
      setError("Não consegui montar a imagem com essa foto. Tente outra.");
    } finally {
      setComposing(false);
    }
  }

  useEffect(() => {
    void recompose(null, "story");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // permite reescolher a mesma foto
    if (f) {
      setPhoto(f);
      void recompose(f, format);
    }
  }

  function onFormat(fmt: WorkoutShareFormat) {
    if (fmt === format) return;
    setFormat(fmt);
    void recompose(photo, fmt);
  }

  const hasPhoto = photo !== null;

  async function onShare() {
    if (!image) return;
    setSharing(true);
    try {
      const ok = await shareImageBlob(image, stats);
      if (ok) onClose();
    } finally {
      setSharing(false);
    }
  }

  function onDownload() {
    if (!image) return;
    downloadComposedImage(image);
  }

  async function onCopy() {
    const ok = await copyShareText(buildShareText({ focus, dayName, stats }));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(7,12,18,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compartilhar treino"
        style={{
          background: "var(--color-surface)",
          borderRadius: 18,
          padding: 18,
          width: "min(420px, 100%)",
          maxHeight: "92vh",
          overflowY: "auto",
          display: "grid",
          gap: 14,
          boxShadow: "0 24px 64px rgba(7,12,18,0.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>Compartilhar treino</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4, borderRadius: 8, lineHeight: 0 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Preview do card (proporção segue o formato escolhido) */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 140,
            padding: 6,
            borderRadius: 12,
            background: "var(--color-surface-strong, rgba(15,23,42,0.06))",
            border: "1px solid var(--color-border)",
          }}
        >
          {image ? (
            <img
              src={image.dataUrl}
              alt="Prévia do treino"
              style={{ display: "block", maxWidth: "100%", maxHeight: "56vh", borderRadius: 8 }}
            />
          ) : null}
          {composing ? (
            <span style={{ position: "absolute", fontSize: 13, color: "var(--color-text-muted)", background: "var(--color-surface)", padding: "4px 10px", borderRadius: 999 }}>
              Gerando…
            </span>
          ) : null}
        </div>

        {/* Formato do card */}
        <div style={{ display: "flex", gap: 8 }}>
          {([["story", "Story 9:16"], ["square", "Feed 1:1"]] as const).map(([fmt, label]) => (
            <button
              key={fmt}
              type="button"
              onClick={() => onFormat(fmt)}
              aria-pressed={format === fmt}
              disabled={composing}
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 10,
                border: `1px solid ${format === fmt ? "var(--color-primary)" : "var(--color-border)"}`,
                background: format === fmt ? "var(--color-primary-soft, rgba(123,153,25,0.10))" : "transparent",
                color: "var(--color-text)",
                fontWeight: 700,
                fontSize: 13,
                cursor: composing ? "not-allowed" : "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div style={{ fontSize: 12, color: "var(--color-danger)" }}>{error}</div>
        ) : null}

        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={composing}
          style={{
            width: "100%", padding: "11px 16px", minHeight: 44, borderRadius: 12,
            border: "1px solid var(--color-border)", background: "transparent",
            color: "var(--color-text)", fontWeight: 700, fontSize: 14,
            cursor: composing ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
          </svg>
          {hasPhoto ? "Trocar foto de fundo" : "Adicionar foto de fundo"}
        </button>

        {/* Share nativo (mobile) — abre Stories/apps. Só quando o device suporta. */}
        {nativeShare ? (
          <button
            type="button"
            onClick={() => void onShare()}
            disabled={!image || composing || sharing}
            style={{
              width: "100%", padding: "13px 16px", minHeight: 48, borderRadius: 12,
              border: "none", background: "var(--action-primary)", color: "#fff",
              fontWeight: 700, fontSize: 15,
              cursor: !image || composing || sharing ? "not-allowed" : "pointer",
              opacity: !image || composing || sharing ? 0.75 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            {sharing ? "Abrindo…" : "Compartilhar nos Stories"}
          </button>
        ) : null}

        {/* Fallbacks (sempre disponíveis — cobre desktop e devices sem Web Share). */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onDownload}
            disabled={!image || composing}
            style={{
              flex: 1, padding: "12px 14px", minHeight: 46, borderRadius: 12,
              border: nativeShare ? "1px solid var(--color-border)" : "none",
              background: nativeShare ? "transparent" : "var(--color-primary)",
              color: nativeShare ? "var(--color-text)" : "#fff",
              fontWeight: 700, fontSize: 14,
              cursor: !image || composing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Baixar imagem
          </button>
          <button
            type="button"
            onClick={() => void onCopy()}
            style={{
              flex: 1, padding: "12px 14px", minHeight: 46, borderRadius: 12,
              border: "1px solid var(--color-border)", background: "transparent",
              color: "var(--color-text)", fontWeight: 700, fontSize: 14,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {copied ? "Copiado!" : "Copiar texto"}
          </button>
        </div>
      </div>
    </div>
  );
}

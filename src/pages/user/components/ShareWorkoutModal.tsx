import { useEffect, useRef, useState } from "react";
import {
  buildShareText,
  composeWorkoutImage,
  copyShareText,
  type ComposedImage,
  type WorkoutShareExercise,
  type WorkoutShareFormat,
  type WorkoutShareStats,
} from "../lib/shareWorkoutImage";
import {
  compartilharArte,
  pedirFoto,
  podeCompartilharImagem,
  salvarArte,
} from "../lib/nativeShare";
import { isNativeApp } from "../../../lib/platform";

type Props = {
  focus: string;
  dayName?: string;
  /** Estatísticas seguras opcionais para enriquecer o card e o texto. */
  stats?: WorkoutShareStats | null;
  /** Exercícios executados — viram a mini tabela do card. */
  exercises?: WorkoutShareExercise[] | null;
  /** Manchete da arte. Padrão "TREINO CONCLUÍDO"; atividade usa a sua (§63). */
  eyebrow?: string;
  /** Rótulo do painel de linhas. Padrão "EXERCÍCIOS EXECUTADOS". */
  panelLabel?: string;
  /** Título do modal. */
  title?: string;
  /** Texto alternativo para copiar/compartilhar (atividade tem o seu). */
  shareText?: string;
  onClose: () => void;
};

/**
 * Preview e compartilhamento da conquista do treino (estilo GymRats/Strava):
 * o aluno escolhe/tira uma foto que vira o fundo do card, vê o resultado e
 * compartilha. O share() parte do botão "Compartilhar" (gesto do usuário).
 *
 * Toda ação de sistema (câmera, galeria, share sheet, salvar) passa por
 * `lib/nativeShare.ts`, que escolhe o caminho nativo ou web. Antes disto a tela
 * chamava as APIs web direto e, no app empacotado, três das quatro falhavam em
 * silêncio — ver o cabeçalho daquele arquivo.
 */
const photoBtnStyle = (busy: boolean): React.CSSProperties => ({
  flex: "1 1 140px", padding: "11px 16px", minHeight: 44, borderRadius: 12,
  border: "1px solid var(--color-border)", background: "transparent",
  color: "var(--color-text)", fontWeight: 700, fontSize: 14,
  cursor: busy ? "not-allowed" : "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
});

type Aviso = { tipo: "ok" | "erro"; texto: string } | null;

export function ShareWorkoutModal({ focus, dayName, stats, exercises, eyebrow, panelLabel, title, shareText, onClose }: Props) {
  const [image, setImage] = useState<ComposedImage | null>(null);
  const [composing, setComposing] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [format, setFormat] = useState<WorkoutShareFormat>("story");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const avisoTimer = useRef<number | null>(null);

  const nativo = isNativeApp();

  // `capture` só faz sentido em device com câmera (touch). No desktop o atributo
  // é ignorado e abriria um segundo seletor de arquivo idêntico ao da galeria.
  // No app empacotado nem se usa `<input>`: o plugin de câmera cuida disso.
  const hasCamera =
    nativo ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(pointer: coarse)").matches === true);

  const nativeShare = podeCompartilharImagem();

  function mostrar(tipo: "ok" | "erro", texto: string) {
    setAviso({ tipo, texto });
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 4000);
  }

  useEffect(() => () => { if (avisoTimer.current) window.clearTimeout(avisoTimer.current); }, []);

  async function recompose(bg: File | null, fmt: WorkoutShareFormat) {
    setComposing(true);
    setError(null);
    try {
      // `dayName`/`stats` seguem no componente para o TEXTO que acompanha o
      // compartilhamento — a arte deixou de exibir os dois.
      const img = await composeWorkoutImage({ focus, backgroundFile: bg, format: fmt, exercises, eyebrow, panelLabel });
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

  function aplicarFoto(f: File) {
    setPhoto(f);
    void recompose(f, format);
    mostrar("ok", "Foto adicionada ao card.");
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    e.target.value = ""; // permite reescolher a mesma foto
    if (f) aplicarFoto(f);
  }

  /**
   * "Tirar foto" / "Galeria".
   *
   * No nativo, pede a permissão só agora (§13) e, se negada, explica e mantém a
   * galeria como saída — o fluxo nunca trava. Na web segue pelo `<input>`.
   */
  async function escolherFoto(origem: "camera" | "galeria") {
    if (!nativo) {
      (origem === "camera" ? cameraRef : fileRef).current?.click();
      return;
    }
    const r = await pedirFoto(origem);
    if (r.ok) { aplicarFoto(r.file); return; }
    if (r.cancelado) return; // desistir não é erro
    mostrar("erro", r.motivo);
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
      const r = await compartilharArte(image, stats);
      if (r.ok) { onClose(); return; }
      if (!r.cancelado) mostrar("erro", r.motivo);
    } finally {
      setSharing(false);
    }
  }

  async function onDownload() {
    if (!image) return;
    const r = await salvarArte(image);
    if (r.ok) mostrar("ok", "Imagem salva com sucesso.");
    else if (!r.cancelado) mostrar("erro", r.motivo);
  }

  async function onCopy() {
    const ok = await copyShareText(shareText ?? buildShareText({ focus, dayName, stats }));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      mostrar("erro", "Não consegui copiar o texto.");
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
        // Safe areas: em edge-to-edge (Android 15+/iPhone com notch) o modal
        // centralizado encostava na status bar e no home indicator.
        paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Compartilhar treino"}
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
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--color-text)" }}>{title ?? "Compartilhar treino"}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--color-text-muted)", borderRadius: 8, lineHeight: 0,
              // 44×44: o × era 26px e ficava abaixo do alvo mínimo (§8).
              minWidth: 44, minHeight: 44,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: -8,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
                minHeight: 44,
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
          <div style={{ fontSize: 12, color: "var(--color-danger)" }} role="alert">{error}</div>
        ) : null}

        {/* Feedback de ação (§19/§27): salvar, foto adicionada, permissão negada. */}
        {aviso ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              fontSize: 13, lineHeight: 1.35, padding: "10px 12px", borderRadius: 10,
              border: `1px solid ${aviso.tipo === "ok" ? "var(--color-success-border, var(--color-border))" : "var(--color-danger-border, var(--color-border))"}`,
              background: aviso.tipo === "ok" ? "var(--color-success-soft, transparent)" : "var(--color-danger-soft, transparent)",
              color: aviso.tipo === "ok" ? "var(--color-success-text, var(--color-text))" : "var(--color-danger-text, var(--color-danger))",
            }}
          >
            {aviso.texto}
          </div>
        ) : null}

        {/* Só na web: no app empacotado quem abre câmera/galeria é o plugin. */}
        {!nativo ? (
          <>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPick}
              style={{ display: "none" }}
            />
          </>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {hasCamera ? (
            <button
              type="button"
              onClick={() => void escolherFoto("camera")}
              disabled={composing}
              style={photoBtnStyle(composing)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
              Tirar foto
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void escolherFoto("galeria")}
            disabled={composing}
            style={photoBtnStyle(composing)}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
            {hasCamera ? "Galeria" : hasPhoto ? "Trocar foto de fundo" : "Adicionar foto de fundo"}
          </button>
        </div>

        {/* Share sheet do sistema. No app empacotado sempre existe; na web,
            só quando a Web Share API aceita arquivo. */}
        {nativeShare ? (
          <button
            type="button"
            onClick={() => void onShare()}
            disabled={!image || composing || sharing}
            style={{
              width: "100%", padding: "13px 16px", minHeight: 48, borderRadius: 12,
              border: "none", background: "var(--action-primary)", color: "var(--action-primary-text)",
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
            {sharing ? "Abrindo…" : "Compartilhar"}
          </button>
        ) : null}

        {/* Fallbacks (sempre disponíveis — cobre desktop e devices sem Web Share). */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={!image || composing}
            style={{
              flex: "1 1 140px", padding: "12px 14px", minHeight: 46, borderRadius: 12,
              border: nativeShare ? "1px solid var(--color-border)" : "none",
              background: nativeShare ? "transparent" : "var(--action-primary)",
              color: nativeShare ? "var(--color-text)" : "var(--action-primary-text)",
              fontWeight: 700, fontSize: 14,
              cursor: !image || composing ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Salvar imagem
          </button>
          <button
            type="button"
            onClick={() => void onCopy()}
            style={{
              flex: "1 1 140px", padding: "12px 14px", minHeight: 46, borderRadius: 12,
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

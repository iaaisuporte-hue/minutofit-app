import { useState } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";

interface Video {
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  duration_seconds: number;
  tags: string[];
  created_at: string;
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

const COLORS = {
  bg: "#0F1110",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  card: "rgba(255,255,255,.03)",
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  muted2: "rgba(232,236,233,.58)",
  green: "#1DB954",
  greenSoft: "rgba(29,185,84,.18)",
  greenSoftStrong: "rgba(29,185,84,.10)",
  danger: "#FF6B6B",
  dangerSoft: "rgba(255, 77, 77, .14)",
};

// Default tags - should match database
const AVAILABLE_TAGS: Tag[] = [
  { id: 1, name: "Perda de Peso", slug: "perda-de-peso" },
  { id: 2, name: "Ganho de Massa", slug: "ganho-de-massa" },
  { id: 3, name: "Aeróbico", slug: "aerobico" },
  { id: 4, name: "Força", slug: "forca" },
  { id: 5, name: "Iniciante", slug: "iniciante" },
  { id: 6, name: "Intermediário", slug: "intermediario" },
  { id: 7, name: "Avançado", slug: "avancado" },
  { id: 8, name: "Flexibilidade", slug: "flexibilidade" },
  { id: 9, name: "Yoga", slug: "yoga" },
  { id: 10, name: "Pilates", slug: "pilates" },
  { id: 11, name: "HIIT", slug: "hiit" },
  { id: 12, name: "Cardio", slug: "cardio" },
  { id: 13, name: "Peito", slug: "peito" },
  { id: 14, name: "Perna", slug: "perna" },
  { id: 15, name: "Costas", slug: "costas" },
  { id: 16, name: "Braços", slug: "bracos" },
  { id: 17, name: "Ombro", slug: "ombro" },
  { id: 18, name: "Glúteo", slug: "gluteo" },
  { id: 19, name: "Recuperação", slug: "recuperacao" },
  { id: 20, name: "Aquecimento", slug: "aquecimento" },
];

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        background: COLORS.card,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 16,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ color: COLORS.muted2, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.9 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 1000, color: COLORS.text }}>{value}</div>
      <div style={{ color: COLORS.muted, fontSize: 12 }}>{helper}</div>
    </div>
  );
}

function TagPill({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        background: active ? COLORS.greenSoft : "rgba(255,255,255,.04)",
        border: `1px solid ${active ? COLORS.borderStrong : COLORS.border}`,
        color: active ? COLORS.text : COLORS.muted,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {children}
    </span>
  );
}

export default function VideoLibraryPage() {
  const isMobile = useIsMobile(720);
  const [videos, setVideos] = useState<Video[]>(() => {
    const stored = localStorage.getItem("videos_library");
    return stored ? JSON.parse(stored) : [];
  });
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedVideoToPlay, setSelectedVideoToPlay] = useState<Video | null>(null);
  const [videoBlobs, setVideoBlobs] = useState<Record<number, string>>({});
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });

  // Save videos to localStorage whenever they change
  const saveVideosToStorage = (newVideos: Video[]) => {
    setVideos(newVideos);
    localStorage.setItem("videos_library", JSON.stringify(newVideos));
  };

  function handleTagToggle(tagSlug: string) {
    setSelectedTags((prev) =>
      prev.includes(tagSlug) ? prev.filter((t) => t !== tagSlug) : [...prev, tagSlug]
    );
  }

  async function handleSubmitVideo(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !selectedVideoFile || selectedTags.length === 0) {
      alert("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    // Validate file type
    const validTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    if (!validTypes.includes(selectedVideoFile.type)) {
      alert("Formato inválido. Formatos suportados: MP4, WebM, MOV, AVI");
      return;
    }

    // Validate file size (500MB max)
    const maxSize = 500 * 1024 * 1024;
    if (selectedVideoFile.size > maxSize) {
      alert("Arquivo muito grande. Máximo: 500MB");
      return;
    }

    setIsUploading(true);

    try {
      // Read file as data URL for local storage
      const reader = new FileReader();
      reader.onload = () => {
        // Create video object with base64 encoded video
        const videoId = Date.now();
        const mockVideo: Video = {
          id: videoId,
          title: formData.title,
          description: formData.description,
          url: selectedVideoFile.name,
          thumbnail_url: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Crect fill='%23222' width='120' height='90'/%3E%3Ctext x='50%25' y='50%25' font-size='24' fill='%238B8B8B' text-anchor='middle' dy='.3em'%3E▶️%3C/text%3E%3C/svg%3E`,
          duration_seconds: 0,
          tags: selectedTags,
          created_at: new Date().toISOString(),
        };

        // Store video blob data URL for playback
        setVideoBlobs((prev) => ({
          ...prev,
          [videoId]: reader.result as string,
        }));
        localStorage.setItem(`video_blob_${videoId}`, reader.result as string);

        // Add new video to list and save to localStorage
        const newVideos = [mockVideo, ...videos];
        saveVideosToStorage(newVideos);

        // Reset form
        setFormData({ title: "", description: "" });
        setSelectedVideoFile(null);
        setSelectedTags([]);
        setShowUploadForm(false);
        setIsUploading(false);

        alert("✓ Vídeo salvo localmente com sucesso!\n\nOs vídeos são armazenados no navegador (localStorage).");
      };

      reader.onerror = () => {
        throw new Error("Erro ao ler arquivo");
      };

      // Read file as base64 data URL for storage
      reader.readAsDataURL(selectedVideoFile);
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      alert(
        `Erro ao enviar vídeo: ${errorMessage}\n\nDicas:\n` +
        `1. Confira o formato do arquivo (MP4, WebM, MOV, AVI)\n` +
        `2. Arquivo não deve exceder 500MB\n` +
        `3. localStorage pode estar cheio (limite: ~5-10MB)`
      );
      setIsUploading(false);
    }
  }

  function deleteVideo(id: number) {
    const newVideos = videos.filter((v) => v.id !== id);
    saveVideosToStorage(newVideos);
    // Remove stored video blob
    localStorage.removeItem(`video_blob_${id}`);
    setVideoBlobs((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function playVideo(video: Video) {
    // Try to load blob from localStorage
    const storedBlob = localStorage.getItem(`video_blob_${video.id}`);
    if (storedBlob) {
      setVideoBlobs((prev) => ({
        ...prev,
        [video.id]: storedBlob,
      }));
    }
    setSelectedVideoToPlay(video);
  }

  const totalDurationSeconds = videos.reduce((total, video) => total + video.duration_seconds, 0);
  const recentCount = videos.filter((video) => Date.now() - new Date(video.created_at).getTime() <= 1000 * 60 * 60 * 24 * 30).length;

  return (
    <div style={{ display: "grid", gap: 20, color: COLORS.text }}>
      <div
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 20,
          background: COLORS.panelDeep,
          boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          padding: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontSize: 28, fontWeight: 1000 }}>Biblioteca de vídeos</div>
          <div style={{ color: COLORS.muted, maxWidth: 720, fontSize: 14, lineHeight: 1.5 }}>
            Organize sua base de demonstrações, categorize por objetivo e deixe o material pronto para reutilizar na prescrição.
          </div>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          style={{
            background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
            color: "#0B0B0B",
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 14,
            padding: "12px 20px",
            fontWeight: 900,
            cursor: "pointer",
            boxShadow: "0 10px 24px rgba(0,0,0,.35)",
          }}
        >
          {showUploadForm ? "Fechar envio" : "Novo vídeo"}
        </button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <MetricCard label="Vídeos" value={videos.length} helper="conteúdos disponíveis na biblioteca" />
        <MetricCard label="Recentes" value={recentCount} helper="publicados nos últimos 30 dias" />
        <MetricCard label="Tags ativas" value={new Set(videos.flatMap((video) => video.tags)).size} helper="categorias já usadas no acervo" />
        <MetricCard label="Duração" value={`${Math.floor(totalDurationSeconds / 60)} min`} helper="tempo somado do acervo atual" />
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          }}
        >
          <div style={{ display: "grid", gap: 6, marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Adicionar novo vídeo</h2>
            <div style={{ color: COLORS.muted, fontSize: 13 }}>Preencha os dados principais e marque as tags para facilitar busca e reutilização.</div>
          </div>

          <form onSubmit={handleSubmitVideo} style={{ display: "grid", gap: 16 }}>
            {/* Título */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="ex: Treino de Peito Iniciante"
                style={{
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                }}
              />
            </div>

            {/* Descrição */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o conteúdo do vídeo..."
                style={{
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  minHeight: 100,
                  fontFamily: "inherit",
                  fontSize: 14,
                }}
              />
            </div>

            {/* URL do Vídeo */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Arquivo de Vídeo *</label>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi"
                onChange={(e) => setSelectedVideoFile(e.target.files?.[0] || null)}
                style={{
                  background: "rgba(255,255,255,.03)",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
              {selectedVideoFile && (
                <div style={{ fontSize: 12, color: "#7CFF6B" }}>
                  ✓ Arquivo selecionado: {selectedVideoFile.name} ({(selectedVideoFile.size / 1024 / 1024).toFixed(2)}MB)
                </div>
              )}
              <div style={{ fontSize: 12, color: COLORS.muted, background: COLORS.greenSoftStrong, padding: "12px 12px", borderRadius: 12, border: `1px solid ${COLORS.border}` }}>
                <strong>Formatos:</strong> MP4, WebM, MOV, AVI
                <br />
                <strong>Tamanho máximo:</strong> 500MB
                <br />
                <strong>Armazenamento:</strong> navegador local nesta fase
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Tags * (Selecione pelo menos uma)</label>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => handleTagToggle(tag.slug)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: `1px solid ${selectedTags.includes(tag.slug) ? COLORS.borderStrong : COLORS.border}`,
                      background: selectedTags.includes(tag.slug) ? COLORS.greenSoft : "transparent",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 12,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedTags.includes(tag.slug)) {
                        e.currentTarget.style.borderColor = COLORS.borderStrong;
                        e.currentTarget.style.background = "rgba(255,255,255,.03)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedTags.includes(tag.slug)) {
                        e.currentTarget.style.borderColor = COLORS.border;
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Selected */}
            {selectedTags.length > 0 && (
              <div
                style={{
                  background: COLORS.greenSoftStrong,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>Tags selecionadas:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedTags.map((tagSlug) => (
                    <div
                      key={tagSlug}
                      style={{
                        background: COLORS.greenSoft,
                        color: "#0B0B0B",
                        padding: "6px 12px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      >
                      #{tagSlug}
                      <button
                        type="button"
                        onClick={() => handleTagToggle(tagSlug)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#0B0B0B",
                          cursor: "pointer",
                          fontWeight: 900,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isUploading}
              style={{
                background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                color: "#0B0B0B",
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: 14,
                padding: "14px 20px",
                fontWeight: 900,
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.6 : 1,
                boxShadow: "0 10px 24px rgba(0,0,0,.35)",
              }}
            >
              {isUploading ? "Enviando..." : "Enviar Vídeo"}
            </button>
          </form>
        </div>
      )}

      {/* Videos List */}
      {videos.length === 0 ? (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            padding: 36,
            textAlign: "center",
            color: COLORS.muted,
            boxShadow: "0 18px 44px rgba(0,0,0,.45)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 1000, color: COLORS.text, marginBottom: 8 }}>Sua biblioteca ainda está vazia</div>
          <p style={{ margin: 0 }}>Comece com vídeos de base para ganhar velocidade na montagem dos treinos.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Use “Novo vídeo” para publicar o primeiro conteúdo.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {videos.map((video) => (
            <div
              key={video.id}
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 18,
                padding: 16,
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "120px 1fr auto",
                gap: 16,
                alignItems: "start",
                boxShadow: "0 18px 44px rgba(0,0,0,.45)",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  background: "rgba(255,255,255,.03)",
                  borderRadius: 12,
                  minWidth: 120,
                  height: isMobile ? 180 : 90,
                  backgroundImage: `url('${video.thumbnail_url}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.muted,
                  border: `1px solid ${COLORS.border}`,
              }}
              >
                Assistir
              </div>

              {/* Video Info */}
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{video.title}</div>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
                  {video.description || "Sem descrição"}
                </p>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: COLORS.muted2, marginBottom: 10, flexWrap: "wrap" }}>
                  <span>{new Date(video.created_at).toLocaleDateString("pt-BR")}</span>
                  <span>{formatDuration(video.duration_seconds)}</span>
                  <span>{video.tags.length} tag(s)</span>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {video.tags.map((tag) => (
                    <TagPill key={tag}>#{tag}</TagPill>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: isMobile ? "row" : "column", gap: 8, textAlign: isMobile ? "left" : "right", flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {formatDuration(video.duration_seconds)}
                </div>
                <button
                  onClick={() => playVideo(video)}
                  style={{
                    background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                    color: "#0B0B0B",
                    border: `1px solid ${COLORS.borderStrong}`,
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: isMobile ? "fit-content" : undefined,
                  }}
                >
                  Assistir
                </button>
                <button
                  style={{
                    background: "rgba(255,255,255,.03)",
                    color: COLORS.text,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: isMobile ? "fit-content" : undefined,
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteVideo(video.id as number)}
                  style={{
                    background: COLORS.dangerSoft,
                    color: COLORS.danger,
                    border: "1px solid rgba(255,0,0,.18)",
                    borderRadius: 10,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    width: isMobile ? "fit-content" : undefined,
                  }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Modal */}
      {selectedVideoToPlay && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: "20px",
          }}
          onClick={() => setSelectedVideoToPlay(null)}
        >
          <div
            style={{
              background: COLORS.panel,
              borderRadius: 20,
              padding: 24,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 18px 44px rgba(0,0,0,.45)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{selectedVideoToPlay.title}</h2>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>Visualização do acervo e revisão rápida do material</div>
              </div>
              <button
                onClick={() => setSelectedVideoToPlay(null)}
                style={{
                  background: "rgba(255,255,255,.03)",
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  fontSize: 20,
                  cursor: "pointer",
                  fontWeight: 900,
                  padding: 0,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 12,
                }}
              >
                ✕
              </button>
            </div>

            {/* Video Player */}
            <div style={{ marginBottom: 20 }}>
              {videoBlobs[selectedVideoToPlay.id as number] ? (
                <video
                  src={videoBlobs[selectedVideoToPlay.id as number]}
                  style={{
                    width: "100%",
                    maxHeight: 500,
                    background: "#000",
                    borderRadius: 16,
                    border: `1px solid ${COLORS.border}`,
                  }}
                  controls
                  autoPlay
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: 400,
                    background: "rgba(255,255,255,.05)",
                    borderRadius: 12,
                    border: `1px solid ${COLORS.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: COLORS.muted,
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: COLORS.text }}>Vídeo não encontrado</div>
                  <div style={{ fontSize: 12 }}>O arquivo pode ter sido removido ou não estar acessível</div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div style={{ display: "grid", gap: 14 }}>
              {selectedVideoToPlay.description && (
                <div
                  style={{
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 14,
                    padding: 14,
                    background: "rgba(255,255,255,.02)",
                  }}
                >
                  <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, marginBottom: 6 }}>DESCRIÇÃO</div>
                  <p style={{ margin: 0, color: COLORS.muted }}>{selectedVideoToPlay.description}</p>
                </div>
              )}

              {/* Tags */}
              <div
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 14,
                  padding: 14,
                  background: "rgba(255,255,255,.02)",
                }}
              >
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, marginBottom: 6 }}>TAGS</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedVideoToPlay.tags.map((tag) => (
                    <TagPill key={tag} active>
                      #{tag}
                    </TagPill>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted, flexWrap: "wrap" }}>
                <TagPill>{new Date(selectedVideoToPlay.created_at).toLocaleDateString("pt-BR")}</TagPill>
                <TagPill>{formatDuration(selectedVideoToPlay.duration_seconds)}</TagPill>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

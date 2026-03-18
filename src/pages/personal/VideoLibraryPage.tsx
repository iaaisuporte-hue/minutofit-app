import { useState } from "react";

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
  bg: "#0F0F0F",
  panel: "#171717",
  border: "rgba(255,255,255,.10)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.70)",
  orange: "#FF6A00",
  orangeSoft: "rgba(255,106,0,.16)",
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

export default function VideoLibraryPage() {
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

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Biblioteca de Vídeos</h1>
          <p style={{ color: COLORS.muted }}>Gerencie seus vídeos de treino e adicione tags</p>
        </div>
        <button
          onClick={() => setShowUploadForm(!showUploadForm)}
          style={{
            background: COLORS.orange,
            color: "#0B0B0B",
            border: "none",
            borderRadius: 12,
            padding: "12px 20px",
            fontWeight: 900,
            cursor: "pointer",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {showUploadForm ? "Cancelar" : "+ Novo Vídeo"}
        </button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div
          style={{
            background: COLORS.panel,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 16,
            padding: 24,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>Enviar Novo Vídeo</h2>

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
                  background: "#101010",
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
                  background: "#101010",
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
                  background: "#101010",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  cursor: "pointer",
                }}
              />
              {selectedVideoFile && (
                <div style={{ fontSize: 12, color: COLORS.orange }}>
                  ✓ Arquivo selecionado: {selectedVideoFile.name} ({(selectedVideoFile.size / 1024 / 1024).toFixed(2)}MB)
                </div>
              )}
              <div style={{ fontSize: 12, color: COLORS.muted, background: "rgba(255,106,0,.08)", padding: "12px 12px", borderRadius: 8, border: `1px solid rgba(255,106,0,.20)` }}>
                <strong>📁 Formatos:</strong> MP4, WebM, MOV, AVI
                <br />
                <strong>📏 Tamanho máximo:</strong> 500MB
                <br />
                <strong>📂 Destino:</strong> /minutofit-app/videos/
              </div>
            </div>

            {/* Tags */}
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Tags * (Selecione pelo menos uma)</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>
                {AVAILABLE_TAGS.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => handleTagToggle(tag.slug)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `2px solid ${selectedTags.includes(tag.slug) ? COLORS.orange : COLORS.border}`,
                      background: selectedTags.includes(tag.slug) ? COLORS.orangeSoft : "transparent",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: 12,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedTags.includes(tag.slug)) {
                        e.currentTarget.style.borderColor = COLORS.orange;
                        e.currentTarget.style.background = "rgba(255,106,0,.08)";
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
                  background: "rgba(255,106,0,.08)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 8 }}>Tags selecionadas:</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedTags.map((tagSlug) => (
                    <div
                      key={tagSlug}
                      style={{
                        background: COLORS.orange,
                        color: "#0B0B0B",
                        padding: "6px 12px",
                        borderRadius: 8,
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
                background: COLORS.orange,
                color: "#0B0B0B",
                border: "none",
                borderRadius: 12,
                padding: "14px 20px",
                fontWeight: 900,
                cursor: isUploading ? "not-allowed" : "pointer",
                opacity: isUploading ? 0.6 : 1,
                transition: "all 0.2s",
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
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            color: COLORS.muted,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎬</div>
          <p>Nenhum vídeo enviado ainda</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Envie seu primeiro vídeo clicando em "+ Novo Vídeo"</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {videos.map((video) => (
            <div
              key={video.id}
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 12,
                padding: 16,
                display: "grid",
                gridTemplateColumns: "120px 1fr auto",
                gap: 16,
                alignItems: "start",
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  background: "#101010",
                  borderRadius: 8,
                  minWidth: 120,
                  height: 90,
                  backgroundImage: `url('${video.thumbnail_url}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: COLORS.muted,
              }}
              >
                ▶️
              </div>

              {/* Video Info */}
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 4 }}>{video.title}</div>
                <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 10, lineHeight: 1.4 }}>
                  {video.description || "Sem descrição"}
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {video.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "rgba(255,106,0,.12)",
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.orange,
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "right" }}>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {formatDuration(video.duration_seconds)}
                </div>
                <button
                  onClick={() => playVideo(video)}
                  style={{
                    background: COLORS.orange,
                    color: "#0B0B0B",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  ▶️ Assistir
                </button>
                <button
                  style={{
                    background: COLORS.border,
                    color: COLORS.text,
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = COLORS.border;
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteVideo(video.id as number)}
                  style={{
                    background: "rgba(255,0,0,.15)",
                    color: "#FF6B6B",
                    border: "none",
                    borderRadius: 8,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,0,0,.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,0,0,.15)";
                  }}
                >
                  Deletar
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
              borderRadius: 16,
              padding: 24,
              maxWidth: 900,
              width: "100%",
              maxHeight: "90vh",
              overflow: "auto",
              border: `1px solid ${COLORS.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>{selectedVideoToPlay.title}</h2>
              <button
                onClick={() => setSelectedVideoToPlay(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: COLORS.text,
                  fontSize: 28,
                  cursor: "pointer",
                  fontWeight: 900,
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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
                    borderRadius: 12,
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
                  <div style={{ fontSize: 48 }}>❌</div>
                  <div>Vídeo não encontrado</div>
                  <div style={{ fontSize: 12 }}>O arquivo pode ter sido removido ou não estar acessível</div>
                </div>
              )}
            </div>

            {/* Video Info */}
            <div style={{ display: "grid", gap: 12 }}>
              {selectedVideoToPlay.description && (
                <div>
                  <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, marginBottom: 6 }}>DESCRIÇÃO</div>
                  <p style={{ margin: 0, color: COLORS.muted }}>{selectedVideoToPlay.description}</p>
                </div>
              )}

              {/* Tags */}
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700, marginBottom: 6 }}>TAGS</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {selectedVideoToPlay.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "rgba(255,106,0,.12)",
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.orange,
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div style={{ display: "flex", gap: 16, fontSize: 12, color: COLORS.muted }}>
                <span>📅 {new Date(selectedVideoToPlay.created_at).toLocaleDateString("pt-BR")}</span>
                <span>⏱️ {formatDuration(selectedVideoToPlay.duration_seconds)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

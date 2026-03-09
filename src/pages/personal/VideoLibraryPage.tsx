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
  const [videos, setVideos] = useState<Video[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    videoUrl: "",
  });

  function handleTagToggle(tagSlug: string) {
    setSelectedTags((prev) =>
      prev.includes(tagSlug) ? prev.filter((t) => t !== tagSlug) : [...prev, tagSlug]
    );
  }

  async function handleSubmitVideo(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.title || !formData.videoUrl || selectedTags.length === 0) {
      alert("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    // Validate URL format
    try {
      new URL(formData.videoUrl);
    } catch {
      alert("Por favor, insira uma URL válida (começando com http:// ou https://)");
      return;
    }

    setIsUploading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "/api";
      const token = localStorage.getItem("token");

      const response = await fetch(`${apiUrl}/videos/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          url: formData.videoUrl,
          tags: selectedTags,
        }),
      });

      // If 404 or fetch fails, use mock mode for testing
      if (!response.ok && response.status === 404) {
        console.warn("Backend API não está rodando. Usando modo de teste...");
        
        // Mock successful upload
        const mockVideo: Video = {
          id: Math.random(),
          title: formData.title,
          description: formData.description,
          url: formData.videoUrl,
          thumbnail_url: `https://img.youtube.com/vi/${Math.random().toString(36).substring(7)}/default.jpg`,
          duration_seconds: 600,
          tags: selectedTags,
          created_at: new Date().toISOString(),
        };

        // Add new video to list
        setVideos((prev) => [mockVideo, ...prev]);

        // Reset form
        setFormData({ title: "", description: "", videoUrl: "" });
        setSelectedTags([]);
        setShowUploadForm(false);

        alert("✓ Vídeo adicionado em modo de teste!\n\nNota: Para persistir os dados, inicie o backend:\nnpm run dev (na pasta minutofit-backend)");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Add new video to list
      setVideos((prev) => [result.data, ...prev]);

      // Reset form
      setFormData({ title: "", description: "", videoUrl: "" });
      setSelectedTags([]);
      setShowUploadForm(false);

      alert("✓ Vídeo enviado com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      alert(
        `Erro ao enviar vídeo: ${errorMessage}\n\nDicas:\n` +
        `1. Confira se a URL é válida (comece com https://)\n` +
        `2. Para Google Drive: use link compartilhado terminado em /view\n` +
        `3. Backend não está rodando? Veja BACKEND_SETUP.md`
      );
    } finally {
      setIsUploading(false);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
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
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>URL do Vídeo *</label>
              <input
                type="url"
                value={formData.videoUrl}
                onChange={(e) => setFormData((prev) => ({ ...prev, videoUrl: e.target.value }))}
                placeholder="https://exemplo.com/video.mp4"
                style={{
                  background: "#101010",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 12, color: COLORS.muted, background: "rgba(255,106,0,.08)", padding: "12px 12px", borderRadius: 8, border: `1px solid rgba(255,106,0,.20)` }}>
                <strong>💡 Google Drive:</strong> Use a URL compartilhada terminada em <code style={{ background: "#101010", padding: "2px 6px", borderRadius: 4 }}>/view</code> e substitua <code style={{ background: "#101010", padding: "2px 6px", borderRadius: 4 }}>/view</code> por <code style={{ background: "#101010", padding: "2px 6px", borderRadius: 4 }}>/preview</code>
                <br />
                <strong>Exemplo:</strong> <code style={{ background: "#101010", padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>https://drive.google.com/file/d/SEU_ID/preview</code>
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

      {/* Info Box */}
      <div
        style={{
          background: "rgba(255,106,0,.08)",
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>💡 INFORMAÇÕES</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, lineHeight: 1.6 }}>
          • Os vídeos que você enviar aparecerão automaticamente nas recomendações de treino personizado dos seus alunos
          <br />
          • Use tags apropriadas para que seus vídeos sejam recomendados corretamente
          <br />
          • Formatos suportados: MP4, WebM, MOV, AVI (máximo 500MB)
        </div>
      </div>
    </div>
  );
}

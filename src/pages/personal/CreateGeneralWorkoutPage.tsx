import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * ✅ STORAGE KEYS (fase MVP localStorage)
 * - draft: rascunho em edição
 * - catalog: catálogo oficial de treinos gerais
 */
const LS_DRAFT = "generalWorkoutDraft_v1";
const LS_CATALOG = "generalWorkoutsCatalog_v1";

/**
 * ✅ Tipos
 * - VideoItem: YouTube ou upload local (preview)
 * - GeneralWorkout: treino geral salvo no catálogo
 */
type VideoItem =
  | { id: string; kind: "youtube"; title?: string; url: string }
  | { id: string; kind: "upload"; title?: string; fileName: string; mimeType: string; objectUrl: string };

type WorkoutGoal = "emagrecimento" | "hipertrofia" | "mobilidade" | "condicionamento";
type WorkoutLevel = "iniciante" | "intermediario" | "avancado";
type Equipment = "sem_peso" | "com_peso";
type WorkoutVisibility = "publico" | "restrito";

type GeneralWorkout = {
  id: string;
  title: string;
  description: string;

  // ✅ metadados pra filtros/UX (igual nossa LibraryPage)
  goal: WorkoutGoal;
  level: WorkoutLevel;
  minutes: 10 | 15 | 20 | 30;
  equipment: Equipment;
  visibility: WorkoutVisibility;

  videos: VideoItem[];

  createdAtISO: string;
  updatedAtISO: string;

  // ✅ “storytelling” / indicadores
  assignedCount: number;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** ✅ Base visual (mesmo padrão das telas) */
function card(): React.CSSProperties {
  return {
    background: "#171717",
    border: "1px solid rgba(255,255,255,.10)",
    borderRadius: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05)",
  };
}

function btnBase(): React.CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "#1F2937",
    fontWeight: 700,
    cursor: "pointer",
  };
}

function btnPrimary(): React.CSSProperties {
  return {
    ...btnBase(),
    background: "#FF6A00",
    border: "1px solid rgba(255,106,0,.35)",
    color: "#0F0F0F",
    boxShadow: "0 10px 24px rgba(0,0,0,.35)",
  };
}

function inputStyle(): React.CSSProperties {
  return {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#0F0F0F",
    color: "#1F2937",
    fontWeight: 600,
    outline: "none",
  };
}

function hint(): React.CSSProperties {
  return { color: "#6B7280", fontSize: 13, lineHeight: 1.35 };
}

function loadDraft(): { title: string; description: string; videos: VideoItem[] } | null {
  try {
    const raw = localStorage.getItem(LS_DRAFT);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDraft(data: { title: string; description: string; videos: VideoItem[] }) {
  localStorage.setItem(LS_DRAFT, JSON.stringify(data));
}

/** ✅ catálogo */
function loadCatalog(): GeneralWorkout[] {
  try {
    const raw = localStorage.getItem(LS_CATALOG);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCatalog(items: GeneralWorkout[]) {
  localStorage.setItem(LS_CATALOG, JSON.stringify(items));
}

export default function CreateGeneralWorkoutPage() {
  const navigate = useNavigate();
  const draft = useMemo(() => loadDraft(), []);

  // ✅ campos base
  const [title, setTitle] = useState(draft?.title ?? "");
  const [description, setDescription] = useState(draft?.description ?? "");
  const [videos, setVideos] = useState<VideoItem[]>(draft?.videos ?? []);

  // ✅ metadados do treino (pra catalogar / filtrar / distribuir melhor)
  const [goal, setGoal] = useState<WorkoutGoal>("condicionamento");
  const [level, setLevel] = useState<WorkoutLevel>("iniciante");
  const [minutes, setMinutes] = useState<10 | 15 | 20 | 30>(20);
  const [equipment, setEquipment] = useState<Equipment>("sem_peso");
  const [visibility, setVisibility] = useState<WorkoutVisibility>("publico");

  // YouTube
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");

  // Upload local
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  /** ✅ persist rascunho */
  function persist(nextVideos = videos, nextTitle = title, nextDesc = description) {
    saveDraft({ title: nextTitle, description: nextDesc, videos: nextVideos });
  }

  /** ✅ Adiciona YouTube */
  function addYoutube() {
    const url = youtubeUrl.trim();
    if (!url) return;

    const item: VideoItem = { id: uid(), kind: "youtube", url, title: youtubeTitle.trim() || undefined };
    const next = [...videos, item];
    setVideos(next);
    setYoutubeUrl("");
    setYoutubeTitle("");
    persist(next);
  }

  /** ✅ Upload local (preview) */
  function addUpload() {
    if (!uploadFile) {
      alert("Selecione um arquivo de vídeo.");
      return;
    }
    if (!uploadFile.type.startsWith("video/")) {
      alert("O arquivo precisa ser um vídeo (ex: mp4, mov).");
      return;
    }

    const objectUrl = URL.createObjectURL(uploadFile);

    const item: VideoItem = {
      id: uid(),
      kind: "upload",
      title: uploadTitle.trim() || uploadFile.name,
      fileName: uploadFile.name,
      mimeType: uploadFile.type,
      objectUrl,
    };

    const next = [...videos, item];
    setVideos(next);
    setUploadFile(null);
    setUploadTitle("");
    persist(next);
  }

  function removeVideo(id: string) {
    const target = videos.find((v) => v.id === id);
    if (target?.kind === "upload") URL.revokeObjectURL(target.objectUrl);

    const next = videos.filter((v) => v.id !== id);
    setVideos(next);
    persist(next);
  }

  function move(id: string, dir: -1 | 1) {
    const idx = videos.findIndex((v) => v.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= videos.length) return;

    const next = [...videos];
    const tmp = next[idx];
    next[idx] = next[nextIdx];
    next[nextIdx] = tmp;
    setVideos(next);
    persist(next);
  }

  /** ✅ Salvar só rascunho */
  function handleSaveDraft() {
    if (!title.trim()) {
      alert("Digite um título para o treino geral.");
      return;
    }
    persist(videos, title, description);
    alert("Rascunho salvo (local).");
  }

  /**
   * ✅ PUBLICAR NO CATÁLOGO (agora sim!)
   * - valida campos
   * - cria um GeneralWorkout completo
   * - salva no localStorage do catálogo
   */
  function handlePublishToCatalog() {
    if (!title.trim()) {
      alert("Digite um título para publicar.");
      return;
    }
    if (videos.length === 0) {
      alert("Adicione pelo menos 1 vídeo.");
      return;
    }

    const now = new Date().toISOString();
    const newWorkout: GeneralWorkout = {
      id: `gw-${uid()}`,
      title: title.trim(),
      description: description.trim(),

      goal,
      level,
      minutes,
      equipment,
      visibility,

      videos,

      createdAtISO: now,
      updatedAtISO: now,
      assignedCount: 0,
    };

    const catalog = loadCatalog();
    const next = [newWorkout, ...catalog];
    saveCatalog(next);

    // ✅ também mantém rascunho salvo
    persist(videos, title, description);

    alert("Treino publicado no catálogo ✅");
    navigate("/app/personal/library"); // volta pra library
  }

  return (
    <div style={{ display: "grid", gap: 14, color: "#1F2937" }}>
      {/* ✅ Header */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 20 }}>Criar treino geral</div>
            <div style={hint()}>
              Monte a sequência de vídeos e publique no catálogo. Depois, na Library, você distribui por plano/perfil.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => navigate(-1)} style={btnBase()}>
              Voltar
            </button>
            <button onClick={handleSaveDraft} style={btnBase()} title="Salva o rascunho no navegador">
              Salvar rascunho
            </button>
            <button onClick={handlePublishToCatalog} style={btnPrimary()} title="Publica no catálogo (localStorage)">
              Publicar no catálogo
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Dados do treino */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>1) Informações do treino</div>

        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Título</span>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                persist(videos, e.target.value, description);
              }}
              style={inputStyle()}
              placeholder="Ex: HIIT Iniciante • 15min"
            />
            <div style={hint()}>✅ Dica: inclua objetivo e duração no título.</div>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Descrição</span>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                persist(videos, title, e.target.value);
              }}
              style={{ ...inputStyle(), minHeight: 110, resize: "vertical" }}
              placeholder="Explique o treino, observações, intensidade, descanso..."
            />
          </label>

          {/* ✅ Metadados (filtro / distribuição) */}
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Objetivo</span>
              <select value={goal} onChange={(e) => setGoal(e.target.value as any)} style={inputStyle()}>
                <option value="emagrecimento">Emagrecimento</option>
                <option value="hipertrofia">Hipertrofia</option>
                <option value="mobilidade">Mobilidade</option>
                <option value="condicionamento">Condicionamento</option>
              </select>
              <div style={hint()}>👉 Ajuda o personal a distribuir por meta.</div>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Nível</span>
              <select value={level} onChange={(e) => setLevel(e.target.value as any)} style={inputStyle()}>
                <option value="iniciante">Iniciante</option>
                <option value="intermediario">Intermediário</option>
                <option value="avancado">Avançado</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Duração</span>
              <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value) as any)} style={inputStyle()}>
                <option value={10}>10 min</option>
                <option value={15}>15 min</option>
                <option value={20}>20 min</option>
                <option value={30}>30 min</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Equipamento</span>
              <select value={equipment} onChange={(e) => setEquipment(e.target.value as any)} style={inputStyle()}>
                <option value="sem_peso">Sem peso</option>
                <option value="com_peso">Com peso</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Visibilidade</span>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} style={inputStyle()}>
                <option value="publico">Público (qualquer aluno elegível)</option>
                <option value="restrito">Restrito (controle total do personal)</option>
              </select>
              <div style={hint()}>⚠️ “Restrito” é bom pra testes/segmentos.</div>
            </label>
          </div>
        </div>
      </div>

      {/* ✅ Bloco YouTube */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>2) Adicionar vídeo do YouTube</div>

        <div style={{ display: "grid", gap: 10 }}>
          <input
            value={youtubeTitle}
            onChange={(e) => setYoutubeTitle(e.target.value)}
            style={inputStyle()}
            placeholder="Título (opcional) — Ex: Aquecimento"
          />

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              style={{ ...inputStyle(), flex: 1, minWidth: 280 }}
              placeholder="Cole a URL do vídeo (YouTube)"
            />
            <button onClick={addYoutube} style={btnPrimary()}>
              Adicionar
            </button>
          </div>

          <div style={hint()}>
            ✅ Dica: YouTube é ótimo pra conteúdo público. Na fase server, vamos validar URL e gerar embed seguro.
          </div>
        </div>
      </div>

      {/* ✅ Bloco Upload local */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>3) Anexar vídeo (preview local)</div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Título do vídeo (opcional)</span>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              style={inputStyle()}
              placeholder="Ex: Treino 01 • Aquecimento"
            />
          </label>

          <input
            type="file"
            accept="video/*"
            onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#0F0F0F",
              color: "#1F2937",
            }}
          />

          <button onClick={addUpload} style={btnPrimary()}>
            Adicionar vídeo anexado
          </button>

          <div style={hint()}>
            Nesta fase o vídeo anexado fica só como <b>preview local</b> (não sobe para servidor ainda).
          </div>
        </div>
      </div>

      {/* ✅ Sequência */}
      <div style={{ ...card(), padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>4) Sequência do treino ({videos.length})</div>

        {videos.length === 0 ? (
          <div style={hint()}>Nenhum vídeo adicionado ainda.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {videos.map((v, idx) => (
              <div key={v.id} style={{ ...card(), padding: 14, background: "#141414" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div style={{ fontWeight: 700 }}>
                      #{idx + 1} • {v.kind === "youtube" ? "YouTube" : "Anexado"}
                    </div>

                    <div style={hint()}>
                      {v.kind === "youtube"
                        ? `${v.title ? `${v.title} • ` : ""}${v.url}`
                        : `${v.title ?? v.fileName} (${v.fileName})`}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => move(v.id, -1)} disabled={idx === 0} style={btnBase()}>
                      ↑
                    </button>
                    <button onClick={() => move(v.id, 1)} disabled={idx === videos.length - 1} style={btnBase()}>
                      ↓
                    </button>
                    <button onClick={() => removeVideo(v.id)} style={btnBase()}>
                      Remover
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div style={{ marginTop: 12 }}>
                  {v.kind === "upload" ? (
                    <video
                      src={v.objectUrl}
                      controls
                      style={{ width: "100%", maxHeight: 360, borderRadius: 12, border: "1px solid rgba(255,255,255,.10)" }}
                    />
                  ) : (
                    <div style={hint()}>
                      Preview YouTube: na fase 2 eu embuto o player (iframe) com segurança + whitelist.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Footer actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button onClick={handleSaveDraft} style={btnBase()}>
          Salvar rascunho
        </button>
        <button onClick={handlePublishToCatalog} style={btnPrimary()}>
          Publicar no catálogo
        </button>
      </div>
    </div>
  );
}
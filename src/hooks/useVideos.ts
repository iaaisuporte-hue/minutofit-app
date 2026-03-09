import { useEffect, useState } from "react";

export interface Video {
  id: number;
  title: string;
  description: string;
  url: string;
  thumbnail_url: string;
  duration_seconds: number;
  tags: string[];
  created_at: string;
}

interface UseVideosOptions {
  tags?: string[];
  goal?: "weight_loss" | "muscle_gain" | "maintenance";
  limit?: number;
}

export function useVideos(options: UseVideosOptions = {}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      setError(null);

      try {
        let url = "/api/videos/search?";

        if (options.goal) {
          // Map goal to appropriate tags
          const tagMap: Record<string, string[]> = {
            weight_loss: ["perda-de-peso", "aerobico", "hiit"],
            muscle_gain: ["ganho-de-massa", "forca"],
            maintenance: ["flexibilidade", "cardio", "yoga"],
          };
          const tagsForGoal = tagMap[options.goal];
          url += `tags=${tagsForGoal.join(",")}&`;
        } else if (options.tags && options.tags.length > 0) {
          url += `tags=${options.tags.join(",")}&`;
        }

        if (options.limit) {
          url += `limit=${options.limit}`;
        } else {
          url += "limit=10";
        }

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!response.ok) {
          throw new Error("Erro ao buscar vídeos");
        }

        const data = await response.json();
        setVideos(data.data || []);
      } catch (err) {
        console.error("Error fetching videos:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido");
        // Return mock videos for development
        setVideos(getMockVideos(options));
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [options.goal, options.tags?.join(","), options.limit]);

  return { videos, loading, error };
}

// Mock data for development - remove when backend is ready
function getMockVideos(options: UseVideosOptions): Video[] {
  const allMockVideos: Video[] = [
    {
      id: 1,
      title: "HIIT - Queimador de Calorias (20 min)",
      description: "Treino de alta intensidade para máxima queima de calorias",
      url: "https://www.youtube.com/watch?v=example1",
      thumbnail_url: "https://via.placeholder.com/120x90?text=HIIT",
      duration_seconds: 1200,
      tags: ["perda-de-peso", "aerobico", "hiit", "intermediario"],
      created_at: "2024-03-07T10:00:00Z",
    },
    {
      id: 2,
      title: "Força Iniciante - Peito e Braços",
      description: "Treino completo para iniciantes focado em peito e braços",
      url: "https://www.youtube.com/watch?v=example2",
      thumbnail_url: "https://via.placeholder.com/120x90?text=Força",
      duration_seconds: 900,
      tags: ["ganho-de-massa", "forca", "iniciante", "peito", "bracos"],
      created_at: "2024-03-06T14:30:00Z",
    },
    {
      id: 3,
      title: "Yoga Relaxante (15 min)",
      description: "Sessão de yoga para relaxamento e flexibilidade",
      url: "https://www.youtube.com/watch?v=example3",
      thumbnail_url: "https://via.placeholder.com/120x90?text=Yoga",
      duration_seconds: 900,
      tags: ["flexibilidade", "yoga", "recuperacao"],
      created_at: "2024-03-05T09:00:00Z",
    },
    {
      id: 4,
      title: "Cardio Iniciante - Corrida",
      description: "Treino de cardio leve para iniciantes",
      url: "https://www.youtube.com/watch?v=example4",
      thumbnail_url: "https://via.placeholder.com/120x90?text=Cardio",
      duration_seconds: 1200,
      tags: ["perda-de-peso", "cardio", "aerobico", "iniciante"],
      created_at: "2024-03-04T11:20:00Z",
    },
    {
      id: 5,
      title: "Hipertrofia - Perna Completa",
      description: "Treino avançado para ganho de massa nas pernas",
      url: "https://www.youtube.com/watch?v=example5",
      thumbnail_url: "https://via.placeholder.com/120x90?text=Perna",
      duration_seconds: 1800,
      tags: ["ganho-de-massa", "forca", "avancado", "perna"],
      created_at: "2024-03-03T15:45:00Z",
    },
  ];

  // Filter based on goal or tags
  if (options.goal) {
    const tagMap: Record<string, string[]> = {
      weight_loss: ["perda-de-peso", "aerobico", "hiit"],
      muscle_gain: ["ganho-de-massa", "forca"],
      maintenance: ["flexibilidade", "cardio", "yoga"],
    };
    const targetTags = tagMap[options.goal];
    return allMockVideos
      .filter((v) => v.tags.some((t) => targetTags.includes(t)))
      .slice(0, options.limit || 10);
  }

  if (options.tags && options.tags.length > 0) {
    return allMockVideos
      .filter((v) => v.tags.some((t) => options.tags?.includes(t)))
      .slice(0, options.limit || 10);
  }

  return allMockVideos.slice(0, options.limit || 10);
}

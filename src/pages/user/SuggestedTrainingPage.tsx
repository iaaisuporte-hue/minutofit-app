import { useState } from "react";
import { useVideos, type Video } from "../../hooks/useVideos";

interface UserProfile {
  age: number;
  weight: number;
  height: number;
  bodyFat: number;
  leanMass: number;
  trainingTime: number;
  goal: "weight_loss" | "muscle_gain" | "maintenance" | "";
}

interface TrainingRecommendation {
  title: string;
  description: string;
  frequency: string;
  duration: string;
  exercises: string[];
  tips: string[];
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

function calculateBMI(weight: number, height: number): number {
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
}

function generateRecommendation(profile: UserProfile): TrainingRecommendation {
  if (profile.goal === "weight_loss") {
    if (profile.trainingTime <= 30) {
      return {
        title: "HIIT - Queimador Rápido",
        description: "Treino de alta intensidade com pouco tempo",
        frequency: "4-5x por semana",
        duration: `${profile.trainingTime} minutos`,
        exercises: [
          "Aquecimento (2-3 min)",
          "30s Burpees + 30s descanso",
          "30s Mountain Climbers + 30s descanso",
          "30s Jumping Jacks + 30s descanso",
          "30s Agachamento + 30s descanso",
          "Repetir 3-4x",
        ],
        tips: [
          "Mantenha a intensidade alta",
          "Descanse apenas o necessário",
          "Combine com cardio leve nos outros dias",
          "Foque em alimentação para perda de peso",
        ],
      };
    } else {
      return {
        title: "Cardio + Força Moderada",
        description: "Treino completo para queimar calorias com resistência",
        frequency: "4x por semana",
        duration: `${profile.trainingTime} minutos`,
        exercises: [
          "Aquecimento (5-10 min)",
          "Cardio (esteira/bicicleta) - 20 min",
          "Circuito de força - 3 séries de 12-15 reps",
          "Supino, Agachamento, Rosca Direta",
          "Desaquecimento (5 min)",
        ],
        tips: [
          "Defina um déficit calórico moderado",
          "Não descuide da proteína",
          "Durma bem para recuperação",
          "Seja consistente!",
        ],
      };
    }
  }

  if (profile.goal === "muscle_gain") {
    if (profile.trainingTime <= 45) {
      return {
        title: "Força Rápida - 3 Exercícios",
        description: "Treino essencial para ganho de massa muscular",
        frequency: "4x por semana",
        duration: `${profile.trainingTime} minutos`,
        exercises: [
          "Aquecimento (5 min)",
          "Exercício Principal (Agachamento ou Supino) - 4x5",
          "Exercício Secundário (Rosca ou Puxada) - 3x8",
          "Exercício Acessório - 3x10",
        ],
        tips: [
          "Levante peso pesado com boa forma",
          "Come 300-500 kcal acima da manutenção",
          "1.6-2.2g de proteína por kg de peso",
          "Descanse 2-3 dias entre treinos do mesmo grupo",
        ],
      };
    } else {
      return {
        title: "Hipertrofia Completa",
        description: "Treino de volume para máximo crescimento muscular",
        frequency: "4-5x por semana",
        duration: `${profile.trainingTime} minutos`,
        exercises: [
          "Aquecimento (5-10 min)",
          "2-3 Exercícios principais com 3-4 séries de 6-8 reps",
          "2-3 Exercícios secundários com 3 séries de 8-12 reps",
          "1-2 Exercícios acessórios com 3 séries de 12-15 reps",
          "Alongamento (5-10 min)",
        ],
        tips: [
          "Treino A/B ou Push/Pull/Legs",
          "Aumente o volume a cada 2-3 semanas",
          "Durma 7-9 horas por noite",
          "Monitore seu peso: +0.5kg por semana",
        ],
      };
    }
  }

  return {
    title: "Treino de Manutenção",
    description: "Treino para manter forma e saúde",
    frequency: "3-4x por semana",
    duration: `${profile.trainingTime} minutos`,
    exercises: [
      "Aquecimento (5 min)",
      "Força: 2-3 exercícios com 3 séries de 8-12 reps",
      "Cardio: 10-15 minutos de intensidade moderada",
      "Alongamento (5-10 min)",
    ],
    tips: [
      "Mantenha a consistência",
      "Varie seus exercícios a cada 4-6 semanas",
      "Alimentação balanceada",
      "Aproveite o exercício!",
    ],
  };
}

function VideoCard({ video }: { video: Video }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        gap: 12,
        padding: 12,
        background: "rgba(255,106,0,.08)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 12,
        textDecoration: "none",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,106,0,.15)";
        e.currentTarget.style.borderColor = "rgba(255,106,0,.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,106,0,.08)";
        e.currentTarget.style.borderColor = COLORS.border;
      }}
    >
      <div style={{ fontSize: 32, minWidth: 40, display: "flex", alignItems: "center" }}>▶️</div>
      <div>
        <div style={{ fontWeight: 900, color: COLORS.text }}>{video.title}</div>
        <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4 }}>{video.description}</div>
        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {video.tags.map((tag) => (
            <span key={tag} style={{ background: "rgba(255,106,0,.2)", padding: "2px 6px", borderRadius: 4 }}>
              #{tag}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
}

export default function SuggestedTrainingPage() {
  const [profile, setProfile] = useState<UserProfile>({
    age: 30,
    weight: 75,
    height: 175,
    bodyFat: 0,
    leanMass: 0,
    trainingTime: 45,
    goal: "",
  });

  const [recommendation, setRecommendation] = useState<TrainingRecommendation | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Fetch videos based on the recommended goal
  const { videos, loading: videosLoading } = useVideos({
    goal: recommendation?.title ? (profile.goal as "weight_loss" | "muscle_gain" | "maintenance") : undefined,
    limit: 5,
  });

  function handleInputChange(field: keyof UserProfile, value: number | string) {
    setProfile((prev) => ({
      ...prev,
      [field]: field === "goal" ? value : Number(value),
    }));
  }

  function handleGenerate() {
    if (!profile.goal || profile.age <= 0 || profile.weight <= 0 || profile.height <= 0 || profile.trainingTime <= 0) {
      alert("Por favor, preencha todos os campos com valores válidos");
      return;
    }
    const rec = generateRecommendation(profile);
    setRecommendation(rec);
    setShowResults(true);
  }

  const bmi = calculateBMI(profile.weight, profile.height);
  const bmiCategory =
    bmi < 18.5
      ? "Abaixo do peso"
      : bmi < 25
        ? "Peso normal"
        : bmi < 30
          ? "Sobrepeso"
          : "Obesidade";

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8 }}>Treino Sugerido</h1>
        <p style={{ color: COLORS.muted }}>Responda algumas questões e receba uma recomendação personalizada</p>
      </div>

      {!showResults ? (
        <div style={{ display: "grid", gap: 16 }}>
          {/* Formulário */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Idade */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Idade (anos)</label>
              <input
                type="number"
                value={profile.age}
                onChange={(e) => handleInputChange("age", e.target.value)}
                min="1"
                max="120"
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

            {/* Peso */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Peso (kg)</label>
              <input
                type="number"
                value={profile.weight}
                onChange={(e) => handleInputChange("weight", e.target.value)}
                min="1"
                step="0.5"
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

            {/* Altura */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Altura (cm)</label>
              <input
                type="number"
                value={profile.height}
                onChange={(e) => handleInputChange("height", e.target.value)}
                min="50"
                max="250"
                step="0.5"
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

            {/* Gordura Corporal */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Gordura Corporal (%)</label>
              <input
                type="number"
                value={profile.bodyFat}
                onChange={(e) => handleInputChange("bodyFat", e.target.value)}
                min="0"
                max="100"
                step="0.5"
                placeholder="Opcional"
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

            {/* Massa Magra */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Massa Magra (kg)</label>
              <input
                type="number"
                value={profile.leanMass}
                onChange={(e) => handleInputChange("leanMass", e.target.value)}
                min="0"
                step="0.5"
                placeholder="Opcional"
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

            {/* Tempo disponível */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Tempo disponível (minutos)</label>
              <input
                type="number"
                value={profile.trainingTime}
                onChange={(e) => handleInputChange("trainingTime", e.target.value)}
                min="15"
                max="180"
                step="5"
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

            {/* Objetivo */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ color: COLORS.muted, fontSize: 13, fontWeight: 700 }}>Seu Objetivo</label>
              <select
                value={profile.goal}
                onChange={(e) => handleInputChange("goal", e.target.value)}
                style={{
                  background: "#101010",
                  color: COLORS.text,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: "12px 12px",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="">Selecione um objetivo</option>
                <option value="weight_loss">Perder Peso</option>
                <option value="muscle_gain">Ganhar Massa Muscular</option>
                <option value="maintenance">Manutenção</option>
              </select>
            </div>
          </div>

          {/* Informações do IMC */}
          <div
            style={{
              background: COLORS.orangeSoft,
              border: `1px solid ${COLORS.orange}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>IMC Calculado</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{bmi.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>Categoria</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{bmiCategory}</div>
              </div>
            </div>
          </div>

          {/* Botão */}
          <button
            onClick={handleGenerate}
            style={{
              background: COLORS.orange,
              color: "#0B0B0B",
              border: "none",
              borderRadius: 12,
              padding: "16px 20px",
              fontWeight: 900,
              cursor: "pointer",
              fontSize: 16,
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Gerar Recomendação
          </button>
        </div>
      ) : recommendation ? (
        <div style={{ display: "grid", gap: 20 }}>
          {/* Resultado */}
          <div
            style={{
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 24,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>{recommendation.title}</h2>
                <p style={{ color: COLORS.muted }}>{recommendation.description}</p>
              </div>
              <button
                onClick={() => setShowResults(false)}
                style={{
                  background: COLORS.border,
                  border: "none",
                  color: COLORS.text,
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 900,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div
                style={{
                  background: "rgba(255,106,0,.08)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>Frequência</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{recommendation.frequency}</div>
              </div>
              <div
                style={{
                  background: "rgba(255,106,0,.08)",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 700 }}>Duração</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{recommendation.duration}</div>
              </div>
            </div>

            {/* Exercícios */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: COLORS.orange }}>EXERCÍCIOS</h3>
              <div style={{ display: "grid", gap: 8, paddingLeft: 0 }}>
                {recommendation.exercises.map((exercise, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div
                      style={{
                        minWidth: 24,
                        height: 24,
                        background: COLORS.orange,
                        color: "#0B0B0B",
                        borderRadius: 50,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: 12,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ paddingTop: 2 }}>{exercise}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dicas */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: COLORS.orange }}>DICAS IMPORTANTES</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {recommendation.tips.map((tip, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ color: COLORS.orange, fontWeight: 900 }}>✓</div>
                    <div>{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vídeos Recomendados */}
          {!videosLoading && videos.length > 0 && (
            <div
              style={{
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 24,
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                🎬 Vídeos Recomendados
              </h3>
              <div style={{ display: "grid", gap: 12 }}>
                {videos.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </div>
          )}

          {/* Botão Voltar */}
          <button
            onClick={() => setShowResults(false)}
            style={{
              background: COLORS.border,
              color: COLORS.text,
              border: "none",
              borderRadius: 12,
              padding: "12px 20px",
              fontWeight: 900,
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
            Voltar e Ajustar
          </button>
        </div>
      ) : null}
    </div>
  );
}

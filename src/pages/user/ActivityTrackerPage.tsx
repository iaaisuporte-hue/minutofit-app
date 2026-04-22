import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./activityTracker.tailwind.css";
import { registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: "walk" | "run" | "cycling";
  startTime: Date;
  endTime?: Date;
  distance: number;
  pace: number;
  duration: number;
  routeCoordinates: Array<{ lat: number; lng: number }>;
}

// ─────────────────────────────────────────────────────────────
// Leaflet icon fix
// ─────────────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────
// Activity metadata
// ─────────────────────────────────────────────────────────────

const ACTIVITY_META = {
  walk: {
    icon: "🚶",
    label: "Caminhada",
    helper: "Baixo impacto • ideal para recuperação",
    primaryMetric: "duration" as const,
    primaryLabel: "Duração",
  },
  run: {
    icon: "🏃",
    label: "Corrida",
    helper: "Alta intensidade • melhora cardiovascular",
    primaryMetric: "pace" as const,
    primaryLabel: "Ritmo",
  },
  cycling: {
    icon: "🚴",
    label: "Ciclismo",
    helper: "Baixo impacto articular • ganhe volume cardio",
    primaryMetric: "distance" as const,
    primaryLabel: "Distância",
  },
} satisfies Record<
  Activity["type"],
  { icon: string; label: string; helper: string; primaryMetric: "duration" | "pace" | "distance"; primaryLabel: string }
>;

// ─────────────────────────────────────────────────────────────
// Pure utility functions (unchanged)
// ─────────────────────────────────────────────────────────────

function getDistanceBetweenPointsKm(
  first: { lat: number; lng: number },
  second: { lat: number; lng: number }
) {
  const earthRadiusKm = 6371;
  const deltaLat = ((second.lat - first.lat) * Math.PI) / 180;
  const deltaLng = ((second.lng - first.lng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos((first.lat * Math.PI) / 180) *
      Math.cos((second.lat * Math.PI) / 180) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function calculateRouteDistanceKm(coordinates: Array<{ lat: number; lng: number }>) {
  if (coordinates.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    total += getDistanceBetweenPointsKm(coordinates[index - 1], coordinates[index]);
  }
  return total;
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatPace(pace: number) {
  if (!pace || Number.isNaN(pace) || !Number.isFinite(pace)) return "--";
  return pace.toFixed(2);
}

function calculatePace(durationSeconds: number, distanceKm: number) {
  if (!distanceKm) return 0;
  return parseFloat((((durationSeconds / 60) || 0) / distanceKm).toFixed(2));
}

function parseStoredActivities(raw: string | null) {
  if (!raw) return [] as Activity[];
  try {
    const parsed = JSON.parse(raw) as Activity[];
    return parsed.map((activity) => ({
      ...activity,
      startTime: new Date(activity.startTime),
      endTime: activity.endTime ? new Date(activity.endTime) : undefined,
      routeCoordinates: activity.routeCoordinates || [],
    }));
  } catch (error) {
    console.error("Failed to parse stored activities:", error);
    return [] as Activity[];
  }
}

// ─────────────────────────────────────────────────────────────
// Metabolic intelligence helpers (UI-only heuristics)
// ─────────────────────────────────────────────────────────────

interface MetabolicStatus {
  energy: number;
  recovery: number;
  readiness: number;
  score: number;
  interpretation: string;
  readinessLabel: string;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function deriveMetabolicStatus(activities: Activity[]): MetabolicStatus {
  const hour = new Date().getHours();

  // Energy: peaks mid-morning and late afternoon
  const hourScore =
    hour >= 6 && hour <= 10 ? 80 :
    hour >= 14 && hour <= 18 ? 75 :
    hour >= 11 && hour <= 13 ? 65 :
    hour >= 19 && hour <= 21 ? 55 : 40;

  // Recovery: based on time since last activity
  const lastActivity = activities[0];
  let recoveryScore = 70;
  if (lastActivity) {
    const hoursSinceLast = (Date.now() - new Date(lastActivity.startTime).getTime()) / 3_600_000;
    if (hoursSinceLast < 12) recoveryScore = 45;
    else if (hoursSinceLast < 24) recoveryScore = 62;
    else if (hoursSinceLast < 48) recoveryScore = 75;
    else if (hoursSinceLast < 72) recoveryScore = 88;
    else recoveryScore = 92;
  }

  // Readiness: weighted combo + recent session count context
  const last7DaysActivities = activities.filter(
    (a) => Date.now() - new Date(a.startTime).getTime() < 7 * 86_400_000
  ).length;
  const volumeBoost = clamp(last7DaysActivities * 4, 0, 20);
  const readinessScore = clamp(Math.round((hourScore * 0.4 + recoveryScore * 0.4) + volumeBoost), 0, 100);

  const energy = clamp(hourScore + Math.round((Math.random() - 0.5) * 6), 0, 100);
  const recovery = clamp(recoveryScore + Math.round((Math.random() - 0.5) * 4), 0, 100);
  const readiness = readinessScore;
  const score = clamp(Math.round(energy * 0.35 + recovery * 0.35 + readiness * 0.30), 0, 100);

  let interpretation: string;
  let readinessLabel: string;

  if (score >= 80) {
    interpretation = "Você está em ótimas condições para um treino intenso.";
    readinessLabel = "Ótimo";
  } else if (score >= 65) {
    interpretation = "Condições favoráveis para um treino moderado a intenso.";
    readinessLabel = "Bom";
  } else if (score >= 50) {
    interpretation = "Você está em boas condições para um treino moderado.";
    readinessLabel = "Moderado";
  } else if (score >= 35) {
    interpretation = "Sinais de fadiga leve detectados. Considere ritmo leve hoje.";
    readinessLabel = "Leve";
  } else {
    interpretation = "Seu corpo pede recuperação. Caminhada leve ou descanso ativo.";
    readinessLabel = "Recuperação";
  }

  return { energy, recovery, readiness, score, interpretation, readinessLabel };
}

// ─────────────────────────────────────────────────────────────
// Session intelligence helpers
// ─────────────────────────────────────────────────────────────

function deriveSessionPerformance(activity: Activity): {
  score: number;
  tag: string;
  tagColor: string;
  insight: string;
} {
  const mins = activity.duration / 60;
  const distOk = activity.distance >= 1;

  let score = 50;
  if (mins >= 30) score += 20;
  else if (mins >= 15) score += 10;
  if (distOk && activity.pace > 0 && activity.pace < 7) score += 15;
  if (activity.type === "run" && activity.pace > 0 && activity.pace < 6) score += 10;
  score = clamp(score, 20, 100);

  let tag: string;
  let tagColor: string;
  if (score >= 80) {
    tag = "Alta intensidade";
    tagColor = "tw-bg-red-50 tw-text-red-600 tw-border tw-border-red-100";
  } else if (score >= 60) {
    tag = "Bom treino";
    tagColor = "tw-bg-green-50 tw-text-green-700 tw-border tw-border-green-100";
  } else if (mins < 15) {
    tag = "Curto";
    tagColor = "tw-bg-gray-100 tw-text-gray-500 tw-border tw-border-gray-200";
  } else {
    tag = "Leve";
    tagColor = "tw-bg-blue-50 tw-text-blue-600 tw-border tw-border-blue-100";
  }

  let insight = "";
  if (activity.type === "run") {
    if (activity.pace > 0 && activity.pace < 5.5) insight = "Ritmo sólido, bom condicionamento.";
    else if (activity.pace > 8) insight = "Ritmo conservador. Tente aumentar gradualmente.";
    else if (mins >= 30) insight = "Consistência boa. Continue assim.";
  } else if (activity.type === "walk") {
    if (mins >= 30) insight = "Ótima duração para ativação metabólica.";
    else insight = "Boa caminhada de recuperação ativa.";
  } else if (activity.type === "cycling") {
    if (activity.distance >= 5) insight = "Distância expressiva. Bom volume cardio.";
    else insight = "Sessão de aquecimento e mobilidade.";
  }

  return { score, tag, tagColor, insight };
}

// ─────────────────────────────────────────────────────────────
// Score bar color
// ─────────────────────────────────────────────────────────────

function scoreBarColor(value: number): string {
  if (value >= 65) return "tw-score-high";
  if (value >= 40) return "tw-score-mid";
  return "tw-score-low";
}

function scoreTextColor(value: number): string {
  if (value >= 65) return "tw-text-green-600";
  if (value >= 40) return "tw-text-amber-500";
  return "tw-text-red-500";
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="tw-flex tw-flex-col tw-gap-1.5">
      <div className="tw-flex tw-justify-between tw-items-center">
        <span className="tw-text-xs tw-font-medium tw-text-gray-500 tw-uppercase tw-tracking-wide">
          {label}
        </span>
        <span className={`tw-text-sm tw-font-bold ${scoreTextColor(value)}`}>{value}</span>
      </div>
      <div className="tw-h-1.5 tw-rounded-full tw-bg-gray-100 tw-overflow-hidden">
        <div
          className={`tw-h-full tw-rounded-full tw-transition-all tw-duration-700 ${scoreBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MetabolicStatusCard({ activities }: { activities: Activity[] }) {
  const status = useMemo(() => deriveMetabolicStatus(activities), [activities]);

  return (
    <div className="tw-rounded-3xl tw-bg-white tw-border tw-border-gray-100 tw-shadow-card tw-p-6 tw-flex tw-flex-col tw-gap-5">
      {/* Header */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-flex-wrap">
        <div className="tw-flex tw-flex-col tw-gap-1">
          <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-widest tw-text-accent">
            ⚡ Sistema metabólico
          </span>
          <h2 className="tw-text-xl tw-font-bold tw-text-gray-900">Seu status hoje</h2>
          <p className="tw-text-sm tw-text-gray-500 tw-leading-relaxed">{status.interpretation}</p>
        </div>

        {/* Combined score */}
        <div className="tw-flex tw-flex-col tw-items-center tw-gap-1 tw-min-w-[80px]">
          <div
            className="tw-w-16 tw-h-16 tw-rounded-full tw-flex tw-items-center tw-justify-center tw-text-xl tw-font-bold tw-text-white tw-shadow-md"
            style={{
              background:
                status.score >= 65
                  ? "linear-gradient(135deg, #22C55E, #16A34A)"
                  : status.score >= 40
                  ? "linear-gradient(135deg, #F59E0B, #D97706)"
                  : "linear-gradient(135deg, #EF4444, #DC2626)",
            }}
          >
            {status.score}
          </div>
          <span className="tw-text-xs tw-font-semibold tw-text-gray-400">Metabolismo</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="tw-grid tw-gap-3 sm:tw-grid-cols-3">
        <ScoreBar label="Energia" value={status.energy} />
        <ScoreBar label="Recuperação" value={status.recovery} />
        <ScoreBar label="Prontidão" value={status.readiness} />
      </div>

      {/* Readiness badge */}
      <div className="tw-flex tw-items-center tw-gap-2">
        <span
          className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold"
          style={{
            background: "var(--color-accent-soft)",
            color: "var(--color-accent)",
            border: "1px solid var(--color-accent-border)",
          }}
        >
          Treino recomendado: {status.readinessLabel}
        </span>
        <span className="tw-text-xs tw-text-gray-400">baseado no seu histórico recente</span>
      </div>
    </div>
  );
}

function MapViewer({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  if (coordinates.length === 0) {
    return (
      <div className="tw-rounded-2xl tw-border tw-border-dashed tw-border-gray-200 tw-bg-gray-50 tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-2 tw-py-10 tw-text-center">
        <span className="tw-text-3xl">📍</span>
        <p className="tw-text-sm tw-font-semibold tw-text-gray-700">Aguardando os primeiros pontos do GPS</p>
        <p className="tw-text-xs tw-text-gray-400">
          A rota aparece aqui em tempo real assim que a localização chegar.
        </p>
      </div>
    );
  }

  const center: [number, number] = [
    coordinates[coordinates.length - 1].lat,
    coordinates[coordinates.length - 1].lng,
  ];
  const startPoint: [number, number] = [coordinates[0].lat, coordinates[0].lng];

  return (
    <div className="tw-rounded-2xl tw-overflow-hidden tw-border tw-border-gray-100">
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: 300 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={coordinates.map((c) => [c.lat, c.lng])}
          pathOptions={{ color: "#22C55E", weight: 5, opacity: 0.92 }}
        />
        <Marker position={startPoint}><Popup>🏁 Início</Popup></Marker>
        <Marker position={center}><Popup>📍 Posição atual</Popup></Marker>
      </MapContainer>
    </div>
  );
}

function CollapsibleMap({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  const [open, setOpen] = useState(false);
  if (coordinates.length === 0) return null;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-font-semibold tw-text-gray-400 tw-uppercase tw-tracking-wide tw-mb-2 tw-cursor-pointer hover:tw-text-gray-600 tw-transition-colors tw-duration-150"
      >
        <span>{open ? "▲" : "▼"}</span>
        {open ? "Ocultar rota" : "Ver rota no mapa"}
      </button>
      {open && <MapViewer coordinates={coordinates} />}
    </div>
  );
}

function LiveStatChip({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`tw-rounded-2xl tw-p-4 tw-flex tw-flex-col tw-gap-1 tw-border ${
        highlight
          ? "tw-bg-green-50 tw-border-green-100"
          : "tw-bg-white tw-border-gray-100"
      }`}
    >
      <span className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wide tw-text-gray-400">
        {label}
      </span>
      <div className="tw-flex tw-items-baseline tw-gap-1">
        <span
          className={`tw-text-3xl tw-font-bold tw-font-mono ${
            highlight ? "tw-text-green-700" : "tw-text-gray-900"
          }`}
        >
          {value}
        </span>
        {unit && (
          <span className="tw-text-sm tw-text-gray-400">{unit}</span>
        )}
      </div>
    </div>
  );
}

function ActivityTypeCard({
  type,
  selected,
  onSelect,
}: {
  type: Activity["type"];
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = ACTIVITY_META[type];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        tw-rounded-2xl tw-p-4 tw-text-left tw-cursor-pointer tw-transition-all tw-duration-150
        tw-flex tw-flex-col tw-gap-2 tw-border
        hover:tw-scale-[1.02] hover:tw-shadow-card
        ${
          selected
            ? "tw-bg-green-50 tw-border-green-200 tw-shadow-card"
            : "tw-bg-white tw-border-gray-100 hover:tw-border-gray-200"
        }
      `}
      style={{ outline: "none" }}
    >
      <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
        <div className="tw-flex tw-items-center tw-gap-2.5">
          <span className="tw-text-2xl">{meta.icon}</span>
          <span className="tw-text-base tw-font-semibold tw-text-gray-900">{meta.label}</span>
        </div>
        {selected && (
          <span
            className="tw-rounded-full tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wide"
            style={{ background: "var(--color-primary-soft)", color: "var(--color-primary)" }}
          >
            Selecionado
          </span>
        )}
      </div>
      <p className="tw-text-xs tw-text-gray-500 tw-leading-relaxed">{meta.helper}</p>
    </button>
  );
}

function PerformanceTimelineCard({
  activity,
  onDelete,
}: {
  activity: Activity;
  onDelete: () => void;
}) {
  const perf = useMemo(() => deriveSessionPerformance(activity), [activity]);
  const meta = ACTIVITY_META[activity.type];

  return (
    <div className="tw-rounded-2xl tw-bg-white tw-border tw-border-gray-100 tw-shadow-card tw-p-5 tw-flex tw-flex-col tw-gap-4">
      {/* Header row */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-flex-wrap">
        <div className="tw-flex tw-items-center tw-gap-3">
          <div className="tw-w-12 tw-h-12 tw-rounded-2xl tw-flex tw-items-center tw-justify-center tw-text-2xl tw-bg-gray-50 tw-border tw-border-gray-100">
            {meta.icon}
          </div>
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
              <span className="tw-font-semibold tw-text-gray-900">{meta.label}</span>
              <span
                className={`tw-rounded-full tw-px-2.5 tw-py-0.5 tw-text-xs tw-font-semibold ${perf.tagColor}`}
              >
                {perf.tag}
              </span>
            </div>
            <span className="tw-text-xs tw-text-gray-400">
              {new Date(activity.startTime).toLocaleDateString("pt-BR", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </div>

        {/* Performance score badge */}
        <div className="tw-flex tw-items-center tw-gap-3">
          <div className="tw-flex tw-flex-col tw-items-center tw-gap-0.5">
            <span
              className={`tw-text-xl tw-font-bold ${scoreTextColor(perf.score)}`}
            >
              {perf.score}
            </span>
            <span className="tw-text-xs tw-text-gray-400 tw-uppercase tw-tracking-wide">score</span>
          </div>
          <button
            type="button"
            onClick={onDelete}
            className="tw-rounded-xl tw-px-3 tw-py-2 tw-text-xs tw-font-semibold tw-cursor-pointer tw-transition-all tw-duration-150 hover:tw-bg-red-50"
            style={{
              background: "rgba(220,38,38,.06)",
              border: "1px solid rgba(220,38,38,.15)",
              color: "#B91C1C",
            }}
          >
            Excluir
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="tw-flex tw-gap-4 tw-flex-wrap tw-text-sm">
        <span className="tw-flex tw-items-center tw-gap-1 tw-text-gray-600">
          <span className="tw-text-gray-400">⏱</span> {formatTime(activity.duration)}
        </span>
        <span className="tw-flex tw-items-center tw-gap-1 tw-text-gray-600">
          <span className="tw-text-gray-400">📍</span> {activity.distance.toFixed(2)} km
        </span>
        <span className="tw-flex tw-items-center tw-gap-1 tw-text-gray-600">
          <span className="tw-text-gray-400">⚡</span> {formatPace(activity.pace)} min/km
        </span>
      </div>

      {/* Insight */}
      {perf.insight ? (
        <p className="tw-text-xs tw-text-gray-500 tw-bg-gray-50 tw-rounded-xl tw-px-3 tw-py-2 tw-border tw-border-gray-100 tw-leading-relaxed">
          💡 {perf.insight}
        </p>
      ) : null}

      {/* Collapsible map */}
      <CollapsibleMap coordinates={activity.routeCoordinates} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function ActivityTrackerPage() {
  // ── State (unchanged) ──────────────────────────────────────
  const [isTracking, setIsTracking] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Partial<Activity> | null>(null);
  const [selectedType, setSelectedType] = useState<Activity["type"]>("run");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geolocationRef = useRef<number | null>(null);

  // ── Effects (unchanged) ───────────────────────────────────
  useEffect(() => {
    setActivities(parseStoredActivities(localStorage.getItem("activities")));
  }, []);

  useEffect(() => {
    if (!isTracking) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsedTime((previous) => previous + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking || !navigator.geolocation) {
      if (geolocationRef.current) {
        navigator.geolocation.clearWatch(geolocationRef.current);
        geolocationRef.current = null;
      }
      return;
    }

    geolocationRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setCurrentActivity((previous) => {
          if (!previous) return previous;
          const previousCoordinates = previous.routeCoordinates || [];
          const lastPoint = previousCoordinates[previousCoordinates.length - 1];
          const nextCoordinates =
            lastPoint && getDistanceBetweenPointsKm(lastPoint, nextPoint) < 0.01
              ? previousCoordinates
              : [...previousCoordinates, nextPoint];
          const distance = parseFloat(calculateRouteDistanceKm(nextCoordinates).toFixed(2));
          const duration = elapsedTime;
          const pace = calculatePace(duration, distance);
          return { ...previous, routeCoordinates: nextCoordinates, distance, pace };
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      if (geolocationRef.current) {
        navigator.geolocation.clearWatch(geolocationRef.current);
        geolocationRef.current = null;
      }
    };
  }, [isTracking, elapsedTime]);

  useEffect(() => {
    setCurrentActivity((previous) => {
      if (!previous) return previous;
      const distance = previous.distance || 0;
      return {
        ...previous,
        duration: elapsedTime,
        pace: calculatePace(elapsedTime, distance),
      };
    });
  }, [elapsedTime]);

  // ── Derived stats (unchanged) ─────────────────────────────
  const stats = useMemo(() => {
    if (activities.length === 0) {
      return { totalDistance: 0, totalTime: 0, avgPace: 0, totalSessions: 0 };
    }
    const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
    const totalTime = activities.reduce((sum, a) => sum + a.duration, 0);
    const avgPace = totalDistance > 0 ? totalTime / 60 / totalDistance : 0;
    return {
      totalDistance,
      totalTime,
      avgPace: parseFloat(avgPace.toFixed(2)),
      totalSessions: activities.length,
    };
  }, [activities]);

  // ── Handlers (unchanged) ──────────────────────────────────
  function startActivity() {
    setRewardMessage(null);
    setCurrentActivity({
      id: Date.now().toString(),
      type: selectedType,
      startTime: new Date(),
      distance: 0,
      pace: 0,
      duration: 0,
      routeCoordinates: [],
    });
    setElapsedTime(0);
    setIsTracking(true);
  }

  async function stopActivity() {
    if (!currentActivity) return;

    const endActivity: Activity = {
      id: currentActivity.id || Date.now().toString(),
      type: currentActivity.type || selectedType,
      startTime: currentActivity.startTime || new Date(),
      endTime: new Date(),
      distance: currentActivity.distance || 0,
      pace: currentActivity.pace || 0,
      duration: elapsedTime,
      routeCoordinates: currentActivity.routeCoordinates || [],
    };

    const updatedActivities = [endActivity, ...activities];
    setActivities(updatedActivities);
    localStorage.setItem("activities", JSON.stringify(updatedActivities));

    setIsTracking(false);
    setCurrentActivity(null);
    setElapsedTime(0);

    const xpEarned = Math.max(10, Math.min(40, Math.round((endActivity.duration / 60) * 2)));
    const checkin = registerDailyCheckin("activity", xpEarned);
    setRewardMessage(
      checkin.alreadyCheckedIn
        ? "Atividade salva. O check-in de hoje já estava garantido."
        : `Atividade salva. +${xpEarned} XP, check-in do dia concluído e sequência atualizada.`
    );

    try {
      await persistGamificationCheckin({
        source: "activity",
        xp: xpEarned,
        activity: {
          type: endActivity.type,
          durationSeconds: endActivity.duration,
          distanceKm: endActivity.distance,
          pace: endActivity.pace,
        },
      });
    } catch (error) {
      console.error("Failed to persist activity gamification:", error);
    }

    if (geolocationRef.current) {
      navigator.geolocation.clearWatch(geolocationRef.current);
      geolocationRef.current = null;
    }
  }

  function deleteActivity(id: string) {
    const updatedActivities = activities.filter((a) => a.id !== id);
    setActivities(updatedActivities);
    localStorage.setItem("activities", JSON.stringify(updatedActivities));
  }

  const selectedMeta = ACTIVITY_META[selectedType];

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="tw-flex tw-flex-col tw-gap-5 tw-max-w-3xl">

      {/* Reward banner */}
      {rewardMessage ? (
        <div
          className="tw-rounded-2xl tw-px-4 tw-py-3 tw-text-sm tw-font-semibold"
          style={{
            background: "rgba(34,197,94,.10)",
            border: "1px solid rgba(34,197,94,.25)",
            color: "var(--color-text)",
          }}
        >
          ✅ {rewardMessage}
        </div>
      ) : null}

      {/* ① Metabolic status */}
      <MetabolicStatusCard activities={activities} />

      {/* ② Session card — Live or Idle */}
      {isTracking && currentActivity ? (
        /* ── Live session ─────────────────────────────────── */
        <div
          className="tw-rounded-3xl tw-p-6 tw-flex tw-flex-col tw-gap-5 tw-border"
          style={{
            background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)",
            borderColor: "rgba(34,197,94,.25)",
            boxShadow: "0 4px 20px rgba(34,197,94,.12)",
          }}
        >
          {/* Live header */}
          <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-flex-wrap">
            <div className="tw-flex tw-flex-col tw-gap-2">
              <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-bold tw-uppercase tw-tracking-wide"
                style={{ background: "rgba(34,197,94,.14)", color: "var(--color-primary)" }}
              >
                <span className="tw-animate-pulse">●</span> Ao vivo
              </span>
              <div className="tw-flex tw-items-center tw-gap-2.5">
                <span className="tw-text-3xl">{ACTIVITY_META[currentActivity.type || "run"].icon}</span>
                <span className="tw-text-xl tw-font-bold tw-text-gray-900">
                  {ACTIVITY_META[currentActivity.type || "run"].label} em andamento
                </span>
              </div>
              <p className="tw-text-sm tw-text-gray-500">
                GPS montando sua rota em tempo real. Distância e ritmo são recalculados a cada ponto.
              </p>
            </div>

            <button
              type="button"
              onClick={stopActivity}
              className="tw-rounded-2xl tw-px-5 tw-py-3 tw-font-bold tw-text-white tw-cursor-pointer tw-transition-all tw-duration-150 hover:tw-scale-[1.03] hover:tw-shadow-lg"
              style={{
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                border: "none",
                whiteSpace: "nowrap",
              }}
            >
              ⏹ Encerrar sessão
            </button>
          </div>

          {/* Live map */}
          <MapViewer coordinates={currentActivity.routeCoordinates || []} />

          {/* Live metrics — highlight primary metric for activity type */}
          <div className="tw-grid tw-grid-cols-3 tw-gap-3">
            <LiveStatChip
              label="Tempo atual"
              value={formatTime(elapsedTime)}
              highlight={currentActivity.type === "walk"}
            />
            <LiveStatChip
              label="Distância GPS"
              value={(currentActivity.distance || 0).toFixed(2)}
              unit="km"
              highlight={currentActivity.type === "cycling"}
            />
            <LiveStatChip
              label="Ritmo"
              value={formatPace(currentActivity.pace || 0)}
              unit="min/km"
              highlight={currentActivity.type === "run"}
            />
          </div>
        </div>
      ) : (
        /* ── Idle: activity selection + CTA ──────────────── */
        <div className="tw-rounded-3xl tw-bg-white tw-border tw-border-gray-100 tw-shadow-card tw-p-6 tw-flex tw-flex-col tw-gap-5">
          {/* Idle header */}
          <div className="tw-flex tw-flex-col tw-gap-1">
            <h2 className="tw-text-xl tw-font-bold tw-text-gray-900">Pronto para iniciar sua sessão</h2>
            <p className="tw-text-sm tw-text-gray-500">
              Hoje é um bom dia para evoluir seu condicionamento. Escolha o tipo de atividade abaixo.
            </p>
          </div>

          {/* Activity type selection */}
          <div className="tw-grid tw-gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {(Object.keys(ACTIVITY_META) as Activity["type"][]).map((type) => (
              <ActivityTypeCard
                key={type}
                type={type}
                selected={selectedType === type}
                onSelect={() => setSelectedType(type)}
              />
            ))}
          </div>

          {/* CTA */}
          <div
            className="tw-rounded-2xl tw-p-4 tw-flex tw-items-center tw-justify-between tw-gap-4 tw-flex-wrap"
            style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}
          >
            <div className="tw-flex tw-flex-col tw-gap-0.5">
              <span className="tw-font-semibold tw-text-gray-900">
                {selectedMeta.icon} {selectedMeta.label}
              </span>
              <span className="tw-text-xs tw-text-gray-400">
                Treino recomendado para hoje
              </span>
            </div>

            <button
              type="button"
              onClick={startActivity}
              className="tw-rounded-2xl tw-px-6 tw-py-3 tw-font-bold tw-text-white tw-cursor-pointer tw-transition-all tw-duration-150 hover:tw-scale-[1.03] hover:tw-shadow-lg tw-flex tw-flex-col tw-items-center"
              style={{
                background: "linear-gradient(135deg, #22C55E, #16A34A)",
                border: "none",
              }}
            >
              <span>▶ Iniciar sessão</span>
              <span className="tw-text-xs tw-font-normal tw-opacity-80 tw-mt-0.5">GPS ativo</span>
            </button>
          </div>

          {/* Aggregated stats strip */}
          {stats.totalSessions > 0 && (
            <div className="tw-grid tw-grid-cols-3 tw-gap-3">
              {[
                { label: "Sessões", value: String(stats.totalSessions), unit: "" },
                { label: "Distância total", value: stats.totalDistance.toFixed(1), unit: "km" },
                { label: "Tempo acumulado", value: formatTime(stats.totalTime), unit: "" },
              ].map(({ label, value, unit }) => (
                <div key={label} className="tw-rounded-2xl tw-bg-gray-50 tw-border tw-border-gray-100 tw-p-3 tw-flex tw-flex-col tw-gap-1">
                  <span className="tw-text-xs tw-font-medium tw-text-gray-400 tw-uppercase tw-tracking-wide">{label}</span>
                  <div className="tw-flex tw-items-baseline tw-gap-1">
                    <span className="tw-text-xl tw-font-bold tw-text-gray-900">{value}</span>
                    {unit && <span className="tw-text-xs tw-text-gray-400">{unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ③ Qualidade de movimento (IA) — placeholder */}
      <div
        className="tw-rounded-3xl tw-p-6 tw-flex tw-flex-col tw-gap-4 tw-border"
        style={{
          background: "linear-gradient(135deg, rgba(6,182,212,.04), rgba(6,182,212,.02))",
          borderColor: "var(--color-accent-border)",
        }}
      >
        <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-flex-wrap">
          <div className="tw-flex tw-flex-col tw-gap-1">
            <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-text-xs tw-font-bold tw-uppercase tw-tracking-widest"
              style={{ color: "var(--color-accent)" }}
            >
              🤖 IA de movimento
            </span>
            <h3 className="tw-text-lg tw-font-bold tw-text-gray-900">Qualidade de movimento</h3>
            <p className="tw-text-sm tw-text-gray-500">
              Análise em tempo real da sua postura e amplitude pelo MediaPipe.
            </p>
          </div>
          <span
            className="tw-rounded-full tw-px-3 tw-py-1 tw-text-xs tw-font-semibold"
            style={{
              background: "var(--color-accent-soft)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent-border)",
            }}
          >
            Em breve
          </span>
        </div>

        <div className="tw-grid tw-gap-2">
          {[
            { label: "Postura", value: "Boa", icon: "✅" },
            { label: "Amplitude", value: "Pode melhorar", icon: "⚡" },
            { label: "Simetria", value: "--", icon: "⬤" },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="tw-flex tw-items-center tw-justify-between tw-rounded-xl tw-px-4 tw-py-3 tw-bg-white tw-border tw-border-gray-100"
            >
              <span className="tw-text-sm tw-font-medium tw-text-gray-700">{icon} {label}</span>
              <span className="tw-text-sm tw-font-semibold tw-text-gray-500">{value}</span>
            </div>
          ))}
        </div>

        <p className="tw-text-xs tw-text-gray-400">
          Essa seção integra com a câmera do dispositivo via MediaPipe. Disponível em breve no Lab de Movimento.
        </p>
      </div>

      {/* ④ Performance Timeline */}
      <div className="tw-flex tw-flex-col tw-gap-4">
        <div className="tw-flex tw-items-center tw-justify-between tw-flex-wrap tw-gap-2">
          <div className="tw-flex tw-flex-col tw-gap-0.5">
            <h2 className="tw-text-lg tw-font-bold tw-text-gray-900">Timeline de performance</h2>
            <p className="tw-text-xs tw-text-gray-400">
              Cada sessão inclui score, tag contextual e rota colapsável.
            </p>
          </div>
          {activities.length > 0 && (
            <span className="tw-text-xs tw-text-gray-400 tw-font-medium">
              {activities.length} sessão{activities.length !== 1 ? "ões" : ""}
            </span>
          )}
        </div>

        {activities.length === 0 ? (
          <div
            className="tw-rounded-3xl tw-bg-white tw-border tw-border-dashed tw-border-gray-200 tw-p-10 tw-flex tw-flex-col tw-items-center tw-gap-2 tw-text-center"
          >
            <span className="tw-text-3xl">🏁</span>
            <p className="tw-text-sm tw-font-semibold tw-text-gray-600">
              Nenhuma sessão registrada ainda.
            </p>
            <p className="tw-text-xs tw-text-gray-400">
              Inicie uma atividade acima e ela aparece aqui ao encerrar.
            </p>
          </div>
        ) : (
          <div className="tw-flex tw-flex-col tw-gap-3">
            {activities.map((activity) => (
              <PerformanceTimelineCard
                key={activity.id}
                activity={activity}
                onDelete={() => deleteActivity(activity.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

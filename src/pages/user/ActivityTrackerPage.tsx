import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import "./activityTracker.css";

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface Activity {
  id: string;
  type: "walk" | "run" | "cycling";
  startTime: Date;
  endTime?: Date;
  distance: number;
  pace: number;
  duration: number;
  routeCoordinates: Array<{ lat: number; lng: number }>;
  // Extended fields (optional for backward-compat with persisted data)
  calories?: number;
  intensity?: "low" | "moderate" | "high";
  validationFlag?: boolean; // true when saved despite suspicious speed signals
}

interface ValidationResult {
  isSuspicious: boolean;
  reason: string | null;
  avgSpeed: number;
  peakSpeed: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet icon fix
// ─────────────────────────────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVITY_META = {
  walk: { label: "Caminhada", helper: "Baixo impacto" },
  run: { label: "Corrida", helper: "Alta intensidade" },
  cycling: { label: "Ciclismo", helper: "Cardio contínuo" },
} satisfies Record<Activity["type"], { label: string; helper: string }>;

// MET values per activity type (metabolic equivalent of task)
const ACTIVITY_MET: Record<Activity["type"], number> = {
  walk: 3.8,
  run: 10.0,
  cycling: 6.8,
};

// Speed thresholds (km/h) per activity type for validation
const SPEED_THRESHOLDS: Record<Activity["type"], { avgMax: number; peakMax: number }> = {
  walk: { avgMax: 7, peakMax: 15 },
  run: { avgMax: 20, peakMax: 30 },
  cycling: { avgMax: 35, peakMax: 50 },
};

const UNIVERSAL_PEAK_LIMIT = 50; // km/h — above this for any type → vehicle
const ACCELERATION_LIMIT = 20; // km/h delta in one segment → suspicious

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions — Metrics
// ─────────────────────────────────────────────────────────────────────────────

function estimateCalories(
  type: Activity["type"],
  durationSeconds: number,
  distanceKm: number
): number {
  const durationHours = durationSeconds / 3600;
  const met = ACTIVITY_MET[type];
  // MET × body weight (70 kg default) × hours
  const byMet = met * 70 * durationHours;
  // Cross-check with distance-based estimate (avoid inflating short/fast sessions)
  const byDist = distanceKm * 60; // ~60 kcal/km average
  // Use the lower of the two estimates as a conservative figure
  const cal = Math.round(Math.min(byMet, byDist) || byMet);
  return Math.max(0, cal);
}

function classifyIntensity(
  type: Activity["type"],
  pace: number // min/km
): "low" | "moderate" | "high" {
  if (!pace || !Number.isFinite(pace) || pace <= 0) return "low";

  if (type === "walk") {
    if (pace > 15) return "low";
    if (pace >= 10) return "moderate";
    return "high";
  }
  if (type === "run") {
    if (pace > 7) return "low";
    if (pace >= 4.5) return "moderate";
    return "high";
  }
  // cycling
  if (pace > 6) return "low";
  if (pace >= 3) return "moderate";
  return "high";
}

const INTENSITY_LABELS: Record<"low" | "moderate" | "high", string> = {
  low: "Leve",
  moderate: "Moderado",
  high: "Intenso",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions — Validation
// ─────────────────────────────────────────────────────────────────────────────

function analyzeActivityValidity(
  type: Activity["type"],
  speeds: number[]
): ValidationResult {
  if (speeds.length < 3) {
    return { isSuspicious: false, reason: null, avgSpeed: 0, peakSpeed: 0 };
  }

  const avgSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  const peakSpeed = Math.max(...speeds);
  const thresholds = SPEED_THRESHOLDS[type];

  // Universal vehicle signal
  if (peakSpeed > UNIVERSAL_PEAK_LIMIT) {
    return {
      isSuspicious: true,
      reason: "Velocidade incomum detectada para essa atividade",
      avgSpeed,
      peakSpeed,
    };
  }

  // Per-type thresholds
  if (avgSpeed > thresholds.avgMax || peakSpeed > thresholds.peakMax) {
    return {
      isSuspicious: true,
      reason: "Velocidade incomum detectada para essa atividade",
      avgSpeed,
      peakSpeed,
    };
  }

  // Abrupt acceleration between consecutive segments
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] - speeds[i - 1] > ACCELERATION_LIMIT) {
      return {
        isSuspicious: true,
        reason: "Aceleração brusca detectada — padrão incompatível com atividade física",
        avgSpeed,
        peakSpeed,
      };
    }
  }

  return { isSuspicious: false, reason: null, avgSpeed, peakSpeed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions — Existing
// ─────────────────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getTodayStatus(activities: Activity[]) {
  const recent = activities.slice(0, 5);
  const totalDuration = recent.reduce((sum, item) => sum + item.duration, 0);
  const avgDurationMin = recent.length > 0 ? totalDuration / recent.length / 60 : 0;
  const lastActivity = recent[0];
  const hoursSinceLast = lastActivity
    ? (Date.now() - new Date(lastActivity.startTime).getTime()) / 3_600_000
    : 72;

  const energy = clamp(Math.round(62 + Math.min(avgDurationMin, 40) * 0.35), 45, 92);
  const recovery = clamp(Math.round(84 - Math.min(hoursSinceLast, 72) * 0.45), 48, 90);
  const readiness = clamp(Math.round(energy * 0.4 + recovery * 0.6), 42, 93);
  const metabolism = clamp(Math.round((energy + recovery + readiness) / 3), 45, 92);

  return { energy, recovery, readiness, metabolism };
}

function getReadinessAdvice(metabolism: number): string {
  if (metabolism >= 80) return "Zona verde: sessão intensa liberada";
  if (metabolism >= 60) return "Moderado sustentável";
  return "Prefira recuperação ativa hoje";
}

function getPerformanceSignal(activity: Activity) {
  const durationMin = activity.duration / 60;
  const pace = activity.pace || 0;
  let score = 52;

  if (durationMin >= 30) score += 15;
  else if (durationMin >= 18) score += 8;

  if (activity.distance >= 4) score += 12;
  else if (activity.distance >= 2) score += 6;

  if (activity.type === "run" && pace > 0 && pace <= 6.2) score += 13;
  if (activity.type === "walk" && durationMin >= 35) score += 8;
  if (activity.type === "cycling" && activity.distance >= 6) score += 10;

  score = clamp(score, 38, 96);

  const tag = score >= 80 ? "Intenso" : score >= 62 ? "Bom" : "Leve";
  const insight =
    score >= 80
      ? "Boa consistência para evolução progressiva."
      : score >= 62
        ? "Ritmo estável durante a maior parte da sessão."
        : "Ritmo caiu no final. Mantenha intensidade gradual.";

  return { score, tag, insight };
}

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
  for (let i = 1; i < coordinates.length; i++) {
    total += getDistanceBetweenPointsKm(coordinates[i - 1], coordinates[i]);
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

function parseStoredActivities(raw: string | null): Activity[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Activity[];
    return parsed.map((a) => ({
      ...a,
      startTime: new Date(a.startTime),
      endTime: a.endTime ? new Date(a.endTime) : undefined,
      routeCoordinates: a.routeCoordinates || [],
    }));
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActivityIcon({ type, size = 20 }: { type: Activity["type"]; size?: number }) {
  if (type === "walk") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="4" r="2" />
        <path d="M9 8l-2 4h4l1 4-3 4" />
        <path d="M15 8l2 4h-4l-1 4 3 4" />
        <path d="M10 12l2-1 2 1" />
      </svg>
    );
  }
  if (type === "run") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13" cy="4" r="2" />
        <path d="M7 22l2.5-5.5 2.5 2 2-5" />
        <path d="M6.5 10.5l3-3 3.5 1 2.5-2.5" />
        <path d="M17 22l-2.5-5.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="16" r="3.5" />
      <circle cx="17.5" cy="16" r="3.5" />
      <path d="M6.5 16l4-8h4l3 8" />
      <circle cx="14" cy="7" r="1.5" />
    </svg>
  );
}

function Card({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`tr-card ${className}`} style={style}>
      {children}
    </div>
  );
}

function MiniProgress({ label, value }: { label: string; value: number }) {
  return (
    <div className="tr-mini">
      <div className="tr-mini-row">
        <span className="tr-mini-label">{label}</span>
        <span className="tr-mini-value">{value}%</span>
      </div>
      <div className="tr-mini-track">
        <div className="tr-mini-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function IntensityChip({ level }: { level: "low" | "moderate" | "high" }) {
  return (
    <span className={`tr-intensity-chip tr-intensity-chip--${level}`}>
      {INTENSITY_LABELS[level]}
    </span>
  );
}

function WeekSparkline({ activities }: { activities: Activity[] }) {
  const days = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toDateString();
      const dayActivities = activities.filter(
        (a) => new Date(a.startTime).toDateString() === dayStr
      );
      const score =
        dayActivities.length > 0
          ? Math.round(
              dayActivities.reduce((sum, a) => sum + getPerformanceSignal(a).score, 0) /
                dayActivities.length
            )
          : 0;
      result.push({ score, hasActivity: dayActivities.length > 0 });
    }
    return result;
  }, [activities]);

  const activeDays = days.filter((d) => d.hasActivity).length;
  const avgScore =
    activeDays > 0
      ? Math.round(days.filter((d) => d.hasActivity).reduce((s, d) => s + d.score, 0) / activeDays)
      : 0;
  const trend =
    activeDays >= 5
      ? "Consistência em alta"
      : activeDays >= 3
        ? "Estável"
        : activeDays >= 1
          ? "Queda leve detectada"
          : "Nenhuma atividade esta semana";

  const maxScore = Math.max(...days.map((d) => d.score), 1);
  const barH = 36;

  return (
    <div className="tr-trend">
      <div className="tr-trend-bars">
        {days.map((day, i) => {
          const height = day.hasActivity
            ? Math.max(5, Math.round((day.score / maxScore) * barH))
            : 4;
          const barClass = day.hasActivity
            ? day.score >= 75
              ? "tr-trend-bar tr-trend-bar--good"
              : day.score >= 50
                ? "tr-trend-bar tr-trend-bar--mid"
                : "tr-trend-bar tr-trend-bar--weak"
            : "tr-trend-bar tr-trend-bar--empty";
          return (
            <div key={i} className={barClass} style={day.hasActivity ? { height } : undefined} />
          );
        })}
      </div>
      <div className="tr-trend-text">
        <div className="tr-trend-title">{trend}</div>
        <div className="tr-trend-caption">
          Tendência 7 dias
          {activeDays > 0
            ? ` · ${activeDays} ativo${activeDays !== 1 ? "s" : ""} · score médio ${avgScore}`
            : ""}
        </div>
      </div>
    </div>
  );
}

function MapViewer({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  if (coordinates.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 220,
          background: "linear-gradient(180deg, rgba(14,18,16,.96), rgba(12,14,13,.98))",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.08)",
          display: "grid",
          placeItems: "center",
          color: "rgba(255,255,255,0.5)",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 600 }}>Aguardando os primeiros pontos do GPS</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.35)" }}>
            Assim que a localização começar a chegar, a rota aparece aqui em tempo real.
          </div>
        </div>
      </div>
    );
  }

  const center: [number, number] = [
    coordinates[coordinates.length - 1].lat,
    coordinates[coordinates.length - 1].lng,
  ];
  const startPoint: [number, number] = [coordinates[0].lat, coordinates[0].lng];

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.10)" }}>
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: 300 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={coordinates.map((c) => [c.lat, c.lng])}
          pathOptions={{ color: "#22C55E", weight: 5, opacity: 0.92 }}
        />
        <Marker position={startPoint}><Popup>Início</Popup></Marker>
        <Marker position={center}><Popup>Posição atual</Popup></Marker>
      </MapContainer>
    </div>
  );
}

function HistoryMapViewer({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  if (coordinates.length === 0) return null;
  const center: [number, number] = [
    coordinates[coordinates.length - 1].lat,
    coordinates[coordinates.length - 1].lng,
  ];
  const startPoint: [number, number] = [coordinates[0].lat, coordinates[0].lng];
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid var(--color-border)" }}>
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: 210 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={coordinates.map((c) => [c.lat, c.lng])}
          pathOptions={{ color: "#22C55E", weight: 5, opacity: 0.92 }}
        />
        <Marker position={startPoint}><Popup>Início</Popup></Marker>
        <Marker position={center}><Popup>Posição atual</Popup></Marker>
      </MapContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ActivityTrackerPage() {
  // ── Core tracking state ──────────────────────────────────────────────────
  const [isTracking, setIsTracking] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Partial<Activity> | null>(null);
  const [selectedType, setSelectedType] = useState<Activity["type"]>("run");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);

  // ── Validation state ─────────────────────────────────────────────────────
  const [liveValidation, setLiveValidation] = useState<{
    isSuspicious: boolean;
    reason: string;
  } | null>(null);
  const [pendingActivity, setPendingActivity] = useState<Activity | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geolocationRef = useRef<number | null>(null);
  const speedsRef = useRef<number[]>([]);
  const lastGpsTsRef = useRef<number | null>(null);

  // ── Persist / load ───────────────────────────────────────────────────────
  useEffect(() => {
    setActivities(parseStoredActivities(localStorage.getItem("activities")));
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setElapsedTime((p) => p + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking]);

  // ── GPS watch ────────────────────────────────────────────────────────────
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

        setCurrentActivity((prev) => {
          if (!prev) return prev;
          const prevCoords = prev.routeCoordinates || [];
          const lastPoint = prevCoords[prevCoords.length - 1];

          // ── Speed segment tracking ──────────────────────────────────────
          if (lastPoint) {
            const timeDeltaSec = lastGpsTsRef.current
              ? (position.timestamp - lastGpsTsRef.current) / 1000
              : null;
            if (timeDeltaSec && timeDeltaSec > 0) {
              const segDistKm = getDistanceBetweenPointsKm(lastPoint, nextPoint);
              const segSpeedKmh = (segDistKm / timeDeltaSec) * 3600;
              // Ignore outlier GPS noise (> 200 km/h is clearly bad signal)
              if (segSpeedKmh < 200) {
                speedsRef.current.push(segSpeedKmh);
              }
            }
          }
          lastGpsTsRef.current = position.timestamp;

          // ── Route update ────────────────────────────────────────────────
          const nextCoords =
            lastPoint && getDistanceBetweenPointsKm(lastPoint, nextPoint) < 0.01
              ? prevCoords
              : [...prevCoords, nextPoint];
          const distance = parseFloat(calculateRouteDistanceKm(nextCoords).toFixed(2));

          // ── Validation check every 5 speed samples ──────────────────────
          if (speedsRef.current.length >= 3 && speedsRef.current.length % 5 === 0) {
            const type = (prev.type || "run") as Activity["type"];
            const analysis = analyzeActivityValidity(type, speedsRef.current);
            if (analysis.isSuspicious && analysis.reason) {
              setLiveValidation({ isSuspicious: true, reason: analysis.reason });
            } else {
              setLiveValidation(null);
            }
          }

          return {
            ...prev,
            routeCoordinates: nextCoords,
            distance,
            pace: calculatePace(elapsedTime, distance),
          };
        });
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      if (geolocationRef.current) {
        navigator.geolocation.clearWatch(geolocationRef.current);
        geolocationRef.current = null;
      }
    };
  }, [isTracking, elapsedTime]);

  // ── Pace update on tick ──────────────────────────────────────────────────
  useEffect(() => {
    setCurrentActivity((prev) => {
      if (!prev) return prev;
      const distance = prev.distance || 0;
      return { ...prev, duration: elapsedTime, pace: calculatePace(elapsedTime, distance) };
    });
  }, [elapsedTime]);

  // ── Derived stats ────────────────────────────────────────────────────────
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

  const todayStatus = useMemo(() => getTodayStatus(activities), [activities]);

  // ── Live metrics (derived from currentActivity) ─────────────────────────
  const liveCalories = useMemo(() => {
    if (!currentActivity) return 0;
    return estimateCalories(
      currentActivity.type || "run",
      elapsedTime,
      currentActivity.distance || 0
    );
  }, [currentActivity, elapsedTime]);

  const liveIntensity = useMemo((): "low" | "moderate" | "high" => {
    if (!currentActivity) return "low";
    return classifyIntensity(currentActivity.type || "run", currentActivity.pace || 0);
  }, [currentActivity]);

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  function startActivity() {
    setRewardMessage(null);
    setLiveValidation(null);
    setPendingActivity(null);
    speedsRef.current = [];
    lastGpsTsRef.current = null;

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

  /** Step 1: stop GPS/timer and decide whether to save or ask for confirmation */
  function requestStop() {
    if (!currentActivity) return;

    // Stop timer and GPS immediately
    if (timerRef.current) clearInterval(timerRef.current);
    if (geolocationRef.current) {
      navigator.geolocation.clearWatch(geolocationRef.current);
      geolocationRef.current = null;
    }

    const pace = currentActivity.pace || 0;
    const type = (currentActivity.type || selectedType) as Activity["type"];

    const endActivity: Activity = {
      id: currentActivity.id || Date.now().toString(),
      type,
      startTime: currentActivity.startTime || new Date(),
      endTime: new Date(),
      distance: currentActivity.distance || 0,
      pace,
      duration: elapsedTime,
      routeCoordinates: currentActivity.routeCoordinates || [],
      calories: estimateCalories(type, elapsedTime, currentActivity.distance || 0),
      intensity: classifyIntensity(type, pace),
    };

    setIsTracking(false);
    setCurrentActivity(null);
    setElapsedTime(0);

    // Final validation check using full speeds array
    const finalValidation = analyzeActivityValidity(type, speedsRef.current);
    if (finalValidation.isSuspicious) {
      setPendingActivity(endActivity);
    } else {
      saveActivity(endActivity, false);
    }
  }

  /** Step 2a: user confirms the suspicious activity (saves it with a flag) */
  function confirmActivity() {
    if (!pendingActivity) return;
    saveActivity({ ...pendingActivity, validationFlag: true }, true);
    setPendingActivity(null);
    setLiveValidation(null);
  }

  /** Step 2b: user discards the suspicious activity */
  function discardActivity() {
    setPendingActivity(null);
    setLiveValidation(null);
    setRewardMessage(null);
  }

  /** Internal: persist activity, update state, trigger gamification */
  async function saveActivity(endActivity: Activity, confirmed: boolean) {
    const updatedActivities = [endActivity, ...activities];
    setActivities(updatedActivities);
    localStorage.setItem("activities", JSON.stringify(updatedActivities));

    const xpEarned = Math.max(10, Math.min(40, Math.round((endActivity.duration / 60) * 2)));
    const checkin = registerDailyCheckin("activity", xpEarned);
    const signal = getPerformanceSignal(endActivity);
    const insightPrefix =
      signal.tag === "Intenso" ? "Sessão intensa. " : signal.tag === "Bom" ? "Boa sessão. " : "Sessão leve. ";
    const confirmSuffix = confirmed ? " Atividade confirmada manualmente." : "";

    setRewardMessage(
      checkin.alreadyCheckedIn
        ? `${insightPrefix}${signal.insight}${confirmSuffix} Check-in de hoje já garantido.`
        : `${insightPrefix}${signal.insight}${confirmSuffix} +${xpEarned} XP e check-in do dia concluído.`
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
  }

  function deleteActivity(id: string) {
    const updated = activities.filter((a) => a.id !== id);
    setActivities(updated);
    localStorage.setItem("activities", JSON.stringify(updated));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="tr-page">
      {/* Reward banner */}
      {rewardMessage && <div className="tr-reward">{rewardMessage}</div>}

      {/* ── Today Status ────────────────────────────────────────────── */}
      <Card>
        <div className="tr-status">
          <div className="tr-status-left">
            <div className="tr-status-label">Metabolismo hoje</div>
            <div className="tr-status-score-value">
              {todayStatus.metabolism}
              <span className="tr-status-score-unit">%</span>
            </div>
            <div className="tr-status-advice">{getReadinessAdvice(todayStatus.metabolism)}</div>
          </div>
          <div className="tr-status-divider" />
          <div className="tr-status-bars">
            <MiniProgress label="Energia" value={todayStatus.energy} />
            <MiniProgress label="Recuperação" value={todayStatus.recovery} />
            <MiniProgress label="Prontidão" value={todayStatus.readiness} />
          </div>
        </div>
      </Card>

      {/* ── Hero: accumulated session stats ─────────────────────────── */}
      <Card>
        <div className="tr-hero">
          <div className="tr-hero-title">Sua sessão de hoje</div>
          <div className="tr-stats-grid">
            <div className="tr-stat-card">
              <div className="tr-stat-label">Distância total</div>
              <div className="tr-stat-value">
                {stats.totalDistance.toFixed(2)}
                <span className="tr-stat-unit"> km</span>
              </div>
            </div>
            <div className="tr-stat-card">
              <div className="tr-stat-label">Tempo acumulado</div>
              <div className="tr-stat-value">{formatTime(stats.totalTime)}</div>
            </div>
            <div className="tr-stat-card">
              <div className="tr-stat-label">Ritmo médio</div>
              <div className="tr-stat-value">
                {formatPace(stats.avgPace)}
                <span className="tr-stat-unit"> min/km</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Tracking state ───────────────────────────────────────────── */}
      {isTracking && currentActivity ? (
        /* ─── Live mode ─────────────────────────────────────────────── */
        <Card className="tr-live">
          <div className="tr-live-inner">
            {/* Header */}
            <div className="tr-live-header">
              <div className="tr-live-title-block">
                <div className="tr-live-chip">Ao vivo</div>
                <div className="tr-live-title">
                  <ActivityIcon type={currentActivity.type || "run"} size={28} />
                  {ACTIVITY_META[currentActivity.type || "run"].label} em andamento
                </div>
                {/* Intensity chip in header */}
                <div className="tr-live-intensity-row">
                  <IntensityChip level={liveIntensity} />
                </div>
              </div>
              <button type="button" onClick={requestStop} className="tr-stop-button">
                Encerrar sessão
              </button>
            </div>

            {/* Validation warning — non-intrusive, appears during live */}
            {liveValidation?.isSuspicious && (
              <div className="tr-validation-warning">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tr-validation-warning-icon">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                {liveValidation.reason}
              </div>
            )}

            <MapViewer coordinates={currentActivity.routeCoordinates || []} />

            {/* 5 metrics grid */}
            <div className="tr-live-metrics">
              <div className="tr-live-metric-card">
                <div className="tr-live-metric-label">Duração</div>
                <div className="tr-live-metric-value" style={{ fontFamily: "monospace" }}>
                  {formatTime(elapsedTime)}
                </div>
              </div>
              <div className="tr-live-metric-card">
                <div className="tr-live-metric-label">Distância</div>
                <div className="tr-live-metric-value">
                  {(currentActivity.distance || 0).toFixed(2)}
                  <span className="tr-live-metric-unit"> km</span>
                </div>
              </div>
              <div className="tr-live-metric-card">
                <div className="tr-live-metric-label">Ritmo</div>
                <div className="tr-live-metric-value">
                  {formatPace(currentActivity.pace || 0)}
                  <span className="tr-live-metric-unit"> min/km</span>
                </div>
              </div>
              <div className="tr-live-metric-card">
                <div className="tr-live-metric-label">Calorias (est.)</div>
                <div className="tr-live-metric-value">
                  {liveCalories}
                  <span className="tr-live-metric-unit"> kcal</span>
                </div>
              </div>
              <div className="tr-live-metric-card tr-live-metric-card--secondary">
                <div className="tr-live-metric-label">Score</div>
                <div className="tr-live-metric-value">
                  {getPerformanceSignal({
                    ...currentActivity,
                    id: currentActivity.id || "",
                    type: currentActivity.type || "run",
                    startTime: currentActivity.startTime || new Date(),
                    distance: currentActivity.distance || 0,
                    pace: currentActivity.pace || 0,
                    duration: elapsedTime,
                    routeCoordinates: currentActivity.routeCoordinates || [],
                  }).score}
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : pendingActivity ? (
        /* ─── Validation confirmation panel ─────────────────────────── */
        <Card className="tr-confirm-panel">
          <div className="tr-confirm-inner">
            <div className="tr-confirm-icon-wrap">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="tr-confirm-title">Possível atividade inválida</div>
            <div className="tr-confirm-desc">
              Detectamos velocidade incompatível com{" "}
              <strong>{ACTIVITY_META[pendingActivity.type].label.toLowerCase()}</strong>. Pode ter
              sido um trajeto de carro ou bicicleta elétrica.
            </div>

            <div className="tr-confirm-stats">
              <div className="tr-confirm-stat">
                <span className="tr-confirm-stat-label">Duração</span>
                <span className="tr-confirm-stat-value">{formatTime(pendingActivity.duration)}</span>
              </div>
              <div className="tr-confirm-stat">
                <span className="tr-confirm-stat-label">Distância</span>
                <span className="tr-confirm-stat-value">{pendingActivity.distance.toFixed(2)} km</span>
              </div>
              <div className="tr-confirm-stat">
                <span className="tr-confirm-stat-label">Ritmo médio</span>
                <span className="tr-confirm-stat-value">{formatPace(pendingActivity.pace)} min/km</span>
              </div>
              <div className="tr-confirm-stat">
                <span className="tr-confirm-stat-label">Calorias est.</span>
                <span className="tr-confirm-stat-value">{pendingActivity.calories ?? 0} kcal</span>
              </div>
            </div>

            <div className="tr-confirm-actions">
              <button type="button" className="tr-confirm-btn tr-confirm-btn--discard" onClick={discardActivity}>
                Descartar sessão
              </button>
              <button type="button" className="tr-confirm-btn tr-confirm-btn--confirm" onClick={confirmActivity}>
                Confirmar mesmo assim
              </button>
            </div>
          </div>
        </Card>
      ) : (
        /* ─── Idle: activity selection ───────────────────────────────── */
        <Card>
          <div className="tr-hero">
            <div className="tr-selection-title">Como seu corpo vai se movimentar hoje?</div>

            <div className="tr-selection-grid">
              {(Object.keys(ACTIVITY_META) as Activity["type"][]).map((type) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`tr-activity-card${active ? " tr-activity-card--active" : ""}`}
                  >
                    <div className="tr-activity-card-header">
                      <div className="tr-activity-card-left">
                        <div className={`tr-activity-icon${active ? " tr-activity-icon--active" : ""}`}>
                          <ActivityIcon type={type} size={20} />
                        </div>
                        <span className="tr-activity-label">{ACTIVITY_META[type].label}</span>
                      </div>
                      {active && <span className="tr-activity-badge">Selecionado</span>}
                    </div>
                    <div className="tr-activity-helper">{ACTIVITY_META[type].helper}</div>
                  </button>
                );
              })}
            </div>

            <div className="tr-cta-bar">
              <div className="tr-cta-left">
                <div className="tr-cta-icon">
                  <ActivityIcon type={selectedType} size={20} />
                </div>
                <div className="tr-cta-label">{ACTIVITY_META[selectedType].label}</div>
              </div>
              <div className="tr-cta-right">
                <button type="button" onClick={startActivity} className="tr-cta-button">
                  ▶ Iniciar sessão
                </button>
                <div className="tr-cta-caption">Baseado no seu estado de hoje</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Performance Timeline ─────────────────────────────────────── */}
      <div style={{ display: "grid", gap: 14 }}>
        <div className="tr-timeline-header">
          <div className="tr-timeline-title">Performance Timeline</div>
          <div className="tr-timeline-caption">Distância, duração, ritmo e rota de cada sessão.</div>
        </div>

        {activities.length === 0 ? (
          <Card>
            <div className="tr-empty">
              Nenhuma atividade registrada ainda. Sua primeira caminhada, corrida ou pedal aparece
              aqui assim que a sessão terminar.
            </div>
          </Card>
        ) : (
          <div className="tr-timeline-list">
            {activities.map((activity) => {
              const signal = getPerformanceSignal(activity);
              const dotClass =
                signal.score >= 75
                  ? "tr-score-dot tr-score-dot--good"
                  : signal.score >= 50
                    ? "tr-score-dot tr-score-dot--mid"
                    : "tr-score-dot tr-score-dot--weak";
              const tagClass =
                signal.tag === "Intenso"
                  ? "tr-score-tag tr-score-tag--intenso"
                  : signal.tag === "Bom"
                    ? "tr-score-tag tr-score-tag--bom"
                    : "tr-score-tag tr-score-tag--leve";
              const isMapExpanded = expandedMapId === activity.id;

              // Compute derived metrics for legacy activities (no persisted fields)
              const calories =
                activity.calories ?? estimateCalories(activity.type, activity.duration, activity.distance);
              const intensity =
                activity.intensity ?? classifyIntensity(activity.type, activity.pace);

              return (
                <Card key={activity.id} className="tr-timeline-item">
                  <div className="tr-timeline-head">
                    <div className="tr-timeline-meta">
                      <div className="tr-timeline-icon">
                        <ActivityIcon type={activity.type} size={22} />
                      </div>
                      <div className="tr-timeline-info">
                        <div className="tr-timeline-name-row">
                          <span className="tr-timeline-name">
                            {ACTIVITY_META[activity.type].label}
                            {" · "}
                            {new Date(activity.startTime).toLocaleDateString("pt-BR")}
                          </span>
                          {/* Validation flag badge */}
                          {activity.validationFlag && (
                            <span className="tr-validation-flag-badge">Confirmado manualmente</span>
                          )}
                        </div>

                        {/* Score row */}
                        <div className="tr-timeline-score-row">
                          <div className={dotClass} />
                          <span className="tr-score-number">{signal.score}</span>
                          <span className={tagClass}>{signal.tag}</span>
                          <IntensityChip level={intensity} />
                        </div>

                        {/* Stats */}
                        <div className="tr-timeline-stats">
                          <span>{formatTime(activity.duration)}</span>
                          <span>{activity.distance.toFixed(2)} km</span>
                          <span>{formatPace(activity.pace)} min/km</span>
                          <span>{calories} kcal</span>
                        </div>

                        <div className="tr-timeline-insight">{signal.insight}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteActivity(activity.id)}
                      className="tr-delete-button"
                    >
                      Excluir
                    </button>
                  </div>

                  {activity.routeCoordinates && activity.routeCoordinates.length > 0 ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => setExpandedMapId(isMapExpanded ? null : activity.id)}
                        className="tr-map-toggle"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="tr-map-toggle-icon">
                          <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />
                          <path d="M9 4v13M15 7v13" />
                        </svg>
                        {isMapExpanded ? "Ocultar rota" : "Ver rota"}
                      </button>
                      {isMapExpanded && <HistoryMapViewer coordinates={activity.routeCoordinates} />}
                    </div>
                  ) : (
                    <div className="tr-no-route">Sem pontos de rota registrados nesta sessão.</div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {activities.length > 0 && <WeekSparkline activities={activities} />}
      </div>
    </div>
  );
}

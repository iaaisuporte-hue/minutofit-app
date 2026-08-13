import { useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "../../features/team/ConfirmModal";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { persistGamificationCheckin } from "../../services/gamificationApi";
import { addWorkoutHistoryEntry } from "./workoutHistory";
import { authFetch } from "../../services/apiClient";
import { API_URL } from "../../services/apiBase";
import "./activityTracker.css";
import { type Activity } from "../../features/tracker/types";
import { ACTIVITY_META } from "../../features/tracker/constants";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { LocationDisclosure } from "../../features/permissions/LocationDisclosure";
import { hasLocationAck, setLocationAck } from "../../features/permissions/locationAck";
import { estimateCalories, classifyIntensity, INTENSITY_LABELS, getTodayStatus, getReadinessAdvice, getPerformanceSignal } from "../../features/tracker/metrics";
import { calculateRouteDistanceKm, getDistanceBetweenPointsKm } from "../../features/tracker/geometry";
import { analyzeActivityValidity } from "../../features/tracker/validation";
import { formatTime, formatPace, calculatePace, parseStoredActivities } from "../../features/tracker/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Leaflet icon fix
// ─────────────────────────────────────────────────────────────────────────────

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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
          pathOptions={{ color: "#7B9919", weight: 5, opacity: 0.92 }}
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
          pathOptions={{ color: "#7B9919", weight: 5, opacity: 0.92 }}
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
  const [isPaused, setIsPaused] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Partial<Activity> | null>(null);
  const [selectedType, setSelectedType] = useState<Activity["type"]>("run");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const [expandedMapId, setExpandedMapId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ── Manual (treadmill) mode ──────────────────────────────────────────────
  const [manualMode, setManualMode] = useState(false);
  const [manualDurationMin, setManualDurationMin] = useState("");
  const [manualDistanceKm, setManualDistanceKm] = useState("");

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
  const elapsedTimeRef = useRef(0);

  // ── GPS readiness (pre-flight, runs only when not tracking) ─────────────
  const [gpsStatus, setGpsStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unavailable">("idle");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const gpsReadinessRef = useRef<number | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(hasLocationAck);
  const [locationDeclined, setLocationDeclined] = useState(false);

  useEffect(() => {
    if (isTracking) {
      if (gpsReadinessRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsReadinessRef.current);
        gpsReadinessRef.current = null;
      }
      return;
    }
    // Nada de geolocalização antes do aviso: o prompt do sistema não pode ser a
    // primeira coisa que o usuário vê (prominent disclosure, política do Play).
    if (!locationAllowed) return;
    if (!navigator.geolocation) {
      setGpsStatus("unavailable");
      return;
    }
    setGpsStatus("requesting");
    gpsReadinessRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus("ready");
      },
      (err) => {
        if (err.code === 1 /* PERMISSION_DENIED */) {
          setGpsStatus("denied");
        } else {
          setGpsStatus((prev) => (prev === "ready" ? "ready" : "unavailable"));
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (gpsReadinessRef.current !== null) {
        navigator.geolocation?.clearWatch(gpsReadinessRef.current);
        gpsReadinessRef.current = null;
      }
    };
  }, [isTracking, locationAllowed]);

  // ── Persist / load ───────────────────────────────────────────────────────
  useEffect(() => {
    setActivities(parseStoredActivities(localStorage.getItem("activities")));
  }, []);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking || isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setElapsedTime((p) => { elapsedTimeRef.current = p + 1; return p + 1; }), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused, isTracking]);

  // ── GPS watch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking || isPaused || !navigator.geolocation) {
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
            pace: calculatePace(elapsedTimeRef.current, distance),
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
  }, [isPaused, isTracking]);

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
    setIsPaused(false);
    setIsTracking(true);
  }

  function togglePause() {
    if (!currentActivity) return;
    setIsPaused((prev) => !prev);
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
    setIsPaused(false);
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
    setIsPaused(false);
  }

  function saveManualActivity() {
    const durationSec = Math.round(parseFloat(manualDurationMin) * 60);
    if (!manualDurationMin || isNaN(durationSec) || durationSec <= 0) return;
    const distKm = manualDistanceKm ? parseFloat(manualDistanceKm) : 0;
    const pace = distKm > 0 ? (durationSec / 60) / distKm : 0;
    const now = new Date();
    const start = new Date(now.getTime() - durationSec * 1000);
    const manualActivity: Activity = {
      id: crypto.randomUUID(),
      type: selectedType,
      startTime: start,
      endTime: now,
      distance: isNaN(distKm) ? 0 : distKm,
      pace,
      duration: durationSec,
      routeCoordinates: [],
      calories: estimateCalories(selectedType, durationSec, isNaN(distKm) ? 0 : distKm),
      intensity: classifyIntensity(selectedType, pace),
    };
    setManualDurationMin("");
    setManualDistanceKm("");
    setManualMode(false);
    void saveActivity(manualActivity, false);
  }

  /** Internal: persist activity, update state, trigger gamification */
  async function saveActivity(endActivity: Activity, confirmed: boolean) {
    const updatedActivities = [endActivity, ...activities];
    setActivities(updatedActivities);
    localStorage.setItem("activities", JSON.stringify(updatedActivities));

    // O XP da atividade era calculado AQUI (duração × 2, clamp 10–40) e
    // espelhado em localStorage — a Onda C0 (Spec 034) moveu a moeda para o
    // servidor. O cliente relata o fato; o valor é do ledger.
    const signal = getPerformanceSignal(endActivity);
    const insightPrefix =
      signal.tag === "Intenso" ? "Sessão intensa. " : signal.tag === "Bom" ? "Boa sessão. " : "Sessão leve. ";
    const confirmSuffix = confirmed ? " Atividade confirmada manualmente." : "";

    setRewardMessage(`${insightPrefix}${signal.insight}${confirmSuffix} Registrada na sua leitura do dia.`);

    // O check-in é o que leva a atividade para streak/XP/score. Falhar aqui em
    // silêncio (era só um console.error) fazia o aluno terminar a corrida vendo
    // "registrada na sua leitura do dia" enquanto nada tinha sido contabilizado.
    try {
      await persistGamificationCheckin({
        source: "activity",
        activity: {
          type: endActivity.type,
          durationSeconds: endActivity.duration,
          distanceKm: endActivity.distance,
          pace: endActivity.pace,
        },
      });
    } catch (error) {
      console.error("Failed to persist activity gamification:", error);
      setRewardMessage(
        `${insightPrefix}${signal.insight}${confirmSuffix} A atividade ficou salva no aparelho, mas ainda não entrou na sua leitura do dia — abra o Tracker de novo quando estiver online.`
      );
    }
    addWorkoutHistoryEntry({
      workoutId: `activity-${endActivity.id}`,
      title: `${ACTIVITY_META[endActivity.type].label} • GPS`,
      muscleGroups: ["cardio"],
      date: endActivity.endTime?.toISOString() ?? new Date().toISOString(),
    });

    // Persist session to backend (fire-and-forget; localStorage remains source of truth)
    try {
      await authFetch(`${API_URL}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: endActivity.type,
          durationSeconds: endActivity.duration,
          distanceKm: endActivity.distance,
          caloriesEstimated: endActivity.calories ?? 0,
          avgPace: endActivity.pace,
          intensity: endActivity.intensity ?? null,
          score: getPerformanceSignal(endActivity).score,
          routeCoordinates: endActivity.routeCoordinates,
          validationFlag: endActivity.validationFlag ?? false,
          startedAt: endActivity.startTime,
          endedAt: endActivity.endTime ?? new Date(),
        }),
      });
    } catch {
      // Backend unavailable — session already saved to localStorage
    }
  }

  // Princípio VIII: remoção destrutiva usa ConfirmModal, nunca window.confirm.
  function deleteActivity(id: string) {
    setConfirmDeleteId(id);
  }
  function confirmDeleteActivity() {
    const id = confirmDeleteId;
    if (id == null) return;
    const updated = activities.filter((a) => a.id !== id);
    setActivities(updated);
    localStorage.setItem("activities", JSON.stringify(updated));
    setConfirmDeleteId(null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={`tr-page${currentActivity ? " tr-page--live" : ""}`}>
      {!locationAllowed && !locationDeclined && (
        <LocationDisclosure
          onAllow={() => {
            setLocationAck();
            setLocationAllowed(true);
          }}
          onDecline={() => setLocationDeclined(true)}
        />
      )}

      {confirmDeleteId != null && (
        <ConfirmModal
          title="Excluir esta sessão?"
          description="Esta ação não pode ser desfeita."
          confirmLabel="Excluir"
          destructive
          onConfirm={() => confirmDeleteActivity()}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Reward banner */}
      {rewardMessage && <div className="tr-reward">{rewardMessage}</div>}

      {/* ── Today Status ────────────────────────────────────────────── */}
      <Card className="tr-idle-only">
        <div className="tr-status">
          <div className="tr-status-left">
            <div className="tr-status-label">Prontidão</div>
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
      <Card className="tr-idle-only">
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
                <div className={`tr-live-chip${isPaused ? " tr-live-chip--paused" : ""}`}>
                  {isPaused ? "Em pausa" : "Ao vivo"}
                </div>
                <div className="tr-live-title">
                  <ActivityIcon type={currentActivity.type || "run"} size={28} />
                  {ACTIVITY_META[currentActivity.type || "run"].label} {isPaused ? "em pausa" : "em andamento"}
                </div>
                <div className="tr-live-status-note">
                  {isPaused ? "A sessão fica congelada até você retomar." : "Foque só nos números principais e continue em movimento."}
                </div>
              </div>
            </div>

            {/* Validation warning — non-intrusive, appears during live */}
            {liveValidation?.isSuspicious && !isPaused && (
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
              <div className="tr-live-metric-card tr-live-metric-card--primary">
                <div className="tr-live-metric-label">Duração</div>
                <div className="tr-live-metric-value tr-live-metric-value--hero" style={{ fontFamily: "monospace" }}>
                  {formatTime(elapsedTime)}
                </div>
              </div>
              <div className="tr-live-metric-card tr-live-metric-card--primary">
                <div className="tr-live-metric-label">Distância</div>
                <div className="tr-live-metric-value tr-live-metric-value--hero">
                  {(currentActivity.distance || 0).toFixed(2)}
                  <span className="tr-live-metric-unit"> km</span>
                </div>
              </div>
              <div className="tr-live-metric-card tr-live-metric-card--primary">
                <div className="tr-live-metric-label">Ritmo</div>
                <div className="tr-live-metric-value tr-live-metric-value--hero">
                  {formatPace(currentActivity.pace || 0)}
                  <span className="tr-live-metric-unit"> min/km</span>
                </div>
              </div>
              <div className="tr-live-metric-card">
                <div className="tr-live-metric-label">Calorias (est.)</div>
                <div className="tr-live-metric-value tr-live-metric-value--support">
                  {liveCalories}
                  <span className="tr-live-metric-unit"> kcal</span>
                </div>
              </div>
              <div className="tr-live-metric-card tr-live-metric-card--secondary">
                <div className="tr-live-metric-label">Intensidade</div>
                <div className="tr-live-metric-value tr-live-metric-value--support">
                  {liveIntensity === "high" ? "Alta" : liveIntensity === "moderate" ? "Moderada" : "Leve"}
                </div>
              </div>
            </div>

            <div className="tr-live-actions">
              <button type="button" onClick={requestStop} className="tr-end-button">
                Encerrar sessão
              </button>
              <button type="button" onClick={togglePause} className="tr-pause-button">
                {isPaused ? "Retomar sessão" : "Pausar sessão"}
              </button>
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

            {/* Mode toggle: GPS vs Manual */}
            <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
              <button
                type="button"
                onClick={() => setManualMode(false)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "var(--radius-card)",
                  border: `1px solid ${manualMode ? "var(--color-border)" : "var(--color-primary)"}`,
                  background: manualMode ? "transparent" : "var(--color-primary-soft)",
                  color: manualMode ? "var(--color-muted)" : "var(--color-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Com GPS
              </button>
              <button
                type="button"
                onClick={() => setManualMode(true)}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "var(--radius-card)",
                  border: `1px solid ${manualMode ? "var(--color-primary)" : "var(--color-border)"}`,
                  background: manualMode ? "var(--color-primary-soft)" : "transparent",
                  color: manualMode ? "var(--color-primary)" : "var(--color-muted)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Esteira / Sem GPS
              </button>
            </div>

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

            {manualMode ? (
              /* ── Manual entry form (treadmill / no GPS) ── */
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ color: "var(--color-muted)", fontSize: 12, lineHeight: 1.4 }}>
                  Informe os dados da sua atividade na esteira ou em ambiente sem GPS.
                </div>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>Duração (minutos) *</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    placeholder="Ex: 30"
                    value={manualDurationMin}
                    onChange={(e) => setManualDurationMin(e.target.value)}
                    style={{
                      padding: "11px 12px",
                      borderRadius: "var(--radius-card)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface-raised)",
                      color: "var(--color-text)",
                      fontWeight: 600,
                      fontSize: 14,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-muted)" }}>Distância (km) — opcional</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    placeholder="Ex: 3.5"
                    value={manualDistanceKm}
                    onChange={(e) => setManualDistanceKm(e.target.value)}
                    style={{
                      padding: "11px 12px",
                      borderRadius: "var(--radius-card)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface-raised)",
                      color: "var(--color-text)",
                      fontWeight: 600,
                      fontSize: 14,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="tr-cta-button"
                  onClick={saveManualActivity}
                  disabled={!manualDurationMin || parseFloat(manualDurationMin) <= 0}
                  style={{ width: "100%", justifyContent: "center", opacity: (!manualDurationMin || parseFloat(manualDurationMin) <= 0) ? 0.6 : 1 }}
                >
                  Registrar atividade
                </button>
              </div>
            ) : (
              <>
                {/* GPS status indicator */}
                {!locationAllowed && (
                  <button
                    type="button"
                    className="tr-gps-status tr-gps-status--denied"
                    onClick={() => setLocationDeclined(false)}
                    style={{ border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                  >
                    <span className="tr-gps-dot tr-gps-dot--error" />
                    Localização desativada — toque para rever
                  </button>
                )}

                {locationAllowed && gpsStatus !== "idle" && (
                  <div
                    className={`tr-gps-status tr-gps-status--${gpsStatus}`}
                    role="status"
                    aria-live="polite"
                  >
                    {gpsStatus === "requesting" && (
                      <><span className="tr-gps-dot tr-gps-dot--searching" />Buscando sinal GPS…</>
                    )}
                    {gpsStatus === "ready" && (
                      <><span className="tr-gps-dot tr-gps-dot--ready" />GPS pronto{gpsAccuracy !== null ? ` · precisão ${gpsAccuracy} m` : ""}</>
                    )}
                    {gpsStatus === "denied" && (
                      <><span className="tr-gps-dot tr-gps-dot--error" />GPS bloqueado — ative nas configurações do navegador</>
                    )}
                    {gpsStatus === "unavailable" && (
                      <><span className="tr-gps-dot tr-gps-dot--error" />GPS indisponível neste dispositivo</>
                    )}
                  </div>
                )}

                <div className="tr-cta-bar">
                  <div className="tr-cta-left">
                    <div className="tr-cta-icon">
                      <ActivityIcon type={selectedType} size={20} />
                    </div>
                    <div className="tr-cta-label">{ACTIVITY_META[selectedType].label}</div>
                  </div>
                  <div className="tr-cta-right">
                    <button
                      type="button"
                      onClick={startActivity}
                      className="tr-cta-button"
                      disabled={gpsStatus === "denied"}
                      title={gpsStatus === "denied" ? "Permissão de GPS negada" : undefined}
                    >
                      {gpsStatus === "requesting" ? "Aguardando GPS…" : "▶ Iniciar sessão"}
                    </button>
                    <div className="tr-cta-caption">
                      {gpsStatus === "denied"
                        ? "Permissão de GPS necessária"
                        : "Baseado no seu estado de hoje"}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Performance Timeline ─────────────────────────────────────── */}
      <div className="tr-idle-only" style={{ display: "grid", gap: 14 }}>
        <div className="tr-timeline-header">
          <div className="tr-timeline-title">Linha do tempo</div>
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

        <div style={{ padding: "16px 0 8px" }}>
          <MedicalDisclaimer>
            Distância, ritmo e calorias são estimativas do GPS do aparelho e do seu perfil — servem
            para acompanhar tendência, não como medição clínica.
          </MedicalDisclaimer>
        </div>
      </div>
    </div>
  );
}

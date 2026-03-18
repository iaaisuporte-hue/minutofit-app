import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { registerDailyCheckin } from "./gamification";
import { persistGamificationCheckin } from "../../services/gamificationApi";

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

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const ACTIVITY_META = {
  walk: {
    icon: "🚶",
    label: "Caminhada",
    helper: "Ritmo leve para ativar o dia e manter consistência.",
  },
  run: {
    icon: "🏃",
    label: "Corrida",
    helper: "Sessão mais intensa para evoluir condicionamento e pace.",
  },
  cycling: {
    icon: "🚴",
    label: "Ciclismo",
    helper: "Treino cardio de menor impacto para ganhar volume semanal.",
  },
} satisfies Record<Activity["type"], { icon: string; label: string; helper: string }>;

const COLORS = {
  border: "rgba(124,255,107,.16)",
  borderStrong: "rgba(29,185,84,.34)",
  panel: "linear-gradient(180deg, rgba(22,25,22,.92), rgba(15,18,16,.96))",
  panelDeep: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(15,24,20,.98))",
  panelSoft: "rgba(255,255,255,.04)",
  primarySoft: "rgba(29,185,84,.18)",
  highlightSoft: "rgba(124,255,107,.12)",
  text: "#FFFFFF",
  muted: "rgba(255,255,255,.72)",
  mutedSoft: "rgba(232,236,233,.58)",
  green: "#1DB954",
  lime: "#7CFF6B",
  deep: "#0F3D2E",
};

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        background: COLORS.panel,
        boxShadow: "0 18px 44px rgba(0,0,0,.45)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
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
  if (coordinates.length < 2) {
    return 0;
  }

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
  if (!pace || Number.isNaN(pace) || !Number.isFinite(pace)) {
    return "--";
  }
  return pace.toFixed(2);
}

function calculatePace(durationSeconds: number, distanceKm: number) {
  if (!distanceKm) {
    return 0;
  }
  return parseFloat((((durationSeconds / 60) || 0) / distanceKm).toFixed(2));
}

function parseStoredActivities(raw: string | null) {
  if (!raw) {
    return [] as Activity[];
  }

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

function MapViewer({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  if (coordinates.length === 0) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: 320,
          background: "linear-gradient(180deg, rgba(14,18,16,.96), rgba(12,14,13,.98))",
          borderRadius: 18,
          border: `1px solid ${COLORS.border}`,
          display: "grid",
          placeItems: "center",
          color: COLORS.muted,
          textAlign: "center",
          padding: 24,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 28 }}>📍</div>
          <div style={{ fontWeight: 900 }}>Aguardando os primeiros pontos do GPS</div>
          <div style={{ fontSize: 14, color: COLORS.mutedSoft }}>
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
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${COLORS.border}` }}>
      <MapContainer center={center} zoom={15} style={{ width: "100%", height: 320 }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={coordinates.map((coordinate) => [coordinate.lat, coordinate.lng])}
          pathOptions={{ color: COLORS.green, weight: 5, opacity: 0.92 }}
        />
        <Marker position={startPoint}>
          <Popup>🏁 Início</Popup>
        </Marker>
        <Marker position={center}>
          <Popup>📍 Posição atual</Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

export default function ActivityTrackerPage() {
  const [isTracking, setIsTracking] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Partial<Activity> | null>(null);
  const [selectedType, setSelectedType] = useState<Activity["type"]>("run");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const geolocationRef = useRef<number | null>(null);

  useEffect(() => {
    setActivities(parseStoredActivities(localStorage.getItem("activities")));
  }, []);

  useEffect(() => {
    if (!isTracking) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsedTime((previous) => previous + 1);
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
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
          if (!previous) {
            return previous;
          }

          const previousCoordinates = previous.routeCoordinates || [];
          const lastPoint = previousCoordinates[previousCoordinates.length - 1];
          const nextCoordinates =
            lastPoint &&
            getDistanceBetweenPointsKm(lastPoint, nextPoint) < 0.01
              ? previousCoordinates
              : [...previousCoordinates, nextPoint];
          const distance = parseFloat(calculateRouteDistanceKm(nextCoordinates).toFixed(2));
          const duration = elapsedTime;
          const pace = calculatePace(duration, distance);

          return {
            ...previous,
            routeCoordinates: nextCoordinates,
            distance,
            pace,
          };
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
      if (!previous) {
        return previous;
      }

      const distance = previous.distance || 0;
      return {
        ...previous,
        duration: elapsedTime,
        pace: calculatePace(elapsedTime, distance),
      };
    });
  }, [elapsedTime]);

  const stats = useMemo(() => {
    if (activities.length === 0) {
      return { totalDistance: 0, totalTime: 0, avgPace: 0, totalSessions: 0 };
    }

    const totalDistance = activities.reduce((sum, activity) => sum + activity.distance, 0);
    const totalTime = activities.reduce((sum, activity) => sum + activity.duration, 0);
    const avgPace = totalDistance > 0 ? totalTime / 60 / totalDistance : 0;

    return {
      totalDistance,
      totalTime,
      avgPace: parseFloat(avgPace.toFixed(2)),
      totalSessions: activities.length,
    };
  }, [activities]);

  const latestActivity = activities[0];

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
    if (!currentActivity) {
      return;
    }

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
    const updatedActivities = activities.filter((activity) => activity.id !== id);
    setActivities(updatedActivities);
    localStorage.setItem("activities", JSON.stringify(updatedActivities));
  }

  return (
    <div style={{ display: "grid", gap: 18, color: COLORS.text }}>
      {rewardMessage ? (
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            border: `1px solid ${COLORS.borderStrong}`,
            background: "rgba(29,185,84,.12)",
            color: COLORS.text,
            fontWeight: 800,
          }}
        >
          {rewardMessage}
        </div>
      ) : null}

      <Card
        style={{
          background: COLORS.panelDeep,
          borderColor: COLORS.borderStrong,
          borderRadius: 24,
        }}
      >
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
              <div
                style={{
                  display: "inline-flex",
                  width: "fit-content",
                  alignItems: "center",
                  gap: 8,
                  borderRadius: 999,
                  background: COLORS.highlightSoft,
                  color: COLORS.lime,
                  padding: "8px 12px",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Tracker
              </div>
              <div style={{ fontSize: 32, fontWeight: 1000, lineHeight: 1.1 }}>
                Tracker para corrida, caminhada e ciclismo.
              </div>
              <div style={{ color: COLORS.muted, fontSize: 15, lineHeight: 1.6 }}>
                Inicie uma sessão, acompanhe a rota em tempo real e salve cada atividade para manter ritmo, distância e consistência do seu cardio.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 10,
                minWidth: 180,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
                padding: 16,
              }}
            >
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, textTransform: "uppercase", letterSpacing: 1.1 }}>
                Sessões
              </div>
              <div style={{ fontSize: 30, fontWeight: 1000 }}>{stats.totalSessions}</div>
              <div style={{ color: COLORS.muted, fontSize: 13 }}>
                {latestActivity
                  ? `Última: ${ACTIVITY_META[latestActivity.type].label.toLowerCase()}`
                  : "Nenhuma atividade registrada ainda"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Card style={{ padding: 16, background: "rgba(255,255,255,.04)" }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase" }}>
                Distância total
              </div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 1000 }}>
                {stats.totalDistance.toFixed(2)} <span style={{ fontSize: 15, color: COLORS.muted }}>km</span>
              </div>
            </Card>
            <Card style={{ padding: 16, background: "rgba(255,255,255,.04)" }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase" }}>
                Tempo acumulado
              </div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 1000 }}>{formatTime(stats.totalTime)}</div>
            </Card>
            <Card style={{ padding: 16, background: "rgba(255,255,255,.04)" }}>
              <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, letterSpacing: 1.1, textTransform: "uppercase" }}>
                Ritmo médio
              </div>
              <div style={{ marginTop: 10, fontSize: 28, fontWeight: 1000 }}>
                {formatPace(stats.avgPace)} <span style={{ fontSize: 15, color: COLORS.muted }}>min/km</span>
              </div>
            </Card>
          </div>
        </div>
      </Card>

      {isTracking && currentActivity ? (
        <Card
          style={{
            background: "linear-gradient(135deg, rgba(15,61,46,.94), rgba(10,15,12,.98))",
            borderColor: COLORS.borderStrong,
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    width: "fit-content",
                    borderRadius: 999,
                    background: "rgba(124,255,107,.14)",
                    color: COLORS.lime,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    textTransform: "uppercase",
                    letterSpacing: 1.1,
                  }}
                >
                  Ao vivo
                </div>
                <div style={{ fontSize: 26, fontWeight: 1000, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 34 }}>{ACTIVITY_META[currentActivity.type || "run"].icon}</span>
                  {ACTIVITY_META[currentActivity.type || "run"].label} em andamento
                </div>
                <div style={{ color: COLORS.muted, fontSize: 14 }}>
                  O GPS está montando sua rota em tempo real. Assim que os pontos chegam, distância e ritmo são recalculados automaticamente.
                </div>
              </div>

              <button
                type="button"
                onClick={stopActivity}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                  color: "#0A130D",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ⏹ Encerrar sessão
              </button>
            </div>

            <MapViewer coordinates={currentActivity.routeCoordinates || []} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <Card style={{ padding: 16, background: COLORS.panelSoft }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Tempo atual
                </div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 1000, fontFamily: "monospace" }}>
                  {formatTime(elapsedTime)}
                </div>
              </Card>

              <Card style={{ padding: 16, background: COLORS.panelSoft }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Distância GPS
                </div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 1000 }}>
                  {(currentActivity.distance || 0).toFixed(2)} <span style={{ fontSize: 16, color: COLORS.muted }}>km</span>
                </div>
              </Card>

              <Card style={{ padding: 16, background: COLORS.panelSoft }}>
                <div style={{ color: COLORS.mutedSoft, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Ritmo estimado
                </div>
                <div style={{ marginTop: 10, fontSize: 34, fontWeight: 1000 }}>
                  {formatPace(currentActivity.pace || 0)} <span style={{ fontSize: 16, color: COLORS.muted }}>min/km</span>
                </div>
              </Card>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ display: "grid", gap: 18 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontSize: 26, fontWeight: 1000 }}>Escolha a atividade e comece a rastrear.</div>
              <div style={{ color: COLORS.muted, fontSize: 14, lineHeight: 1.6 }}>
                Use o GPS do aparelho para montar a rota da sessão. Corrida, caminhada e ciclismo compartilham o mesmo fluxo, mas cada opção já entra com o contexto certo.
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {(Object.keys(ACTIVITY_META) as Activity["type"][]).map((type) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    style={{
                      padding: 18,
                      textAlign: "left",
                      borderRadius: 18,
                      border: active ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`,
                      background: active
                        ? "linear-gradient(135deg, rgba(15,61,46,.76), rgba(18,23,19,.96))"
                        : "linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))",
                      color: COLORS.text,
                      cursor: "pointer",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 30 }}>{ACTIVITY_META[type].icon}</span>
                        <span style={{ fontSize: 18, fontWeight: 900 }}>{ACTIVITY_META[type].label}</span>
                      </div>
                      {active ? (
                        <span
                          style={{
                            borderRadius: 999,
                            background: COLORS.highlightSoft,
                            color: COLORS.lime,
                            padding: "6px 10px",
                            fontSize: 11,
                            fontWeight: 900,
                            textTransform: "uppercase",
                          }}
                        >
                          Selecionado
                        </span>
                      ) : null}
                    </div>
                    <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>
                      {ACTIVITY_META[type].helper}
                    </div>
                  </button>
                );
              })}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
                padding: 16,
                borderRadius: 18,
                border: `1px solid ${COLORS.border}`,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 900 }}>
                  {ACTIVITY_META[selectedType].icon} {ACTIVITY_META[selectedType].label}
                </div>
                <div style={{ color: COLORS.muted, fontSize: 13 }}>
                  Ao iniciar, a tela passa para modo ao vivo e a rota começa a ser desenhada automaticamente.
                </div>
              </div>

              <button
                type="button"
                onClick={startActivity}
                style={{
                  padding: "14px 18px",
                  borderRadius: 14,
                  border: `1px solid ${COLORS.borderStrong}`,
                  background: "linear-gradient(135deg, #1DB954 0%, #7CFF6B 100%)",
                  color: "#0A130D",
                  fontWeight: 1000,
                  cursor: "pointer",
                }}
              >
                ▶ Iniciar sessão
              </button>
            </div>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Histórico de atividades</div>
          <div style={{ color: COLORS.muted, fontSize: 13 }}>
            Revise distância, duração, ritmo e a rota de cada sessão.
          </div>
        </div>

        {activities.length === 0 ? (
          <Card
            style={{
              textAlign: "center",
              color: COLORS.muted,
              padding: 32,
            }}
          >
            Nenhuma atividade registrada ainda. Sua primeira caminhada, corrida ou pedal aparece aqui assim que a sessão terminar.
          </Card>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {activities.map((activity) => (
              <Card key={activity.id} style={{ padding: 16 }}>
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
                      <div
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 16,
                          display: "grid",
                          placeItems: "center",
                          background: COLORS.primarySoft,
                          fontSize: 28,
                        }}
                      >
                        {ACTIVITY_META[activity.type].icon}
                      </div>
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontWeight: 900, fontSize: 17 }}>
                          {ACTIVITY_META[activity.type].label} • {new Date(activity.startTime).toLocaleDateString("pt-BR")}
                        </div>
                        <div style={{ color: COLORS.muted, fontSize: 13, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          <span>⏱ {formatTime(activity.duration)}</span>
                          <span>📍 {activity.distance.toFixed(2)} km</span>
                          <span>⚡ {formatPace(activity.pace)} min/km</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteActivity(activity.id)}
                      style={{
                        padding: "10px 12px",
                        background: "rgba(255,0,0,.12)",
                        border: "1px solid rgba(255,0,0,.22)",
                        borderRadius: 10,
                        color: "#FF9090",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Excluir
                    </button>
                  </div>

                  {activity.routeCoordinates && activity.routeCoordinates.length > 0 ? (
                    <MapViewer coordinates={activity.routeCoordinates} />
                  ) : (
                    <div
                      style={{
                        padding: 20,
                        borderRadius: 16,
                        border: `1px dashed ${COLORS.border}`,
                        background: "rgba(255,255,255,.03)",
                        color: COLORS.muted,
                        textAlign: "center",
                        fontSize: 14,
                      }}
                    >
                      Essa sessão não registrou pontos de rota suficientes para exibir o mapa.
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

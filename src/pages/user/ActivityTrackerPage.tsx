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
// Activity metadata (no emoji icons — SVG used instead)
// ─────────────────────────────────────────────────────────────

const ACTIVITY_META = {
  walk: {
    label: "Caminhada",
    helper: "Baixo impacto · ideal para recuperação",
    primaryMetric: "duration" as const,
    primaryLabel: "Duração",
  },
  run: {
    label: "Corrida",
    helper: "Alta intensidade · melhora cardiovascular",
    primaryMetric: "pace" as const,
    primaryLabel: "Ritmo",
  },
  cycling: {
    label: "Ciclismo",
    helper: "Baixo impacto articular · ganhe volume cardio",
    primaryMetric: "distance" as const,
    primaryLabel: "Distância",
  },
} satisfies Record<
  Activity["type"],
  { label: string; helper: string; primaryMetric: "duration" | "pace" | "distance"; primaryLabel: string }
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

  const hourScore =
    hour >= 6 && hour <= 10 ? 80 :
    hour >= 14 && hour <= 18 ? 75 :
    hour >= 11 && hour <= 13 ? 65 :
    hour >= 19 && hour <= 21 ? 55 : 40;

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
    interpretation = "Ótimas condições para treino intenso hoje.";
    readinessLabel = "Ótimo";
  } else if (score >= 65) {
    interpretation = "Condições favoráveis para treino moderado a intenso.";
    readinessLabel = "Bom";
  } else if (score >= 50) {
    interpretation = "Boas condições para um treino moderado.";
    readinessLabel = "Moderado";
  } else if (score >= 35) {
    interpretation = "Fadiga leve detectada. Prefira ritmo leve hoje.";
    readinessLabel = "Leve";
  } else {
    interpretation = "Corpo pedindo recuperação. Caminhada leve ou descanso ativo.";
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
  tagClass: string;
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
  let tagClass: string;
  if (score >= 80) {
    tag = "Alta intensidade";
    tagClass = "tw-bg-red-50 tw-text-red-600";
  } else if (score >= 60) {
    tag = "Bom treino";
    tagClass = "tw-bg-green-50 tw-text-green-700";
  } else if (mins < 15) {
    tag = "Curto";
    tagClass = "tw-bg-gray-100 tw-text-ink-muted";
  } else {
    tag = "Leve";
    tagClass = "tw-bg-blue-50 tw-text-blue-600";
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

  return { score, tag, tagClass, insight };
}

function scoreColor(value: number): string {
  if (value >= 65) return "#16A34A";
  if (value >= 40) return "#F59E0B";
  return "#EF4444";
}

// ─────────────────────────────────────────────────────────────
// SVG icon components — Lucide-style (stroke 1.75, no emoji)
// ─────────────────────────────────────────────────────────────

function IconWalk({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4.5" r="1.5" />
      <path d="M9 21l1.5-5.5 2 2.5 2.5-8" />
      <path d="M8 10.5l4 1.5 3.5-1.5" />
    </svg>
  );
}

function IconRun({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="13" cy="4" r="1.5" />
      <path d="M7 20l3-8 2 3 3-7" />
      <path d="M9 11.5l3.5-2 2.5 1" />
    </svg>
  );
}

function IconBike({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h2" />
    </svg>
  );
}

function IconPlay({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="6,3 20,12 6,21" />
    </svg>
  );
}

function IconStop({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  );
}

function IconClock({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconMapPin({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconZap({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconGps({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconChevronUp({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

function IconBrain({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

const ACTIVITY_ICON: Record<Activity["type"], (size?: number) => React.ReactElement> = {
  walk: (size) => <IconWalk size={size} />,
  run: (size) => <IconRun size={size} />,
  cycling: (size) => <IconBike size={size} />,
};

// ─────────────────────────────────────────────────────────────
// Hero Ring Chart
// ─────────────────────────────────────────────────────────────

const RING_CONFIG = [
  { key: "energy",   label: "Energia",      r: 100, color: "#16A34A", track: "#DCFCE7" },
  { key: "recovery", label: "Recuperação",  r: 78,  color: "#F59E0B", track: "#FEF3C7" },
  { key: "readiness",label: "Prontidão",    r: 56,  color: "#3B82F6", track: "#DBEAFE" },
] as const;

function HeroRingChart({ activities }: { activities: Activity[] }) {
  const status = useMemo(() => deriveMetabolicStatus(activities), [activities]);
  const cx = 120;
  const cy = 120;

  return (
    <div className="tw-bg-white tw-rounded-2xl tw-p-6 tw-flex tw-flex-col sm:tw-flex-row tw-items-center tw-gap-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      {/* Ring SVG */}
      <div className="tw-flex-shrink-0">
        <svg viewBox="0 0 240 240" width={200} height={200} role="img" aria-label="Score metabólico">
          {RING_CONFIG.map(({ key, r, color, track }) => {
            const value = status[key as keyof Pick<MetabolicStatus, "energy" | "recovery" | "readiness">];
            const C = 2 * Math.PI * r;
            const offset = C * (1 - value / 100);
            return (
              <g key={key} transform={`rotate(-90, ${cx}, ${cy})`}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={track} strokeWidth={16} />
                <circle
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth={16}
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={offset}
                  style={{ transition: "stroke-dashoffset 0.9s ease" }}
                />
              </g>
            );
          })}
          {/* Center score */}
          <text x={cx} y={108} textAnchor="middle" fontSize="11" fill="#9CA3AF" letterSpacing="2.5" fontFamily="Inter, sans-serif" fontWeight="600">SCORE</text>
          <text x={cx} y={148} textAnchor="middle" fontSize="52" fontWeight="700" fill="#111827" fontFamily="Inter, sans-serif">{status.score}</text>
        </svg>
      </div>

      {/* Legend + interpretation */}
      <div className="tw-flex tw-flex-col tw-gap-4 tw-flex-1 tw-min-w-0">
        <div>
          <h2 className="tw-text-[22px] tw-font-semibold tw-text-ink tw-leading-tight">Status metabólico</h2>
          <p className="tw-text-[15px] tw-text-ink-muted tw-mt-1 tw-leading-relaxed">{status.interpretation}</p>
        </div>

        {/* Ring legend */}
        <div className="tw-flex tw-flex-col tw-gap-2.5">
          {RING_CONFIG.map(({ key, label, color }) => {
            const value = status[key as keyof Pick<MetabolicStatus, "energy" | "recovery" | "readiness">];
            return (
              <div key={key} className="tw-flex tw-items-center tw-gap-3">
                <div className="tw-w-3 tw-h-3 tw-rounded-full tw-flex-shrink-0" style={{ background: color }} />
                <span className="tw-text-[13px] tw-text-ink-muted tw-flex-1">{label}</span>
                <span className="tw-text-[13px] tw-font-semibold tw-tabular-nums" style={{ color }}>{value}</span>
                <div className="tw-w-20 tw-h-1.5 tw-rounded-full tw-bg-divider tw-overflow-hidden">
                  <div className="tw-h-full tw-rounded-full tw-transition-all tw-duration-700" style={{ width: `${value}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Readiness badge */}
        <div className="tw-flex tw-items-center tw-gap-2">
          <span className="tw-inline-flex tw-items-center tw-rounded-full tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-bg-canvas tw-border tw-border-divider tw-text-ink-muted">
            Treino: {status.readinessLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Segmented control for activity type
// ─────────────────────────────────────────────────────────────

function SegmentedControl({
  selected,
  onSelect,
}: {
  selected: Activity["type"];
  onSelect: (type: Activity["type"]) => void;
}) {
  return (
    <div className="tw-flex tw-rounded-full tw-bg-gray-100 tw-p-1 tw-gap-0.5">
      {(Object.keys(ACTIVITY_META) as Activity["type"][]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`tw-flex-1 tw-flex tw-items-center tw-justify-center tw-gap-2 tw-h-11 tw-rounded-full tw-text-sm tw-font-medium tw-cursor-pointer tw-transition-all tw-duration-200 ${
            selected === type
              ? "tw-bg-ink tw-text-white tw-shadow-sm"
              : "tw-text-ink-muted hover:tw-text-ink"
          }`}
          style={{ outline: "none", border: "none" }}
          aria-pressed={selected === type}
        >
          {ACTIVITY_ICON[type](18)}
          <span className="tw-hidden sm:tw-inline">{ACTIVITY_META[type].label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MapViewer (Leaflet — functional contract unchanged)
// ─────────────────────────────────────────────────────────────

function MapViewer({ coordinates, height = 240 }: { coordinates: Array<{ lat: number; lng: number }>; height?: number }) {
  if (coordinates.length === 0) {
    return (
      <div
        className="tw-rounded-xl tw-bg-canvas tw-border tw-border-dashed tw-border-divider tw-flex tw-flex-col tw-items-center tw-justify-center tw-gap-3 tw-text-center tw-py-10"
      >
        <span className="tw-text-ink-subtle"><IconGps size={36} /></span>
        <div>
          <p className="tw-text-[14px] tw-font-semibold tw-text-ink">Aguardando GPS</p>
          <p className="tw-text-[12px] tw-text-ink-subtle tw-mt-0.5">A rota aparece em tempo real assim que a localização chegar</p>
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
    <div className="tw-rounded-xl tw-overflow-hidden">
      <MapContainer center={center} zoom={15} style={{ width: "100%", height }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Polyline
          positions={coordinates.map((c) => [c.lat, c.lng])}
          pathOptions={{ color: "#16A34A", weight: 5, opacity: 0.92 }}
        />
        <Marker position={startPoint}><Popup>Início</Popup></Marker>
        <Marker position={center}><Popup>Posição atual</Popup></Marker>
      </MapContainer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Collapsible map for history items
// ─────────────────────────────────────────────────────────────

function CollapsibleMap({ coordinates }: { coordinates: Array<{ lat: number; lng: number }> }) {
  const [open, setOpen] = useState(false);
  if (coordinates.length === 0) return null;
  return (
    <div className="tw-mt-2">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="tw-flex tw-items-center tw-gap-1.5 tw-text-[13px] tw-font-medium tw-text-brand tw-cursor-pointer hover:tw-opacity-75 tw-transition-opacity tw-duration-150"
        style={{ background: "none", border: "none", padding: 0 }}
      >
        {open ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
        {open ? "Ocultar rota" : "Ver rota"}
      </button>
      {open && (
        <div className="tw-mt-2">
          <MapViewer coordinates={coordinates} height={200} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Live stat block
// ─────────────────────────────────────────────────────────────

function LiveStat({
  label,
  value,
  unit,
  hero,
}: {
  label: string;
  value: string;
  unit?: string;
  hero?: boolean;
}) {
  return (
    <div className={`tw-flex tw-flex-col ${hero ? "tw-items-center" : ""}`}>
      <span className="tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-widest tw-text-ink-subtle">{label}</span>
      <div className="tw-flex tw-items-baseline tw-gap-1.5 tw-mt-0.5">
        <span
          className={`tw-font-bold tw-tabular-nums tw-leading-none ${hero ? "tw-text-[56px]" : "tw-text-[32px]"} tw-text-ink`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
        {unit && <span className="tw-text-[14px] tw-text-ink-muted">{unit}</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Performance timeline row
// ─────────────────────────────────────────────────────────────

function TimelineRow({
  activity,
  onDelete,
  isLast,
}: {
  activity: Activity;
  onDelete: () => void;
  isLast: boolean;
}) {
  const perf = useMemo(() => deriveSessionPerformance(activity), [activity]);

  return (
    <div className={`tw-py-4 tw-flex tw-flex-col tw-gap-3 ${isLast ? "" : "tw-border-b tw-border-divider"}`}>
      {/* Top row: icon + label + date + score + delete */}
      <div className="tw-flex tw-items-center tw-gap-3">
        {/* Activity icon */}
        <div
          className="tw-w-9 tw-h-9 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-bg-canvas tw-border tw-border-divider tw-text-ink-muted"
        >
          {ACTIVITY_ICON[activity.type](18)}
        </div>

        {/* Label + date */}
        <div className="tw-flex-1 tw-min-w-0">
          <div className="tw-flex tw-items-center tw-gap-2 tw-flex-wrap">
            <span className="tw-text-[15px] tw-font-semibold tw-text-ink">{ACTIVITY_META[activity.type].label}</span>
            <span className={`tw-rounded-full tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold ${perf.tagClass}`}>
              {perf.tag}
            </span>
          </div>
          <span className="tw-text-[12px] tw-text-ink-subtle">
            {new Date(activity.startTime).toLocaleDateString("pt-BR", {
              weekday: "short", day: "numeric", month: "short",
            })}
          </span>
        </div>

        {/* Score */}
        <div className="tw-text-right tw-flex-shrink-0">
          <span className="tw-text-[18px] tw-font-bold tw-tabular-nums" style={{ color: scoreColor(perf.score) }}>{perf.score}</span>
          <p className="tw-text-[10px] tw-text-ink-subtle tw-uppercase tw-tracking-wide">pts</p>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="tw-flex-shrink-0 tw-w-8 tw-h-8 tw-flex tw-items-center tw-justify-center tw-rounded-lg tw-text-ink-subtle hover:tw-text-red-500 hover:tw-bg-red-50 tw-cursor-pointer tw-transition-all tw-duration-150"
          style={{ background: "none", border: "none" }}
          aria-label="Excluir atividade"
        >
          <IconTrash size={15} />
        </button>
      </div>

      {/* Stats inline */}
      <div className="tw-flex tw-items-center tw-gap-4 tw-ml-12 tw-flex-wrap">
        <span className="tw-flex tw-items-center tw-gap-1.5 tw-text-[13px] tw-text-ink-muted">
          <span className="tw-text-ink-subtle"><IconClock size={13} /></span>
          {formatTime(activity.duration)}
        </span>
        <span className="tw-flex tw-items-center tw-gap-1.5 tw-text-[13px] tw-text-ink-muted">
          <span className="tw-text-ink-subtle"><IconMapPin size={13} /></span>
          {activity.distance.toFixed(2)} km
        </span>
        <span className="tw-flex tw-items-center tw-gap-1.5 tw-text-[13px] tw-text-ink-muted">
          <span className="tw-text-ink-subtle"><IconZap size={13} /></span>
          {formatPace(activity.pace)} min/km
        </span>
      </div>

      {/* Insight */}
      {perf.insight && (
        <p className="tw-text-[12px] tw-text-ink-subtle tw-ml-12 tw-leading-relaxed">{perf.insight}</p>
      )}

      {/* Collapsible map */}
      <div className="tw-ml-12">
        <CollapsibleMap coordinates={activity.routeCoordinates} />
      </div>
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
        ? "Atividade salva. Check-in de hoje já garantido."
        : `Atividade salva. +${xpEarned} XP — check-in do dia concluído.`
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

  const activityType = (isTracking && currentActivity?.type) ? currentActivity.type : selectedType;
  const primaryMeta = ACTIVITY_META[activityType];

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="tw-flex tw-flex-col tw-gap-8 tw-max-w-[880px]">

      {/* Reward banner */}
      {rewardMessage ? (
        <div
          className="tw-rounded-xl tw-px-4 tw-py-3 tw-text-[14px] tw-font-medium tw-text-brand tw-bg-green-50 tw-border tw-border-green-100"
        >
          {rewardMessage}
        </div>
      ) : null}

      {/* ① Hero ring chart */}
      <HeroRingChart activities={activities} />

      {/* ② Unified session card — idle / live */}
      <div className="tw-bg-white tw-rounded-2xl tw-overflow-hidden" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>

        {isTracking && currentActivity ? (
          /* ── LIVE ──────────────────────────────────────── */
          <div className="tw-flex tw-flex-col tw-gap-5 tw-p-6">
            {/* Live badge + activity label */}
            <div className="tw-flex tw-items-center tw-justify-between">
              <div className="tw-flex tw-items-center tw-gap-3">
                <span
                  className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-full tw-px-3 tw-py-1 tw-text-[11px] tw-font-bold tw-uppercase tw-tracking-widest tw-text-brand"
                  style={{ background: "#DCFCE7" }}
                >
                  <span
                    className="tw-w-1.5 tw-h-1.5 tw-rounded-full tw-bg-brand tw-animate-pulse tw-inline-block"
                  />
                  Ao vivo
                </span>
                <div className="tw-flex tw-items-center tw-gap-2 tw-text-ink">
                  {ACTIVITY_ICON[currentActivity.type || "run"](20)}
                  <span className="tw-text-[16px] tw-font-semibold">{ACTIVITY_META[currentActivity.type || "run"].label}</span>
                </div>
              </div>
            </div>

            {/* Hero metric (primary for type) */}
            <div className="tw-text-center tw-py-2">
              {activityType === "walk" && (
                <LiveStat label="Duração" value={formatTime(elapsedTime)} hero />
              )}
              {activityType === "run" && (
                <LiveStat label="Ritmo" value={formatPace(currentActivity.pace || 0)} unit="min/km" hero />
              )}
              {activityType === "cycling" && (
                <LiveStat label="Distância" value={(currentActivity.distance || 0).toFixed(2)} unit="km" hero />
              )}
            </div>

            {/* Secondary metrics */}
            <div className="tw-grid tw-grid-cols-2 tw-gap-3">
              {activityType !== "walk" && (
                <div className="tw-rounded-xl tw-bg-canvas tw-p-4">
                  <LiveStat label="Duração" value={formatTime(elapsedTime)} />
                </div>
              )}
              {activityType !== "cycling" && (
                <div className="tw-rounded-xl tw-bg-canvas tw-p-4">
                  <LiveStat label="Distância" value={(currentActivity.distance || 0).toFixed(2)} unit="km" />
                </div>
              )}
              {activityType !== "run" && (
                <div className="tw-rounded-xl tw-bg-canvas tw-p-4">
                  <LiveStat label="Ritmo" value={formatPace(currentActivity.pace || 0)} unit="min/km" />
                </div>
              )}
              {/* Filler if only 1 secondary */}
              {activityType === "walk" && (
                <div className="tw-rounded-xl tw-bg-canvas tw-p-4">
                  <LiveStat label="Ritmo" value={formatPace(currentActivity.pace || 0)} unit="min/km" />
                </div>
              )}
            </div>

            {/* Map */}
            <MapViewer coordinates={currentActivity.routeCoordinates || []} height={240} />

            {/* Stop button below map */}
            <button
              type="button"
              onClick={stopActivity}
              className="tw-w-full tw-h-12 tw-rounded-xl tw-flex tw-items-center tw-justify-center tw-gap-2 tw-text-[14px] tw-font-semibold tw-cursor-pointer tw-transition-all tw-duration-150 hover:tw-bg-red-100 tw-text-red-600"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}
            >
              <IconStop size={16} />
              Encerrar sessão
            </button>
          </div>

        ) : (
          /* ── IDLE ──────────────────────────────────────── */
          <div className="tw-flex tw-flex-col tw-gap-6 tw-p-6">
            {/* Header */}
            <div>
              <h2 className="tw-text-[22px] tw-font-semibold tw-text-ink">Iniciar sessão</h2>
              <p className="tw-text-[14px] tw-text-ink-muted tw-mt-0.5">Escolha o tipo de atividade e comece a rastrear sua rota.</p>
            </div>

            {/* Segmented control */}
            <SegmentedControl selected={selectedType} onSelect={setSelectedType} />

            {/* Context helper */}
            <p className="tw-text-[13px] tw-text-ink-muted tw-text-center -tw-mt-3">{primaryMeta.helper}</p>

            {/* CTA circular button */}
            <div className="tw-flex tw-flex-col tw-items-center tw-gap-3 tw-py-2">
              <button
                type="button"
                onClick={startActivity}
                className="tw-w-[88px] tw-h-[88px] tw-rounded-full tw-flex tw-items-center tw-justify-center tw-cursor-pointer tw-transition-all tw-duration-200 hover:tw-scale-105 tw-text-white"
                style={{
                  background: "linear-gradient(135deg, #22C55E, #16A34A)",
                  boxShadow: "0 8px 24px rgba(22,163,74,0.35)",
                  border: "none",
                }}
                aria-label="Iniciar sessão"
              >
                <IconPlay size={30} />
              </button>
              <div className="tw-text-center">
                <p className="tw-text-[16px] tw-font-medium tw-text-ink">Iniciar</p>
                <p className="tw-text-[12px] tw-text-ink-subtle">Treino recomendado para hoje</p>
              </div>
            </div>

            {/* Stats strip (only when history exists) */}
            {stats.totalSessions > 0 && (
              <div className="tw-grid tw-grid-cols-3 tw-gap-3 tw-pt-2 tw-border-t tw-border-divider">
                {[
                  { label: "Sessões", value: String(stats.totalSessions), unit: "" },
                  { label: "Distância", value: stats.totalDistance.toFixed(1), unit: "km" },
                  { label: "Tempo total", value: formatTime(stats.totalTime), unit: "" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="tw-flex tw-flex-col tw-gap-0.5">
                    <span className="tw-text-[11px] tw-font-medium tw-uppercase tw-tracking-wide tw-text-ink-subtle">{label}</span>
                    <div className="tw-flex tw-items-baseline tw-gap-1">
                      <span className="tw-text-[20px] tw-font-bold tw-text-ink tw-tabular-nums">{value}</span>
                      {unit && <span className="tw-text-[12px] tw-text-ink-muted">{unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ③ Performance timeline */}
      <div>
        <div className="tw-flex tw-items-baseline tw-justify-between tw-mb-4">
          <h2 className="tw-text-[22px] tw-font-semibold tw-text-ink">Histórico</h2>
          {activities.length > 0 && (
            <span className="tw-text-[13px] tw-text-ink-subtle">
              {activities.length} sessão{activities.length !== 1 ? "ões" : ""}
            </span>
          )}
        </div>

        {activities.length === 0 ? (
          <div className="tw-bg-white tw-rounded-2xl tw-py-12 tw-flex tw-flex-col tw-items-center tw-gap-2 tw-text-center" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            <span className="tw-text-ink-subtle"><IconMapPin size={32} /></span>
            <p className="tw-text-[15px] tw-font-semibold tw-text-ink tw-mt-1">Nenhuma sessão ainda</p>
            <p className="tw-text-[13px] tw-text-ink-subtle">Inicie uma atividade acima — ela aparece aqui ao encerrar.</p>
          </div>
        ) : (
          <div className="tw-bg-white tw-rounded-2xl tw-px-6" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
            {activities.map((activity, idx) => (
              <TimelineRow
                key={activity.id}
                activity={activity}
                onDelete={() => deleteActivity(activity.id)}
                isLast={idx === activities.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ④ Qualidade de movimento (IA) — teaser discreto */}
      <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-flex-wrap tw-py-5 tw-px-6 tw-bg-white tw-rounded-2xl" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        <div className="tw-flex tw-items-start tw-gap-3">
          <span className="tw-text-ink-subtle tw-mt-0.5"><IconBrain size={16} /></span>
          <div>
            <span className="tw-text-[14px] tw-font-semibold tw-text-ink">Qualidade de movimento</span>
            <p className="tw-text-[13px] tw-text-ink-muted tw-mt-0.5 tw-leading-relaxed">
              Análise de postura e amplitude em tempo real via câmera. Integra com o Lab de Movimento.
            </p>
          </div>
        </div>
        <span className="tw-flex-shrink-0 tw-rounded-full tw-px-2.5 tw-py-1 tw-text-[11px] tw-font-semibold tw-bg-canvas tw-border tw-border-divider tw-text-ink-subtle">
          Em breve
        </span>
      </div>

    </div>
  );
}

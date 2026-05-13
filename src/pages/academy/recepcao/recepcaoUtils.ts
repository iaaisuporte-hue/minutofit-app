import type { StudentStatus } from "../../../services/academyApi";

export const STATUS_LABELS: Record<string, string> = {
  lead: "Lead",
  active: "Ativo",
  overdue: "Pendência",
  paused: "Pausado",
  cancelled: "Cancelado",
};

export const STATUS_BADGE: Record<string, string> = {
  lead: "badge badge-info",
  active: "badge badge-success",
  overdue: "badge badge-warn",
  paused: "badge",
  cancelled: "badge badge-danger",
};

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

export function statusLabel(status: StudentStatus | null | undefined) {
  return STATUS_LABELS[status ?? "lead"] ?? "Sem status";
}

export function statusBadge(status: StudentStatus | null | undefined) {
  return STATUS_BADGE[status ?? "lead"] ?? "badge";
}

export function timeLabel(iso: string | null | undefined) {
  if (!iso) return "Sem registro";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

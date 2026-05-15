import { API_URL } from "./apiBase";
import { authFetch } from "./apiClient";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType =
  | "follow_up_marked"
  | "observation"
  | "bonus_offered"
  | "light_workout_offered"
  | "gradual_return_offered"
  | "message_sent"
  | "quick_nudge";

export type RelationshipAction = {
  id: number;
  personalId: number;
  studentId: number;
  academyId: number | null;
  actionType: ActionType;
  payloadJson: Record<string, unknown>;
  source: string;
  dueAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type TimelineMeta = {
  actionType?: string;
  dueAt?: string | null;
  resolvedAt?: string | null;
  source?: string;
  payload?: {
    channel?: string;
    templateCategory?: string;
    snippet?: string;
    note?: string;
  } | null;
  [key: string]: unknown;
};

export type TimelineItem = {
  kind: "action" | "message" | "workout" | "checkin" | "note";
  id: string;
  occurredAt: string;
  title: string;
  summary: string;
  meta: TimelineMeta;
};

export type MessageTemplate = {
  id: number;
  personalId: number | null;
  academyId: number | null;
  scope: "personal" | "academy" | "metacore";
  category: string;
  title: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createRelationshipAction(
  studentId: string,
  input: {
    actionType: ActionType;
    payloadJson?: Record<string, unknown>;
    source?: string;
    dueAt?: string | null;
  }
): Promise<RelationshipAction> {
  const res = await authFetch(`${API_URL}/personal/students/${studentId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to create action");
  return json.data;
}

export async function listRelationshipTimeline(
  studentId: string,
  limit = 50
): Promise<TimelineItem[]> {
  const res = await authFetch(
    `${API_URL}/personal/students/${studentId}/timeline?limit=${limit}`
  );
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load timeline");
  return json.data;
}

export async function resolveRelationshipAction(actionId: number): Promise<RelationshipAction> {
  const res = await authFetch(`${API_URL}/personal/actions/${actionId}/resolve`, {
    method: "PATCH",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to resolve action");
  return json.data;
}

export async function deleteRelationshipAction(actionId: number): Promise<void> {
  const res = await authFetch(`${API_URL}/personal/actions/${actionId}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to delete action");
}

// ---------------------------------------------------------------------------
// Message Templates
// ---------------------------------------------------------------------------

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  const res = await authFetch(`${API_URL}/personal/message-templates`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load templates");
  return json.data;
}

export async function createMessageTemplate(input: {
  category: string;
  title: string;
  body: string;
  isDefault?: boolean;
}): Promise<MessageTemplate> {
  const res = await authFetch(`${API_URL}/personal/message-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to create template");
  return json.data;
}

export async function updateMessageTemplate(
  id: number,
  input: Partial<{ category: string; title: string; body: string }>
): Promise<MessageTemplate> {
  const res = await authFetch(`${API_URL}/personal/message-templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to update template");
  return json.data;
}

export async function deleteMessageTemplate(id: number): Promise<void> {
  const res = await authFetch(`${API_URL}/personal/message-templates/${id}`, {
    method: "DELETE",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to delete template");
}

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_URL =
  configuredApiUrl ||
  (import.meta.env.DEV ? "http://localhost:3000/api" : `${window.location.origin}/api`);

export const SESSION_EXPIRED_EVENT = "minutofit:session-expired";

export function notifySessionExpired() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export async function parseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

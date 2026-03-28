import { API_URL, notifySessionExpired, parseJson } from "./apiBase";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./authTokens";

let refreshInFlight: Promise<boolean> | null = null;

async function postRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const data = await parseJson(response);
  if (!response.ok || !data?.data?.accessToken) {
    return false;
  }

  const { accessToken, refreshToken: newRefresh } = data.data;
  setTokens(accessToken, newRefresh ?? refreshToken);
  return true;
}

async function tryRefreshOnce(): Promise<boolean> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async () => {
    try {
      return await postRefresh();
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Authenticated fetch: sends Bearer from storage, on 401 attempts one refresh + retry.
 * Use for API routes that accept the access JWT (not login/register).
 */
export async function authFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input.href;

  const run = () => {
    const token = getAccessToken();
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(url, { ...init, headers });
  };

  let response = await run();

  if (response.status !== 401) {
    return response;
  }

  const refreshed = await tryRefreshOnce();
  if (!refreshed) {
    clearTokens();
    notifySessionExpired();
    return response;
  }

  response = await run();
  if (response.status === 401) {
    clearTokens();
    notifySessionExpired();
  }

  return response;
}

import { API_URL, notifySessionExpired, parseJson } from "./apiBase";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./authTokens";
import { extractTenantSlug } from "./tenantHost";

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Falha de rede (offline, DNS, servidor inalcançável) — distinta de uma resposta
 * de erro do servidor. O `fetch` rejeita com um `TypeError: Failed to fetch`
 * genérico; quem mostra `error.message` na tela acabava exibindo isso ao aluno.
 */
export class NetworkError extends Error {
  constructor() {
    super("Sem conexão com o servidor. Verifique sua internet e tente de novo.");
    this.name = "NetworkError";
  }
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof NetworkError;
}

async function postRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  // Sem rede o refresh falha; devolver false aqui limparia os tokens e
  // deslogaria quem só passou por um túnel. Propaga como NetworkError.
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }).catch(() => {
    throw new NetworkError();
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
    // Forward the browser's hostname so the backend tenantResolverMiddleware can
    // identify the academy even though the API is on a different domain (Render).
    if (typeof window !== 'undefined') {
      const tenantSlug = extractTenantSlug();
      if (tenantSlug) {
        headers.set("X-Tenant-Host", window.location.hostname);
      }
    }
    return fetch(url, { ...init, headers }).catch(() => {
      throw new NetworkError();
    });
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

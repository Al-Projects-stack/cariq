import type { QueryResponse, CarVariant, CarProfile, CompareResponse, MarketPosition, TCOEstimate, RecommendResponse, AuthResponse, UserProfile, WatchlistResponse, WatchlistItem, SavedSearchResponse, SavedSearchItem, AlertListResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "";

export const DASHBOARD_URL = `${API_BASE}/api/v1/dashboard`;

export const DASHBOARD_PASSCODE = import.meta.env.VITE_DASHBOARD_PASSCODE || "";

export function getAuthToken(): string | null {
  return localStorage.getItem("cariq_token");
}

function authHeaders(token?: string): Record<string, string> {
  const t = token ?? getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function authFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers as Record<string, string> | undefined) };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    // let callers handle, but also clear stale token elsewhere via AuthContext
    const err = await res.json().catch(() => ({ detail: "Unauthorized" }));
    throw new Error(err.detail || "Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

export async function queryCarIQ(
  question: string,
  sessionId?: string
): Promise<QueryResponse> {
  return fetchJson<QueryResponse>("/api/v1/query", {
    method: "POST",
    body: JSON.stringify({ question, session_id: sessionId ?? null }),
  });
}

export async function listModels(): Promise<CarVariant[]> {
  return fetchJson<CarVariant[]>("/api/v1/models");
}

export async function getModelProfile(make: string, model: string): Promise<CarProfile> {
  const encodedMake = encodeURIComponent(make);
  const encodedModel = encodeURIComponent(model.replace(/ /g, "_"));
  return fetchJson<CarProfile>(`/api/v1/models/${encodedMake}/${encodedModel}`);
}

export async function compareModels(
  makeA: string,
  modelA: string,
  makeB: string,
  modelB: string
): Promise<CompareResponse> {
  return fetchJson<CompareResponse>("/api/v1/compare", {
    method: "POST",
    body: JSON.stringify({ make_a: makeA, model_a: modelA, make_b: makeB, model_b: modelB }),
  });
}

export async function getMarketPosition(make: string, model: string): Promise<MarketPosition> {
  const encodedMake = encodeURIComponent(make);
  const encodedModel = encodeURIComponent(model.replace(/ /g, "_"));
  return fetchJson<MarketPosition>(`/api/v1/models/${encodedMake}/${encodedModel}/market-position`);
}

export async function getTCO(make: string, model: string): Promise<TCOEstimate> {
  const encodedMake = encodeURIComponent(make);
  const encodedModel = encodeURIComponent(model.replace(/ /g, "_"));
  return fetchJson<TCOEstimate>(`/api/v1/models/${encodedMake}/${encodedModel}/tco`);
}

export async function getRecommendations(params: {
  budget_max: number;
  budget_min?: number;
  body_type?: string;
  priorities?: string[];
  family_size?: number;
}): Promise<RecommendResponse> {
  return fetchJson<RecommendResponse>("/api/v1/recommend", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

// --- Auth ---
export async function signup(email: string, password: string, display_name?: string): Promise<AuthResponse> {
  return fetchJson<AuthResponse>("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, display_name: display_name || "" }),
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return fetchJson<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<UserProfile> {
  return authFetchJson<UserProfile>("/api/v1/auth/me");
}

// --- Watchlist ---
export async function listWatchlist(): Promise<WatchlistResponse> {
  return authFetchJson<WatchlistResponse>("/api/v1/watchlist");
}

export async function addWatchlist(make: string, model: string): Promise<WatchlistItem> {
  return authFetchJson<WatchlistItem>("/api/v1/watchlist", {
    method: "POST",
    body: JSON.stringify({ make, model }),
  });
}

export async function removeWatchlist(id: number): Promise<void> {
  return authFetchJson<void>(`/api/v1/watchlist/${id}`, { method: "DELETE" });
}

// --- Saved Searches ---
export async function listSavedSearches(): Promise<SavedSearchResponse> {
  return authFetchJson<SavedSearchResponse>("/api/v1/saved-searches");
}

export async function saveSearch(query: string, label?: string, filters?: string): Promise<SavedSearchItem> {
  return authFetchJson<SavedSearchItem>("/api/v1/saved-searches", {
    method: "POST",
    body: JSON.stringify({ query, label: label || query.slice(0, 60), filters: filters || "{}" }),
  });
}

export async function deleteSavedSearch(id: number): Promise<void> {
  return authFetchJson<void>(`/api/v1/saved-searches/${id}`, { method: "DELETE" });
}

// --- Alerts ---
export async function listAlerts(): Promise<AlertListResponse> {
  return authFetchJson<AlertListResponse>("/api/v1/alerts");
}

export async function markAlertRead(id: number): Promise<void> {
  return authFetchJson<void>(`/api/v1/alerts/${id}/read`, { method: "POST" });
}

export async function markAllAlertsRead(): Promise<void> {
  return authFetchJson<void>("/api/v1/alerts/read-all", { method: "POST" });
}

import type { QueryResponse, CarVariant, CarProfile, CompareResponse, MarketPosition, TCOEstimate, RecommendResponse, AuthResponse, UserProfile, WatchlistResponse, WatchlistItem, SavedSearchResponse, SavedSearchItem, AlertListResponse, ChatMessage, AdminSession, AdminModelListItem, AdminModelDetail, AdminModelCreate, AdminFault, AdminPriceRange, AdminChecklistItem, DiffChange, AdminUserItem, FailureGroup, SyncJob, OverviewStats } from "./types";

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
  sessionId?: string,
  history?: ChatMessage[]
): Promise<QueryResponse> {
  return fetchJson<QueryResponse>("/api/v1/query", {
    method: "POST",
    body: JSON.stringify({
      question,
      session_id: sessionId ?? null,
      ...(history && history.length > 0 ? { history: history.slice(-6) } : {}),
    }),
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

// --- Public feedback (thumbs up/down) ---
export async function sendFeedback(queryId: number, vote: "up" | "down"): Promise<void> {
  await fetchJson<void>("/api/v1/feedback", {
    method: "POST",
    body: JSON.stringify({ query_id: queryId, vote }),
  });
}

// --- Admin dashboard (cookie session + CSRF, see AdminContext) ---
function getCsrfToken(): string | null {
  const m = document.cookie.match(/(?:^|; )cariq_admin_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function adminFetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string> | undefined) || {}),
  };
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCsrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  return adminFetchJson<AdminSession>("/api/v1/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function adminMe(): Promise<AdminSession> {
  return adminFetchJson<AdminSession>("/api/v1/admin/auth/me");
}

export async function adminRefresh(): Promise<AdminSession> {
  return adminFetchJson<AdminSession>("/api/v1/admin/auth/refresh", { method: "POST" });
}

export async function adminLogout(): Promise<void> {
  await adminFetchJson<void>("/api/v1/admin/auth/logout", { method: "POST" });
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function adminListModels(q = "", status = "", page = 1): Promise<Paged<AdminModelListItem>> {
  const params = new URLSearchParams({ q, page: String(page), page_size: "20" });
  if (status) params.set("status", status);
  return adminFetchJson<Paged<AdminModelListItem>>(`/api/v1/admin/kb/models?${params}`);
}

export async function adminGetModel(slug: string): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}`);
}

export async function adminCreateModel(body: AdminModelCreate): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>("/api/v1/admin/kb/models", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUpdateProfile(slug: string, body: object): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/profile`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function adminReplaceFaults(slug: string, faults: AdminFault[]): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/faults`, {
    method: "PUT",
    body: JSON.stringify(faults),
  });
}

export async function adminReplacePrices(slug: string, prices: AdminPriceRange[]): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/prices`, {
    method: "PUT",
    body: JSON.stringify(prices),
  });
}

export async function adminReplaceChecklist(slug: string, checklist: AdminChecklistItem[]): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/checklist`, {
    method: "PUT",
    body: JSON.stringify(checklist),
  });
}

export async function adminSoftDelete(slug: string): Promise<void> {
  await adminFetchJson<void>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/soft-delete`, { method: "POST" });
}

export async function adminRestoreModel(slug: string): Promise<void> {
  await adminFetchJson<void>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/restore`, { method: "POST" });
}

export async function adminModelDiff(slug: string): Promise<{ slug: string; has_changes: boolean; changes: DiffChange[] }> {
  return adminFetchJson<{ slug: string; has_changes: boolean; changes: DiffChange[] }>(
    `/api/v1/admin/kb/models/${encodeURIComponent(slug)}/diff`
  );
}

export async function adminPublishModel(slug: string): Promise<{ job_id: number }> {
  return adminFetchJson<{ job_id: number }>(`/api/v1/admin/kb/models/${encodeURIComponent(slug)}/publish`, {
    method: "POST",
  });
}

export async function adminListVersions(slug: string): Promise<{ items: { id: number; kind: string; created_by: string; created_at: string }[]; total: number }> {
  return adminFetchJson<{ items: { id: number; kind: string; created_by: string; created_at: string }[]; total: number }>(
    `/api/v1/admin/kb/models/${encodeURIComponent(slug)}/versions`
  );
}

export async function adminRollback(slug: string, versionId: number): Promise<AdminModelDetail> {
  return adminFetchJson<AdminModelDetail>(
    `/api/v1/admin/kb/models/${encodeURIComponent(slug)}/rollback/${versionId}`,
    { method: "POST" }
  );
}

export async function adminExportModel(slug: string): Promise<Record<string, unknown>> {
  return adminFetchJson<Record<string, unknown>>(
    `/api/v1/admin/kb/models/${encodeURIComponent(slug)}/export`
  );
}

export async function adminListAudit(action = "", actor = "", page = 1): Promise<Paged<{ id: number; actor: string; action: string; model_slug: string | null; detail: string | null; created_at: string }>> {
  const params = new URLSearchParams({ action, actor, page: String(page), page_size: "20" });
  return adminFetchJson<Paged<{ id: number; actor: string; action: string; model_slug: string | null; detail: string | null; created_at: string }>>(
    `/api/v1/admin/kb/audit?${params}`
  );
}

export async function adminListJobs(status = "", page = 1): Promise<Paged<SyncJob>> {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (status) params.set("status", status);
  return adminFetchJson<Paged<SyncJob>>(`/api/v1/admin/sync/jobs?${params}`);
}

export async function adminGetJob(id: number): Promise<SyncJob> {
  return adminFetchJson<SyncJob>(`/api/v1/admin/sync/jobs/${id}`);
}

export async function adminReindexAll(): Promise<{ job_id: number }> {
  return adminFetchJson<{ job_id: number }>("/api/v1/admin/sync/reindex-all", {
    method: "POST",
    body: JSON.stringify({ confirm: true }),
  });
}

export async function adminSyncHealth(): Promise<{ total_vectors: number; models: { slug: string; expected: number; found: number; ok: boolean }[] }> {
  return adminFetchJson<{ total_vectors: number; models: { slug: string; expected: number; found: number; ok: boolean }[] }>(
    "/api/v1/admin/sync/health"
  );
}

export async function adminOverview(): Promise<OverviewStats> {
  return adminFetchJson<OverviewStats>("/api/v1/admin/overview");
}

export async function adminListFailureGroups(reason = "", status = "", page = 1): Promise<Paged<FailureGroup>> {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (reason) params.set("reason", reason);
  if (status) params.set("status", status);
  return adminFetchJson<Paged<FailureGroup>>(`/api/v1/admin/failures/groups?${params}`);
}

export async function adminGetFailureGroup(id: number): Promise<{
  group: FailureGroup;
  queries: { id: number; question: string; top_score: number | null; refused: boolean; vote: string | null; created_at: string }[];
  chunks: { id: string; score: number | null; text: string }[];
}> {
  return adminFetchJson<{
    group: FailureGroup;
    queries: { id: number; question: string; top_score: number | null; refused: boolean; vote: string | null; created_at: string }[];
    chunks: { id: string; score: number | null; text: string }[];
  }>(`/api/v1/admin/failures/groups/${id}`);
}

export async function adminResolveGroup(id: number, note?: string): Promise<void> {
  await adminFetchJson<void>(`/api/v1/admin/failures/groups/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ note: note || "" }),
  });
}

export async function adminPrefillFromGroup(id: number): Promise<{ detected_make: string | null; detected_model: string | null; prefill: AdminModelCreate }> {
  return adminFetchJson<{ detected_make: string | null; detected_model: string | null; prefill: AdminModelCreate }>(
    `/api/v1/admin/failures/groups/${id}/prefill`
  );
}

export async function adminListUsers(): Promise<AdminUserItem[]> {
  return adminFetchJson<AdminUserItem[]>("/api/v1/admin/users");
}

export async function adminCreateUser(email: string, password: string, role: "admin" | "editor"): Promise<AdminUserItem> {
  return adminFetchJson<AdminUserItem>("/api/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
}

export async function adminUpdateUser(id: number, body: { disabled?: boolean; password?: string }): Promise<AdminUserItem> {
  return adminFetchJson<AdminUserItem>(`/api/v1/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

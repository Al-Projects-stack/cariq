import type { QueryResponse, CarVariant, CarProfile, CompareResponse, MarketPosition } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
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

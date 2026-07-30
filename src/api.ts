import type { Activity, Analytics, Pagination, Paste, PasteInput } from './types';

const API_URL = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string, public details?: unknown) { super(message); }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers },
    });
  } catch {
    throw new ApiError(navigator.onLine ? 'The API is temporarily unreachable.' : 'You appear to be offline.', 0, navigator.onLine ? 'NETWORK_ERROR' : 'OFFLINE');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: 'Request failed', code: 'REQUEST_FAILED' } }));
    throw new ApiError(body.error?.message || `Request failed (${response.status})`, response.status, body.error?.code || 'REQUEST_FAILED', body.error?.details);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  list: (params: URLSearchParams, signal?: AbortSignal) => request<{ data: Paste[]; pagination: Pagination }>(`/api/pastes?${params}`, { signal }),
  analytics: () => request<Analytics>('/api/analytics'),
  activity: () => request<{ data: Activity[] }>('/api/activity'),
  health: () => Promise.all([request<{ status: string; uptimeSeconds: number }>('/health'), request<{ status: string; database: string }>('/ready')]),
  get: (id: string) => request<Paste>(`/api/pastes/${encodeURIComponent(id)}`),
  meta: (id: string) => request<Pick<Paste, 'id' | 'title' | 'visibility' | 'language' | 'expires_at'>>(`/api/pastes/${encodeURIComponent(id)}/meta`),
  create: (data: PasteInput) => request<Paste>('/api/pastes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: PasteInput) => request<Paste>(`/api/pastes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  favorite: (id: string, favorite: boolean) => request<Paste>(`/api/pastes/${id}/favorite`, { method: 'PATCH', body: JSON.stringify({ favorite }) }),
  fork: (id: string) => request<Paste>(`/api/pastes/${id}/fork`, { method: 'POST' }),
  revisions: (id: string) => request<{ data: (Paste & { current: boolean })[] }>(`/api/pastes/${id}/revisions`),
  restore: (id: string, version: number) => request<Paste>(`/api/pastes/${id}/revisions/${version}/restore`, { method: 'POST' }),
  delete: (id: string) => request<void>(`/api/pastes/${id}`, { method: 'DELETE' }),
  import: (pastes: PasteInput[]) => request<{ imported: number; ids: string[] }>('/api/import', { method: 'POST', body: JSON.stringify({ pastes }) }),
  export: (ids: string[]) => request<unknown>('/api/export', { method: 'POST', body: JSON.stringify({ ids }) }),
  rawUrl: (id: string, download = false) => `${API_URL}/api/pastes/${encodeURIComponent(id)}/raw${download ? '?download=1' : ''}`,
  docsUrl: `${API_URL}/api-docs`,
  openapiUrl: `${API_URL}/openapi.json`,
};

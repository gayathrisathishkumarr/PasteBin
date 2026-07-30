import type { Paste, Stats } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const api = {
  list: (search = '') => request<{ data: Paste[] }>(`/api/pastes${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  stats: () => request<Stats>('/api/stats'),
  get: (id: string) => request<Paste>(`/api/pastes/${id}`),
  create: (data: Pick<Paste, 'title' | 'content' | 'language' | 'visibility'>) =>
    request<Paste>('/api/pastes', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/api/pastes/${id}`, { method: 'DELETE' }),
  docsUrl: `${API_URL}/api-docs`,
};


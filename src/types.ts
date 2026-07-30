export type Visibility = 'public' | 'unlisted' | 'secret';

export interface Paste {
  id: string;
  title: string;
  description: string;
  content: string;
  language: string;
  visibility: Visibility;
  tags: string[];
  favorite: boolean;
  views: number;
  forks: number;
  source_id: string | null;
  expires_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type PasteInput = Pick<Paste, 'title' | 'description' | 'content' | 'language' | 'visibility' | 'tags'> & { expiresAt?: string | null };

export interface Pagination { page: number; limit: number; total: number; pages: number }
export interface Stats {
  total: number; public: number; favorites: number; views: number; forks: number; bytes: number; active: number; expired: number;
}
export interface Analytics {
  stats: Stats;
  languages: { label: string; value: number }[];
  visibility: { label: string; value: number }[];
  created: { label: string; value: number }[];
  viewsOverTime: { label: string; value: number }[];
  mostViewed: { id: string; title: string; value: number }[];
  mostForked: { id: string; title: string; value: number }[];
  uptimeSeconds: number;
}
export interface Activity { id: number; paste_id: string | null; type: string; detail: string; title?: string; created_at: string }

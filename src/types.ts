export interface Paste {
  id: string;
  title: string;
  content: string;
  language: string;
  visibility: 'public' | 'private' | 'unlisted';
  views: number;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  total: number;
  public: number;
  views: number;
  bytes: number;
}


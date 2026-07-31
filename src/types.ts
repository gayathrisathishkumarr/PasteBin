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

export interface LineageNode {
  id: string;
  title: string;
  language: string;
  visibility: Exclude<Visibility, 'secret'>;
  tags: string[];
  version: number;
  revisionCount: number;
  forks: number;
  sourceId: string | null;
  updatedAt: string;
  size: number;
}

export interface LineageEdge {
  source: string;
  target: string;
  type: 'fork' | 'similar';
  score: number;
  reasons: string[];
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  meta: {
    totalNodes: number;
    totalEdges: number;
    languages: number;
    similarityMethod: 'token-set-jaccard-v1';
  };
}

export interface RelatedPastes {
  source: LineageNode;
  related: { node: LineageNode; score: number; reasons: string[] }[];
}

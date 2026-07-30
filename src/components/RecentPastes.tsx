import { CheckSquare, Copy, Download, Eye, GitFork, Grid2X2, Heart, List, MoreHorizontal, Share2, Square, Trash2 } from 'lucide-react';
import type { Paste, Pagination } from '../types';

function relative(date: string) {
  const seconds = Math.max(0, (Date.now() - new Date(date.includes('T') ? date : `${date.replace(' ', 'T')}Z`).getTime()) / 1000);
  if (seconds < 60) return 'Just now'; if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`; return `${Math.floor(seconds / 86400)}d ago`;
}
function Skeleton() { return <div role="status" className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3"><span className="sr-only">Loading pastes…</span>{[1,2,3,4,5,6].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl bg-white/[0.04]" />)}</div>; }

export default function RecentPastes({ pastes, pagination, loading, title, layout, selected, onLayout, onSelect, onView, onFavorite, onFork, onCopy, onShare, onDownload, onDelete, onPage, onCreate }: {
  pastes: Paste[]; pagination?: Pagination; loading: boolean; title: string; layout: 'grid' | 'list'; selected: Set<string>;
  onLayout: (layout: 'grid' | 'list') => void; onSelect: (id: string) => void; onView: (id: string) => void;
  onFavorite: (paste: Paste) => void; onFork: (paste: Paste) => void; onCopy: (paste: Paste) => void; onShare: (paste: Paste) => void;
  onDownload: (paste: Paste) => void; onDelete: (paste: Paste) => void; onPage?: (page: number) => void; onCreate?: () => void;
}) {
  return <section className="glass-card overflow-hidden" aria-labelledby="paste-list-title">
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] p-4 sm:p-5"><div><h2 id="paste-list-title" className="text-lg font-semibold">{title}</h2>{pagination && !loading && <p className="mt-1 text-xs text-gray-500">{pagination.total} result{pagination.total === 1 ? '' : 's'}</p>}</div><div className="flex rounded-lg border border-white/[0.06] p-1"><button aria-label="Grid view" onClick={() => onLayout('grid')} className={`rounded-md p-2 ${layout === 'grid' ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500'}`}><Grid2X2 className="h-4 w-4" /></button><button aria-label="List view" onClick={() => onLayout('list')} className={`rounded-md p-2 ${layout === 'list' ? 'bg-violet-500/20 text-violet-300' : 'text-gray-500'}`}><List className="h-4 w-4" /></button></div></div>
    {loading ? <Skeleton /> : pastes.length === 0 ? <div className="px-5 py-16 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/5 font-mono text-violet-400">{'{ }'}</div><p className="font-medium text-gray-300">No snippets match this view</p><p className="mt-1 text-sm text-gray-500">Try clearing filters or forge a new paste.</p>{onCreate && <button onClick={onCreate} className="btn-primary mt-4">Create paste</button>}</div> :
      <ul className={layout === 'grid' ? 'grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3' : 'divide-y divide-white/[0.04]'}>
        {pastes.map((paste) => <li key={paste.id} className={`${layout === 'grid' ? 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-violet-500/20 hover:bg-white/[0.035]' : 'p-4 hover:bg-white/[0.02] sm:p-5'}`}>
          <div className="flex items-start gap-2"><button aria-label={`${selected.has(paste.id) ? 'Deselect' : 'Select'} ${paste.title}`} onClick={() => onSelect(paste.id)} className="mt-0.5 text-gray-600 hover:text-violet-400">{selected.has(paste.id) ? <CheckSquare className="h-4 w-4 text-violet-400" /> : <Square className="h-4 w-4" />}</button><button onClick={() => onView(paste.id)} className="focus-ring min-w-0 flex-1 rounded text-left"><span className="block truncate text-sm font-semibold hover:text-violet-300">{paste.title}</span><span className="mt-1 block truncate font-mono text-xs text-gray-600">{paste.content.replace(/\s+/g, ' ').slice(0, 100)}</span></button><MoreHorizontal className="h-4 w-4 text-gray-700" /></div>
          {paste.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-gray-500">{paste.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1">{paste.tags.slice(0,3).map((tag) => <span key={tag} className="rounded-md bg-violet-500/8 px-2 py-1 text-[10px] text-violet-300">#{tag}</span>)}</div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-600"><span className="text-gray-400">{paste.language}</span><span className="capitalize">{paste.visibility}</span><span>{relative(paste.created_at)}</span><span>{paste.views} views</span><span>{paste.forks} forks</span></div>
          <div className="mt-3 flex items-center gap-0.5 border-t border-white/[0.04] pt-2">
            <button aria-label={`View ${paste.title}`} onClick={() => onView(paste.id)} className="icon-button !h-8 !w-8"><Eye className="h-3.5 w-3.5" /></button>
            <button aria-label={`${paste.favorite ? 'Unfavorite' : 'Favorite'} ${paste.title}`} onClick={() => onFavorite(paste)} className={`icon-button !h-8 !w-8 ${paste.favorite ? 'text-pink-400' : ''}`}><Heart className="h-3.5 w-3.5" fill={paste.favorite ? 'currentColor' : 'none'} /></button>
            {paste.visibility === 'public' && <button aria-label={`Fork ${paste.title}`} onClick={() => onFork(paste)} className="icon-button !h-8 !w-8"><GitFork className="h-3.5 w-3.5" /></button>}
            <button aria-label={`Copy ${paste.title}`} onClick={() => onCopy(paste)} className="icon-button !h-8 !w-8"><Copy className="h-3.5 w-3.5" /></button>
            <button aria-label={`Share ${paste.title}`} onClick={() => onShare(paste)} className="icon-button !h-8 !w-8"><Share2 className="h-3.5 w-3.5" /></button>
            <button aria-label={`Download ${paste.title}`} onClick={() => onDownload(paste)} className="icon-button !h-8 !w-8"><Download className="h-3.5 w-3.5" /></button>
            <button aria-label={`Delete ${paste.title}`} onClick={() => onDelete(paste)} className="icon-button !ml-auto !h-8 !w-8 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </li>)}
      </ul>}
    {pagination && pagination.pages > 1 && <div className="flex items-center justify-between border-t border-white/[0.05] p-4 text-sm"><button disabled={pagination.page <= 1} onClick={() => onPage?.(pagination.page - 1)} className="btn-secondary disabled:opacity-30">Previous</button><span className="text-xs text-gray-500">Page {pagination.page} of {pagination.pages}</span><button disabled={pagination.page >= pagination.pages} onClick={() => onPage?.(pagination.page + 1)} className="btn-secondary disabled:opacity-30">Next</button></div>}
  </section>;
}

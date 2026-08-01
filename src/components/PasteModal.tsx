import { Check, Clock3, Code2, Copy, Download, Edit3, ExternalLink, GitFork, Heart, History, LoaderCircle, Maximize2, QrCode, RotateCcw, Share2, Trash2, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Paste } from '../types';

function formatServerDate(value: string, withTime = false) {
  const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export default function PasteModal({ paste, loading, error, onClose, onRetry, onEdit, onFavorite, onFork, onDelete, notify }: {
  paste: Paste | null; loading: boolean; error: string; onClose: () => void; onRetry: () => void; onEdit: (paste: Paste) => void;
  onFavorite: (paste: Paste) => void; onFork: (paste: Paste) => void; onDelete: (paste: Paste) => void; notify: (message: string) => void;
}) {
  const [copied, setCopied] = useState('');
  const [reading, setReading] = useState(false);
  const [qr, setQr] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [revisions, setRevisions] = useState<(Paste & { current: boolean })[]>([]);
  const [compareVersion, setCompareVersion] = useState<number | null>(null);
  const close = useRef<HTMLButtonElement>(null);
  const url = paste ? `${location.origin}${location.pathname}?paste=${encodeURIComponent(paste.id)}` : '';
  useEffect(() => { close.current?.focus(); const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  useEffect(() => { if (url) void QRCode.toDataURL(url, { width: 260, margin: 2, color: { dark: '#17152e', light: '#ffffff' } }).then(setQr); }, [url]);
  useEffect(() => {
    document.title = paste ? `${paste.title} · PasteBin` : 'PasteBin';
    return () => { document.title = 'PasteBin'; };
  }, [paste]);
  async function copy(value: string, type: string) { try { await navigator.clipboard.writeText(value); setCopied(type); notify(`${type} copied.`); setTimeout(() => setCopied(''), 1500); } catch { notify('Clipboard access was unavailable.'); } }
  async function history() { if (!paste) return; setShowHistory(true); try { setRevisions((await api.revisions(paste.id)).data); } catch (e) { notify(e instanceof Error ? e.message : 'Could not load history.'); } }
  async function restore(version: number) { if (!paste) return; try { await api.restore(paste.id, version); notify(`Version ${version} restored as a new revision.`); onRetry(); setShowHistory(false); } catch (e) { notify(e instanceof Error ? e.message : 'Restore failed.'); } }
  const expires = paste?.expires_at ? Math.max(0, new Date(paste.expires_at).getTime() - Date.now()) : null;

  return <div className={`fixed inset-0 z-50 flex bg-black/80 backdrop-blur-sm ${reading ? 'p-0' : 'items-center justify-center p-3'}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section role="dialog" aria-modal="true" aria-labelledby="detail-title" className={`${reading ? 'h-full w-full rounded-none' : 'max-h-[94vh] w-full max-w-5xl rounded-2xl'} overflow-y-auto border border-white/[0.08] bg-dark-950 shadow-2xl`}>
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-dark-950/95 p-4 backdrop-blur-xl sm:p-5"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400"><span>{paste?.language || 'Paste'}</span>{paste && <><span>·</span><span className="capitalize">{paste.visibility}</span><span>·</span><span>v{paste.version}</span></>}</div><h2 id="detail-title" className="truncate text-xl font-bold sm:text-2xl">{paste?.title || (loading ? 'Loading snippet…' : 'Unable to open snippet')}</h2></div><div className="flex gap-1"><button aria-label="Toggle reading mode" onClick={() => setReading(!reading)} className="icon-button"><Maximize2 className="h-4 w-4" /></button><button ref={close} aria-label="Close paste" onClick={onClose} className="icon-button"><X className="h-5 w-5" /></button></div></header>
      <div className={`mx-auto ${reading ? 'max-w-5xl' : ''} p-4 sm:p-6`}>
        {loading && <div role="status" className="flex min-h-96 items-center justify-center gap-2 text-sm text-gray-400"><LoaderCircle className="h-5 w-5 animate-spin" />Loading paste…</div>}
        {!loading && error && <div role="alert" className="error-banner"><span>{error}</span><button onClick={onRetry} className="underline">Retry</button></div>}
        {!loading && paste && <>
          {paste.source_id && <button onClick={() => { location.href = `${location.pathname}?paste=${paste.source_id}`; }} className="mb-4 flex items-center gap-2 text-sm text-violet-400"><GitFork className="h-4 w-4" />Forked from {paste.source_id}</button>}
          {paste.description && <p className="mb-4 max-w-3xl text-sm leading-6 text-gray-400">{paste.description}</p>}
          <div className="mb-4 flex flex-wrap items-center gap-2">{paste.tags.map((tag) => <span key={tag} className="badge bg-violet-500/10 text-violet-300">#{tag}</span>)}</div>
          <div className="mb-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">{[
            ['Views', paste.views], ['Favorites', paste.favorite ? 1 : 0], ['Forks', paste.forks], ['Size', `${new Blob([paste.content]).size} B`],
            ['Created', formatServerDate(paste.created_at)], ['Updated', formatServerDate(paste.updated_at)], ['Expires', expires === null ? 'Never' : expires < 60_000 ? '< 1 min' : `${Math.ceil(expires / 60_000)} min`],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.025] p-3"><span className="block text-gray-600">{label}</span><span className="mt-1 block truncate font-semibold text-gray-300">{value}</span></div>)}</div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button onClick={() => void copy(paste.content, 'Content')} className="action-chip">{copied === 'Content' ? <Check /> : <Copy />}Copy</button>
            {paste.visibility !== 'secret' && <><button onClick={() => void copy(url, 'Link')} className="action-chip"><Share2 />Share</button>
            <button onClick={() => setShowQr(!showQr)} className="action-chip"><QrCode />QR</button>
            <a href={api.rawUrl(paste.id)} target="_blank" rel="noreferrer" className="action-chip"><ExternalLink />Raw</a>
            <a href={api.rawUrl(paste.id, true)} className="action-chip"><Download />Download</a>
            <button onClick={() => onEdit(paste)} className="action-chip"><Edit3 />Edit</button>
            <button onClick={() => onFavorite(paste)} className={`action-chip ${paste.favorite ? '!text-pink-400' : ''}`}><Heart fill={paste.favorite ? 'currentColor' : 'none'} />{paste.favorite ? 'Favorited' : 'Favorite'}</button>
            {paste.visibility === 'public' && <button onClick={() => onFork(paste)} className="action-chip"><GitFork />Fork</button>}
            <button onClick={() => void history()} className="action-chip"><History />History</button>
            <button onClick={() => onDelete(paste)} className="action-chip hover:!text-red-300"><Trash2 />Delete</button></>}
          </div>
          {showQr && qr && <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.06] bg-white p-4 text-dark-950"><img src={qr} alt={`QR code for ${paste.title}`} className="h-40 w-40" /><div><p className="font-semibold">Scan to open this paste</p><p className="mt-1 max-w-xs text-xs text-gray-600">Generated locally; the URL is never sent to a third party.</p><a href={qr} download={`${paste.title.replace(/[^\w]+/g, '-')}-qr.png`} className="mt-3 inline-block text-sm font-semibold text-violet-700 underline">Download QR</a></div></div>}
          {showHistory && <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"><h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4 text-violet-400" />Revision history</h3>{revisions.length === 0 ? <p className="text-sm text-gray-500">Loading revisions…</p> : <div className="space-y-2">{revisions.map((revision) => <div key={revision.version} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] p-3"><div><p className="text-sm font-medium">Version {revision.version}{revision.current ? ' · Current' : ''}</p><p className="text-xs text-gray-600">{formatServerDate(revision.updated_at || revision.created_at, true)} · {revision.content.split('\n').length} lines</p></div>{!revision.current && <div className="flex gap-1"><button onClick={() => setCompareVersion(compareVersion === revision.version ? null : revision.version)} className="action-chip">Compare</button><button onClick={() => void restore(revision.version)} className="action-chip"><RotateCcw />Restore</button></div>}</div>)}</div>}{compareVersion && (() => { const older = revisions.find((revision) => revision.version === compareVersion); if (!older) return null; const oldLines = older.content.split('\n'); const newLines = paste.content.split('\n'); const count = Math.max(oldLines.length, newLines.length); return <div className="mt-3 overflow-auto rounded-lg border border-white/[0.06] bg-[#0d0e1a] p-3 font-mono text-xs" aria-label={`Line comparison of version ${compareVersion} and current version`}><p className="mb-2 font-sans font-semibold text-gray-400">Version {compareVersion} → Version {paste.version}</p>{Array.from({ length: count }, (_, index) => oldLines[index] === newLines[index] ? <div key={index} className="text-gray-600"> {newLines[index] ?? ''}</div> : <div key={index}>{oldLines[index] !== undefined && <div className="bg-red-500/10 text-red-300">- {oldLines[index]}</div>}{newLines[index] !== undefined && <div className="bg-emerald-500/10 text-emerald-300">+ {newLines[index]}</div>}</div>)}</div>; })()}</div>}
          <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d0e1a]"><div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2 text-xs text-gray-600"><Code2 className="h-3.5 w-3.5" />{paste.language}<span className="ml-auto">{paste.content.split('\n').length} lines</span></div><div className="flex max-h-[60vh] overflow-auto"><pre aria-hidden="true" className="select-none border-r border-white/[0.05] px-3 py-4 text-right font-mono text-[13px] leading-6 text-gray-700">{paste.content.split('\n').map((_, i) => i + 1).join('\n')}</pre><pre className="min-w-0 flex-1 overflow-visible whitespace-pre p-4 font-mono text-[13px] leading-6 text-gray-200"><code>{paste.content}</code></pre></div></div>
        </>}
      </div>
    </section>
  </div>;
}

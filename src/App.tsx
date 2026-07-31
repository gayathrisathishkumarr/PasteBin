import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity as ActivityIcon, ArrowRight, CheckCircle2, ChevronRight, Clock3, Code2, Database, FileJson, FileUp, Heart, Keyboard, LayoutTemplate, LoaderCircle, Play, Search, Server, Sparkles, TerminalSquare, Trash2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ApiError, api } from './api';
import NewPasteForm from './components/NewPasteForm';
import PasteModal from './components/PasteModal';
import RecentPastes from './components/RecentPastes';
import Sidebar, { type View } from './components/Sidebar';
import StatsCards, { formatBytes } from './components/StatsCards';
import TopNav from './components/TopNav';
import type { Activity, Analytics, Pagination, Paste, PasteInput, Stats } from './types';
import { acceptedTextFiles, isSupportedTextFile, languageForFile } from './fileTypes';

const emptyStats: Stats = { total: 0, public: 0, favorites: 0, views: 0, forks: 0, bytes: 0, active: 0, expired: 0 };
const storageKeys = { layout: 'pastebin:layout', preferences: 'pastebin:preferences', draft: 'pastebin:draft' };
const legacyKeys = { layout: 'pasteforge:layout', preferences: 'pasteforge:preferences', draft: 'pasteforge:draft' };
type Preferences = { theme: 'dark' | 'light' | 'system'; fontSize: number; tabSize: number; language: string; visibility: 'public' | 'unlisted'; density: 'comfortable' | 'compact'; reducedMotion: boolean; autosave: boolean };
const defaults: Preferences = { theme: 'dark', fontSize: 13, tabSize: 2, language: 'Plain Text', visibility: 'public', density: 'comfortable', reducedMotion: false, autosave: true };

function route() {
  const params = new URLSearchParams(location.search);
  const requested = params.get('view') as View | null;
  const views: View[] = ['dashboard','new','pastes','explore','favorites','analytics','api','settings'];
  return views.includes(requested as View) ? requested! : 'dashboard';
}
function shareUrl(id: string) { return `${location.origin}${location.pathname}?paste=${encodeURIComponent(id)}`; }
function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const prefix: Record<string, string> = { OFFLINE: 'Offline: ', EXPIRED: 'Expired: ', NOT_FOUND: 'Not found: ', RATE_LIMITED: 'Please slow down: ', VALIDATION_ERROR: 'Check your input: ' };
    return `${prefix[error.code] || ''}${error.message}`;
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export default function App() {
  const [view, setView] = useState<View>(route);
  const [navOpen, setNavOpen] = useState(false);
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 12, total: 0, pages: 0 });
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [health, setHealth] = useState({ api: false, database: false, uptime: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const [language, setLanguage] = useState(() => new URLSearchParams(location.search).get('language') || '');
  const [visibility, setVisibility] = useState(() => new URLSearchParams(location.search).get('visibility') || '');
  const [sort, setSort] = useState(() => new URLSearchParams(location.search).get('sort') || 'newest');
  const [page, setPage] = useState(() => Number(new URLSearchParams(location.search).get('page')) || 1);
  const [layout, setLayout] = useState<'grid' | 'list'>(() => (localStorage.getItem(storageKeys.layout) || localStorage.getItem(legacyKeys.layout) || 'grid') as 'grid' | 'list');
  const [selectedIds, setSelectedIds] = useState(new Set<string>());
  const [selected, setSelected] = useState<Paste | null>(null);
  const [pasteId, setPasteId] = useState(() => new URLSearchParams(location.search).get('paste'));
  const [pasteLoading, setPasteLoading] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [secretMeta, setSecretMeta] = useState<{ id: string; title: string } | null>(null);
  const [editing, setEditing] = useState<Paste | null>(null);
  const [notice, setNotice] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; message: string; action: () => Promise<void> } | null>(null);
  const [palette, setPalette] = useState(false);
  const [importPreview, setImportPreview] = useState<PasteInput[] | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(() => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(storageKeys.preferences) || localStorage.getItem(legacyKeys.preferences) || '{}') }; } catch { return defaults; } });
  const importInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const searchController = useRef<AbortController | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: view === 'dashboard' ? '6' : '12', sort });
    if (search) params.set('search', search);
    if (language) params.set('language', language);
    if (visibility) params.set('visibility', visibility);
    if (view === 'explore') params.set('scope', 'public');
    if (view === 'favorites') params.set('scope', 'favorites');
    return params;
  }, [page, sort, search, language, visibility, view]);

  const load = useCallback(async () => {
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    setLoading(true); setError('');
    try {
      const [list, analysis, events, status] = await Promise.all([api.list(query, controller.signal), api.analytics(), api.activity(), api.health()]);
      setPastes(list.data); setPagination(list.pagination); setAnalytics(analysis); setActivity(events.data);
      setHealth({ api: status[0].status === 'ok', database: status[1].status === 'ready', uptime: status[0].uptimeSeconds });
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(errorMessage(e)); }
    finally { setLoading(false); }
  }, [query]);

  useEffect(() => { const timer = setTimeout(() => void load(), search ? 260 : 0); return () => clearTimeout(timer); }, [load, search]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (view !== 'dashboard') params.set('view', view); else params.delete('view');
    for (const [key, value] of [['search', search], ['language', language], ['visibility', visibility], ['sort', sort === 'newest' ? '' : sort], ['page', page === 1 ? '' : String(page)]]) value ? params.set(key, value) : params.delete(key);
    history.replaceState({}, '', `${location.pathname}?${params}`.replace(/\?$/, ''));
  }, [view, search, language, visibility, sort, page]);
  useEffect(() => {
    const sync = () => { setView(route()); const params = new URLSearchParams(location.search); setSearch(params.get('search') || ''); setLanguage(params.get('language') || ''); setVisibility(params.get('visibility') || ''); setSort(params.get('sort') || 'newest'); setPage(Number(params.get('page')) || 1); const id = params.get('paste'); if (id) void openPaste(id, false); else { setPasteId(null); setSelected(null); } };
    addEventListener('popstate', sync); return () => removeEventListener('popstate', sync);
  }, []);
  useEffect(() => { const id = new URLSearchParams(location.search).get('paste'); if (id) void openPaste(id, false); }, []);
  useEffect(() => {
    localStorage.setItem(storageKeys.preferences, JSON.stringify(prefs));
    const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('light', prefs.theme === 'light' || (prefs.theme === 'system' && !systemDark));
    document.documentElement.classList.toggle('reduce-motion', prefs.reducedMotion);
    document.documentElement.classList.toggle('compact', prefs.density === 'compact');
    document.documentElement.style.setProperty('--editor-size', `${prefs.fontSize}px`);
  }, [prefs]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(true); } }; addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, []);
  useEffect(() => {
    const closeDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (importPreview) setImportPreview(null);
      else if (deleteConfirm) setDeleteConfirm(null);
      else if (secretMeta) closePaste();
    };
    addEventListener('keydown', closeDialog);
    return () => removeEventListener('keydown', closeDialog);
  }, [importPreview, deleteConfirm, secretMeta]);
  useEffect(() => { if (notice) { const id = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(id); } }, [notice]);

  function navigate(next: View) {
    setView(next); setPage(1); setSearch(''); setLanguage(''); setVisibility(''); setSort(next === 'explore' ? 'trending' : 'newest'); setPalette(false);
    const params = new URLSearchParams(); if (next !== 'dashboard') params.set('view', next); history.pushState({}, '', `${location.pathname}?${params}`);
  }
  async function openPaste(id: string, updateUrl = true, confirmed = false) {
    setPasteId(id); setPasteError(''); setSelected(null);
    if (updateUrl) { const params = new URLSearchParams(location.search); params.set('paste', id); history.pushState({}, '', `${location.pathname}?${params}`); }
    setPasteLoading(true);
    try {
      const meta = await api.meta(id);
      if (meta.visibility === 'secret' && !confirmed) { setSecretMeta({ id, title: meta.title }); setPasteLoading(false); return; }
      setSelected(await api.get(id)); void load();
    } catch (e) { setPasteError(errorMessage(e)); } finally { setPasteLoading(false); }
  }
  function closePaste() { setPasteId(null); setSelected(null); setSecretMeta(null); const params = new URLSearchParams(location.search); params.delete('paste'); history.pushState({}, '', `${location.pathname}?${params}`); }
  async function savePaste(data: PasteInput) {
    if (saving) return; setSaving(true); setError('');
    try {
      const result = editing ? await api.update(editing.id, data) : await api.create(data);
      setEditing(null); setNotice(editing ? 'New revision saved.' : 'Paste created successfully.'); await load(); navigate('pastes'); await openPaste(result.id);
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  async function favorite(paste: Paste) { try { const updated = await api.favorite(paste.id, !paste.favorite); setPastes((items) => items.map((item) => item.id === updated.id ? updated : item)); if (selected?.id === updated.id) setSelected(updated); setNotice(updated.favorite ? 'Added to favorites.' : 'Removed from favorites.'); } catch (e) { setNotice(errorMessage(e)); } }
  async function fork(paste: Paste) { try { const result = await api.fork(paste.id); setNotice('Remix created without changing the original.'); await load(); await openPaste(result.id); } catch (e) { setNotice(errorMessage(e)); } }
  async function copy(value: string, label = 'Content') { try { await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); } catch { setNotice('Clipboard access was unavailable.'); } }
  function askDelete(paste: Paste) { setDeleteConfirm({ title: `Delete “${paste.title}”?`, message: 'This permanently removes the paste and its revision history.', action: async () => { await api.delete(paste.id); if (selected?.id === paste.id) closePaste(); setNotice('Paste deleted.'); await load(); } }); }
  async function bulkDelete() { const ids = [...selectedIds]; for (const id of ids) await api.delete(id); setSelectedIds(new Set()); setNotice(`${ids.length} pastes deleted.`); await load(); }
  async function exportIds(ids: string[]) { try { const result = await api.export(ids); const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'pastebin-export.json'; link.click(); URL.revokeObjectURL(link.href); setNotice(`${ids.length} pastes exported.`); } catch (e) { setNotice(errorMessage(e)); } }
  async function importJson(file?: File) { if (!file) return; try { const parsed = JSON.parse(await file.text()); const items = Array.isArray(parsed) ? parsed : parsed.pastes; if (!Array.isArray(items) || items.length < 1 || items.length > 50) throw new Error('Expected a PasteBin export containing 1–50 pastes.'); setImportPreview(items); } catch (e) { setNotice(errorMessage(e)); } }
  async function confirmImport() { if (!importPreview) return; try { const result = await api.import(importPreview); setImportPreview(null); setNotice(`${result.imported} pastes imported.`); navigate('pastes'); await load(); } catch (e) { setNotice(errorMessage(e)); } }
  async function uploadAsDraft(file?: File) { if (!file) return; if (!isSupportedTextFile(file)) return setNotice('That file type is not supported. Choose a text or source-code file.'); if (file.size > 100_000) return setNotice('Choose a text file under 100 KB.'); const content = await file.text(); localStorage.setItem(storageKeys.draft, JSON.stringify({ title: file.name.replace(/\.[^.]+$/, ''), description: '', content, language: languageForFile(file), visibility: prefs.visibility, tags: [], expiresAt: null })); navigate('new'); }

  const actions = { onView: (id: string) => void openPaste(id), onFavorite: (p: Paste) => void favorite(p), onFork: (p: Paste) => void fork(p), onCopy: (p: Paste) => void copy(p.content), onShare: (p: Paste) => void copy(shareUrl(p.id), 'Link'), onDownload: (p: Paste) => { location.href = api.rawUrl(p.id, true); }, onDelete: askDelete };
  const list = <RecentPastes pastes={pastes} pagination={pagination} loading={loading} title={view === 'explore' ? 'Public snippets' : view === 'favorites' ? 'Favorite snippets' : view === 'dashboard' ? 'Recent work' : 'Your library'} layout={layout} selected={selectedIds} onLayout={(value) => { setLayout(value); localStorage.setItem(storageKeys.layout, value); }} onSelect={(id) => setSelectedIds((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; })} {...actions} onPage={setPage} onCreate={() => navigate('new')} />;
  const bars = (items: { label: string; value: number }[], color = 'bg-violet-500') => <div className="space-y-3" role="list">{items.map((item) => { const max = Math.max(...items.map((x) => x.value), 1); return <div key={item.label} role="listitem"><div className="mb-1 flex justify-between text-xs"><span className="text-gray-400">{item.label}</span><span className="font-semibold">{item.value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.04]"><div className={`h-full rounded-full ${color}`} style={{ width: `${(item.value / max) * 100}%` }} /></div></div>; })}</div>;

  return <div className="min-h-screen bg-dark-950 font-sans text-white">
    <a href="#main-content" className="sr-only z-[100] bg-violet-600 p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to main content</a>
    <Sidebar open={navOpen} view={view} onOpen={() => setNavOpen(true)} onClose={() => setNavOpen(false)} onNavigate={navigate} />
    <div className="min-h-screen lg:ml-[250px]"><TopNav search={search} onSearch={(value) => { setSearch(value); setPage(1); }} onCreate={() => navigate('new')} onPalette={() => setPalette(true)} showSearch={['pastes','explore','favorites'].includes(view)} />
      <main id="main-content" className={`p-4 sm:p-6 ${prefs.density === 'compact' ? 'density-compact' : ''}`}>
        {view === 'dashboard' && <div className="mx-auto max-w-7xl space-y-6">
          <section className="hero-panel relative overflow-hidden rounded-2xl border border-violet-500/15 p-6 sm:p-9"><div className="absolute right-8 top-8 hidden h-28 w-28 rotate-6 items-center justify-center rounded-3xl border border-violet-400/10 bg-violet-500/5 lg:flex"><Code2 className="h-12 w-12 text-violet-400/30" /></div><div className="relative"><p className="flex items-center gap-2 text-sm font-semibold text-violet-400"><Sparkles className="h-4 w-4" />Your developer knowledge base</p><h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">Forge snippets.<br/><span className="text-gradient">Share understanding.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-gray-400">A focused workspace for code that deserves to be found, remixed, versioned, and remembered.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={() => navigate('new')} className="btn-primary">Create a paste</button><button onClick={() => navigate('explore')} className="btn-secondary flex items-center gap-2">Explore public work <ArrowRight className="h-4 w-4" /></button></div></div></section>
          <StatsCards stats={analytics?.stats || emptyStats} />
          {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => void load()} className="underline">Retry</button></div>}
          <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><div>{list}</div><aside className="space-y-5">
            <section className="glass-card p-5"><h2 className="mb-4 text-sm font-semibold">Quick launch</h2><div className="grid grid-cols-2 gap-2">{([
              ['New Paste', FileUp, () => navigate('new')], ['Upload File', FileUp, () => uploadInput.current?.click()], ['Choose Template', LayoutTemplate, () => navigate('new')], ['Import JSON', FileJson, () => importInput.current?.click()], ['API Playground', TerminalSquare, () => navigate('api')],
            ] as [string, LucideIcon, () => void][]).map(([label, Icon, action]) => <button key={label} onClick={action} className="focus-ring rounded-xl border border-white/[0.05] bg-white/[0.025] p-3 text-left hover:border-violet-500/20"><Icon className="mb-2 h-4 w-4 text-violet-400" /><span className="text-xs font-medium">{label}</span></button>)}</div><input ref={uploadInput} type="file" className="sr-only" accept={acceptedTextFiles} onChange={(e) => void uploadAsDraft(e.target.files?.[0])} /><input ref={importInput} type="file" className="sr-only" accept=".json,application/json" onChange={(e) => void importJson(e.target.files?.[0])} /></section>
            <section className="glass-card p-5"><h2 className="mb-4 text-sm font-semibold">System pulse</h2><div className="space-y-3"><div className="status-row"><Server />API service<span className={health.api ? 'status-ok' : 'status-bad'}>{health.api ? 'Healthy' : 'Unavailable'}</span></div><div className="status-row"><Database />SQLite database<span className={health.database ? 'status-ok' : 'status-bad'}>{health.database ? 'Ready' : 'Unavailable'}</span></div><div className="status-row"><Clock3 />API uptime<span className="ml-auto text-xs text-gray-400">{Math.floor(health.uptime / 60)}m</span></div></div></section>
            <section className="glass-card p-5"><h2 className="mb-4 text-sm font-semibold">Trending languages</h2>{analytics?.languages.length ? bars(analytics.languages.slice(0,5), 'bg-gradient-to-r from-violet-500 to-cyan-400') : <p className="text-xs text-gray-500">Create pastes to see language trends.</p>}</section>
            <section className="glass-card p-5"><h2 className="mb-4 text-sm font-semibold">Recent activity</h2>{activity.length ? <ol className="space-y-3">{activity.slice(0,6).map((event) => <li key={event.id} className="flex gap-3 text-xs"><ActivityIcon className="mt-0.5 h-3.5 w-3.5 text-violet-400" /><span className="min-w-0"><span className="capitalize text-gray-300">{event.type}</span> <span className="truncate text-gray-500">{event.detail}</span><time className="mt-0.5 block text-[10px] text-gray-700">{new Date(`${event.created_at.replace(' ', 'T')}Z`).toLocaleString()}</time></span></li>)}</ol> : <p className="text-xs text-gray-500">Real activity appears here as you work.</p>}</section>
          </aside></div>
        </div>}
        {view === 'new' && <NewPasteForm saving={saving} error={error} initial={editing} autosave={prefs.autosave} tabSize={prefs.tabSize} defaults={{ language: prefs.language, visibility: prefs.visibility }} onSubmit={savePaste} onCancel={editing ? () => { setEditing(null); navigate('pastes'); } : undefined} />}
        {['pastes','explore','favorites'].includes(view) && <div className="mx-auto max-w-7xl"><div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold text-violet-400">{view === 'explore' ? 'Community signal' : view === 'favorites' ? 'Pinned knowledge' : 'Snippet library'}</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{view === 'explore' ? 'Explore' : view === 'favorites' ? 'Favorites' : 'My Pastes'}</h1><p className="mt-2 text-sm text-gray-500">{view === 'explore' ? 'Only active public pastes appear here.' : 'Filter, sort, export, and manage persisted snippets.'}</p></div>{selectedIds.size > 0 && <div className="flex gap-2"><button onClick={() => void exportIds([...selectedIds])} className="btn-secondary">Export {selectedIds.size}</button><button onClick={() => setDeleteConfirm({ title: `Delete ${selectedIds.size} pastes?`, message: 'This bulk action cannot be undone.', action: bulkDelete })} className="btn-secondary !text-red-300">Delete selected</button></div>}</div>
          <div className="mb-4 grid gap-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 sm:grid-cols-4"><select aria-label="Filter language" className="field !py-2" value={language} onChange={(e) => { setLanguage(e.target.value); setPage(1); }}><option value="">All languages</option>{['JavaScript','TypeScript','React','Java','Python','SQL','JSON','YAML','Markdown','Bash','Plain Text'].map((v) => <option key={v}>{v}</option>)}</select>{view !== 'explore' && <select aria-label="Filter visibility" className="field !py-2" value={visibility} onChange={(e) => { setVisibility(e.target.value); setPage(1); }}><option value="">All visibility</option><option value="public">Public</option><option value="unlisted">Unlisted</option></select>}<select aria-label="Sort pastes" className="field !py-2" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="views">Most viewed</option><option value="forks">Most forked</option><option value="trending">Trending</option><option value="title">Title</option><option value="size">Size</option></select><button onClick={() => { setSearch(''); setLanguage(''); setVisibility(''); setSort(view === 'explore' ? 'trending' : 'newest'); setPage(1); }} className="btn-secondary">Clear filters</button></div>
          {error && <div className="error-banner mb-4"><span>{error}</span><button onClick={() => void load()} className="underline">Retry</button></div>}{list}</div>}
        {view === 'analytics' && <div className="mx-auto max-w-7xl space-y-6"><div><p className="text-sm font-semibold text-violet-400">Measured, never invented</p><h1 className="mt-1 text-3xl font-bold">Analytics</h1><p className="mt-2 text-sm text-gray-500">Every number below comes directly from SQLite events and aggregates.</p></div><StatsCards stats={analytics?.stats || emptyStats} /><div className="grid gap-5 lg:grid-cols-2">{[['Pastes by language', analytics?.languages || [], 'bg-violet-500'], ['Pastes by visibility', analytics?.visibility || [], 'bg-cyan-500'], ['Pastes created over time', analytics?.created || [], 'bg-emerald-500'], ['Views over time', analytics?.viewsOverTime || [], 'bg-blue-500']].map(([title, items, color]) => <section key={title as string} className="glass-card p-5"><h2 className="mb-5 font-semibold">{title as string}</h2>{(items as {label:string;value:number}[]).length ? bars(items as {label:string;value:number}[], color as string) : <p className="text-sm text-gray-500">No data yet.</p>}</section>)}</div><div className="grid gap-5 lg:grid-cols-2"><section className="glass-card p-5"><h2 className="mb-4 font-semibold">Most viewed</h2>{bars((analytics?.mostViewed || []).map((x) => ({ label: x.title, value: x.value })), 'bg-emerald-500')}</section><section className="glass-card p-5"><h2 className="mb-4 font-semibold">Most forked</h2>{bars((analytics?.mostForked || []).map((x) => ({ label: x.title, value: x.value })), 'bg-blue-500')}</section></div><section className="glass-card p-5 text-sm text-gray-400"><p>{analytics?.stats.active || 0} active · {analytics?.stats.expired || 0} expired · {formatBytes(analytics?.stats.bytes || 0)} stored · API uptime {Math.floor((analytics?.uptimeSeconds || 0) / 60)} minutes</p></section></div>}
        {view === 'api' && <ApiPlayground notify={setNotice} />}
        {view === 'settings' && <Settings preferences={prefs} onChange={setPrefs} onClear={() => { localStorage.removeItem(storageKeys.preferences); localStorage.removeItem(legacyKeys.preferences); setPrefs(defaults); setNotice('Local preferences reset.'); }} />}
      </main>
    </div>
    {pasteId && !secretMeta && <PasteModal paste={selected} loading={pasteLoading} error={pasteError} onClose={closePaste} onRetry={() => void openPaste(pasteId, false, true)} onEdit={(paste) => { setEditing(paste); closePaste(); navigate('new'); }} onFavorite={(paste) => void favorite(paste)} onFork={(paste) => void fork(paste)} onDelete={askDelete} notify={setNotice} />}
    {secretMeta && <div className="modal-backdrop"><section role="alertdialog" aria-modal="true" className="glass-card max-w-md p-6"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300"><Trash2 /></div><h2 className="text-xl font-bold">Burn-after-reading secret</h2><p className="mt-2 text-sm leading-6 text-gray-400">“{secretMeta.title}” will be permanently deleted as soon as it opens. It can only be retrieved once.</p><div className="mt-5 flex justify-end gap-2"><button autoFocus onClick={closePaste} className="btn-secondary">Cancel</button><button onClick={() => { const id = secretMeta.id; setSecretMeta(null); void openPaste(id, false, true); }} className="btn-primary !from-amber-600 !to-orange-600">Open and burn</button></div></section></div>}
    {deleteConfirm && <div className="modal-backdrop"><section role="alertdialog" aria-modal="true" className="glass-card max-w-md p-6"><h2 className="text-xl font-bold">{deleteConfirm.title}</h2><p className="mt-2 text-sm leading-6 text-gray-400">{deleteConfirm.message}</p><div className="mt-5 flex justify-end gap-2"><button autoFocus onClick={() => setDeleteConfirm(null)} className="btn-secondary">Cancel</button><button onClick={() => { const action = deleteConfirm.action; setDeleteConfirm(null); void action().catch((e) => setNotice(errorMessage(e))); }} className="btn-primary !from-red-600 !to-rose-600">Delete</button></div></section></div>}
    {importPreview && <div className="modal-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="import-title" className="glass-card w-full max-w-lg p-6"><h2 id="import-title" className="text-xl font-bold">Preview JSON import</h2><p className="mt-2 text-sm text-gray-400">The API will validate all {importPreview.length} pastes before saving.</p><ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">{importPreview.map((item, index) => <li key={`${item.title}-${index}`} className="rounded-lg border border-white/[0.05] p-3"><p className="truncate text-sm font-medium">{item.title || 'Untitled (invalid)'}</p><p className="mt-1 text-xs text-gray-600">{item.language || 'Unknown'} · {item.content?.length || 0} characters</p></li>)}</ul><div className="mt-5 flex justify-end gap-2"><button autoFocus onClick={() => setImportPreview(null)} className="btn-secondary">Cancel</button><button onClick={() => void confirmImport()} className="btn-primary">Validate and import</button></div></section></div>}
    {palette && <CommandPalette onClose={() => setPalette(false)} onNavigate={navigate} />}
    {notice && <div role="status" aria-live="polite" className="fixed bottom-4 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-dark-800 px-4 py-3 text-sm shadow-2xl"><CheckCircle2 className="h-4 w-4 text-emerald-400" />{notice}</div>}
  </div>;
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  const [query, setQuery] = useState('');
  const commands: { label: string; hint: string; view?: View; href?: string }[] = [
    { label: 'New Paste', hint: 'Create', view: 'new' }, { label: 'Search Pastes', hint: 'Find', view: 'pastes' }, { label: 'My Pastes', hint: 'Library', view: 'pastes' }, { label: 'Explore', hint: 'Public', view: 'explore' }, { label: 'Favorites', hint: 'Pinned', view: 'favorites' }, { label: 'Analytics', hint: 'Metrics', view: 'analytics' }, { label: 'API Docs', hint: 'REST', href: api.docsUrl }, { label: 'Settings', hint: 'Local', view: 'settings' },
  ];
  const filtered = commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, [onClose]);
  return <div className="modal-backdrop !items-start pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-dark-900 shadow-2xl"><label className="flex items-center gap-3 border-b border-white/[0.06] px-4"><Search className="h-5 w-5 text-violet-400" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a command…" className="h-14 flex-1 bg-transparent text-sm outline-none" /><button aria-label="Close" onClick={onClose}><X className="h-4 w-4 text-gray-500" /></button></label><div className="max-h-96 overflow-y-auto p-2">{filtered.map((item) => <button key={item.label} onClick={() => item.href ? open(item.href, '_blank') : onNavigate(item.view!)} className="flex w-full items-center rounded-xl px-3 py-3 text-left text-sm text-gray-300 hover:bg-violet-500/10 hover:text-white"><Keyboard className="mr-3 h-4 w-4 text-violet-400" />{item.label}<span className="ml-auto text-xs text-gray-600">{item.hint}</span><ChevronRight className="ml-2 h-3 w-3 text-gray-700" /></button>)}</div></section></div>;
}

function ApiPlayground({ notify }: { notify: (message: string) => void }) {
  const [endpoint, setEndpoint] = useState('/health'); const [result, setResult] = useState(''); const [running, setRunning] = useState(false);
  async function run() { setRunning(true); try { const response = await fetch(endpoint); setResult(JSON.stringify(await response.json(), null, 2)); notify(`GET ${endpoint} returned ${response.status}.`); } catch (e) { setResult(errorMessage(e)); } finally { setRunning(false); } }
  const endpoints = ['/health','/ready','/metrics','/api/pastes?scope=public&limit=5','/api/analytics','/openapi.json'];
  return <div className="mx-auto max-w-6xl space-y-6"><div><p className="text-sm font-semibold text-violet-400">REST API v2</p><h1 className="mt-1 text-3xl font-bold">API Playground</h1><p className="mt-2 text-sm text-gray-500">Run safe GET requests against the same API that powers this interface.</p></div><div className="grid gap-5 lg:grid-cols-[320px_1fr]"><section className="glass-card p-5"><h2 className="mb-3 font-semibold">Endpoints</h2><div className="space-y-2">{endpoints.map((item) => <button key={item} onClick={() => setEndpoint(item)} className={`w-full rounded-lg border px-3 py-2 text-left font-mono text-xs ${endpoint === item ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-white/[0.05] text-gray-500 hover:text-white'}`}>GET {item}</button>)}</div><div className="mt-5 space-y-2"><a href={api.docsUrl} target="_blank" className="btn-secondary block text-center">Human-readable docs</a><a href={api.openapiUrl} target="_blank" className="btn-secondary block text-center">OpenAPI JSON</a></div></section><section className="glass-card overflow-hidden"><div className="flex gap-2 border-b border-white/[0.06] p-4"><input aria-label="GET endpoint" className="field font-mono" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} /><button onClick={() => void run()} disabled={running || !endpoint.startsWith('/')} className="btn-primary flex items-center gap-2">{running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run</button></div><pre className="min-h-[420px] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-6 text-emerald-300">{result || `curl ${location.origin}${endpoint}`}</pre></section></div><section className="glass-card p-5"><h2 className="font-semibold">Validation contract</h2><p className="mt-2 text-sm leading-6 text-gray-500">Titles: 1–120 characters · content: 1–100,000 characters · description: up to 500 · tags: up to 10 · visibility: public, unlisted, or secret. Errors use a consistent <code className="text-violet-300">{'{ error: { code, message, details }, requestId }'}</code> envelope.</p></section></div>;
}

function Settings({ preferences, onChange, onClear }: { preferences: Preferences; onChange: (value: Preferences) => void; onClear: () => void }) {
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => onChange({ ...preferences, [key]: value });
  return <div className="mx-auto max-w-3xl"><div className="mb-6"><p className="text-sm font-semibold text-violet-400">This browser only</p><h1 className="mt-1 text-3xl font-bold">Settings</h1><p className="mt-2 text-sm text-gray-500">Genuinely functional preferences, stored locally and never uploaded.</p></div><div className="glass-card divide-y divide-white/[0.05]">{[
    ['Theme', <select className="field max-w-48" value={preferences.theme} onChange={(e) => set('theme', e.target.value as Preferences['theme'])}><option value="dark">Dark</option><option value="light">Light</option><option value="system">System</option></select>],
    ['Editor font size', <input aria-label="Editor font size" type="range" min="11" max="20" value={preferences.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))} />],
    ['Editor tab size', <select className="field max-w-48" value={preferences.tabSize} onChange={(e) => set('tabSize', Number(e.target.value))}><option value="2">2 spaces</option><option value="4">4 spaces</option></select>],
    ['Default language', <select className="field max-w-48" value={preferences.language} onChange={(e) => set('language', e.target.value)}><option>Plain Text</option><option>JavaScript</option><option>TypeScript</option><option>Python</option></select>],
    ['Default visibility', <select className="field max-w-48" value={preferences.visibility} onChange={(e) => set('visibility', e.target.value as Preferences['visibility'])}><option value="public">Public</option><option value="unlisted">Unlisted</option></select>],
    ['Density', <select className="field max-w-48" value={preferences.density} onChange={(e) => set('density', e.target.value as Preferences['density'])}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select>],
    ['Reduced motion', <input aria-label="Reduced motion" type="checkbox" checked={preferences.reducedMotion} onChange={(e) => set('reducedMotion', e.target.checked)} className="h-5 w-5 accent-violet-500" />],
    ['Automatic draft saving', <input aria-label="Automatic draft saving" type="checkbox" checked={preferences.autosave} onChange={(e) => set('autosave', e.target.checked)} className="h-5 w-5 accent-violet-500" />],
  ].map(([label, control]) => <div key={label as string} className="flex items-center justify-between gap-4 p-5"><span className="text-sm font-medium">{label as string}</span>{control}</div>)}</div><button onClick={onClear} className="btn-secondary mt-4 !text-red-300">Clear local preferences</button></div>;
}

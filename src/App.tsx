import { useCallback, useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import HeroCard from './components/HeroCard';
import StatsCards from './components/StatsCards';
import RecentPastes from './components/RecentPastes';
import RightSidebar from './components/RightSidebar';
import PasteModal from './components/PasteModal';
import { api } from './api';
import type { Paste, Stats } from './types';

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, public: 0, views: 0, bytes: 0 });
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'view' | null>(null);
  const [selected, setSelected] = useState<Paste | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [pasteResponse, statResponse] = await Promise.all([api.list(search), api.stats()]);
      setPastes(pasteResponse.data);
      setStats(statResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the API');
    } finally {
      setLoading(false);
    }
  }, [search]);
  useEffect(() => { const timer = setTimeout(load, 180); return () => clearTimeout(timer); }, [load]);

  async function viewPaste(id: string) {
    try { setSelected(await api.get(id)); setModal('view'); await load(); } catch (err) { setError((err as Error).message); }
  }
  async function createPaste(data: Pick<Paste, 'title' | 'content' | 'language' | 'visibility'>) {
    try { setSaving(true); await api.create(data); setModal(null); await load(); } catch (err) { setError((err as Error).message); } finally { setSaving(false); }
  }
  async function deletePaste(id: string) {
    if (!window.confirm('Delete this paste permanently?')) return;
    try { await api.delete(id); await load(); } catch (err) { setError((err as Error).message); }
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white font-sans">
      {/* Background ambient effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/[0.03] rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/[0.02] rounded-full blur-[150px]" />
      </div>

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main area */}
      <div
        className={`
          relative min-h-screen transition-all duration-300 ease-out
          ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-[260px]'}
        `}
      >
        {/* Top Navigation */}
        <TopNav search={search} onSearch={setSearch} onCreate={() => setModal('create')} />

        {/* Content */}
        <main className="p-4 sm:p-6">
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Main content */}
            <div className="flex-1 min-w-0 space-y-6">
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">API unavailable: {error}. Start the project with <code>npm run dev</code>.</div>}
              <HeroCard onCreate={() => setModal('create')} docsUrl={api.docsUrl} />
              <StatsCards stats={stats} />
              <RecentPastes pastes={pastes} loading={loading} onView={viewPaste} onDelete={deletePaste} />
            </div>

            {/* Right sidebar */}
            <div className="w-full xl:w-[300px] flex-shrink-0">
              <RightSidebar onCreate={() => setModal('create')} pastes={pastes} />
            </div>
          </div>
        </main>
      </div>
      {modal && <PasteModal mode={modal} paste={selected} saving={saving} onClose={() => { setModal(null); setSelected(null); }} onCreate={createPaste} />}
    </div>
  );
}

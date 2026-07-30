import { BarChart3, Code2, Compass, FilePlus, FileText, Heart, LayoutDashboard, Menu, Settings, TerminalSquare, X } from 'lucide-react';

export type View = 'dashboard' | 'new' | 'pastes' | 'explore' | 'favorites' | 'analytics' | 'api' | 'settings';
const items: { icon: typeof LayoutDashboard; label: string; view: View }[] = [
  { icon: LayoutDashboard, label: 'Dashboard', view: 'dashboard' },
  { icon: FilePlus, label: 'New Paste', view: 'new' },
  { icon: FileText, label: 'My Pastes', view: 'pastes' },
  { icon: Compass, label: 'Explore', view: 'explore' },
  { icon: Heart, label: 'Favorites', view: 'favorites' },
  { icon: BarChart3, label: 'Analytics', view: 'analytics' },
  { icon: TerminalSquare, label: 'API Playground', view: 'api' },
  { icon: Settings, label: 'Settings', view: 'settings' },
];

export default function Sidebar({ open, view, onClose, onOpen, onNavigate }: {
  open: boolean; view: View; onClose: () => void; onOpen: () => void; onNavigate: (view: View) => void;
}) {
  return <>
    {open && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={onClose} />}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-white/[0.06] bg-dark-950/95 backdrop-blur-2xl transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5">
        <button onClick={() => onNavigate('dashboard')} className="focus-ring flex items-center gap-3 rounded-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20"><Code2 className="h-5 w-5" /></span>
          <span><span className="block text-left text-lg font-bold text-gradient">PasteBin</span><span className="block text-left text-[9px] uppercase tracking-[.22em] text-gray-600">Developer snippets</span></span>
        </button>
        <button aria-label="Close navigation" onClick={onClose} className="icon-button lg:hidden"><X className="h-5 w-5" /></button>
      </div>
      <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map(({ icon: Icon, label, view: itemView }) => <button key={itemView} aria-current={view === itemView ? 'page' : undefined} onClick={() => { onNavigate(itemView); onClose(); }} className={`focus-ring flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium ${view === itemView ? 'border-violet-500/20 bg-gradient-to-r from-violet-600/20 to-purple-600/5 text-white' : 'border-transparent text-gray-400 hover:bg-white/[0.04] hover:text-white'}`}>
          <Icon className={`h-[18px] w-[18px] ${view === itemView ? 'text-violet-400' : ''}`} />{label}
        </button>)}
      </nav>
      <div className="border-t border-white/[0.06] p-4"><div className="rounded-xl bg-white/[0.025] p-3"><p className="text-xs font-medium text-gray-300">Local-first workspace</p><p className="mt-1 text-[11px] leading-4 text-gray-600">No accounts, subscriptions, or fabricated data.</p></div></div>
    </aside>
    <button aria-label="Open navigation" onClick={onOpen} className="focus-ring fixed left-4 top-3.5 z-20 flex h-10 w-10 items-center justify-center rounded-xl glass lg:hidden"><Menu className="h-5 w-5" /></button>
  </>;
}

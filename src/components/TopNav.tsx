import { Command, Plus, Search } from 'lucide-react';
export default function TopNav({ search, onSearch, onCreate, onPalette, showSearch }: { search: string; onSearch: (value: string) => void; onCreate: () => void; onPalette: () => void; showSearch: boolean }) {
  return <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-white/[0.04] bg-dark-950/90 px-4 pl-16 backdrop-blur-2xl sm:gap-3 sm:px-6 sm:pl-16 lg:pl-6">
    {showSearch ? <label className="relative min-w-0 flex-1 sm:max-w-xl"><span className="sr-only">Search pastes</span><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" /><input type="search" placeholder="Search snippets, tags, languages…" value={search} onChange={(e) => onSearch(e.target.value)} className="field py-2.5 pl-10" /></label> : <div className="flex-1" />}
    <button onClick={onPalette} aria-label="Open command palette" className="btn-secondary focus-ring hidden items-center gap-2 !px-3 sm:flex"><Command className="h-4 w-4" /><span className="text-xs text-gray-500">K</span></button>
    <button onClick={onCreate} className="btn-primary focus-ring flex shrink-0 items-center gap-2"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New Paste</span><span className="sm:hidden">New</span></button>
  </header>;
}

import {
  Search,
  Bell,
  Moon,
  Sun,
  Plus,
  Command,
} from 'lucide-react';
import { useState } from 'react';

interface Props { search: string; onSearch: (value: string) => void; onCreate: () => void }
export default function TopNav({ search, onSearch, onCreate }: Props) {
  const [isDark, setIsDark] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-6 bg-dark-950/60 backdrop-blur-2xl border-b border-white/[0.04]">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div
          className={`
            relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl
            transition-all duration-300
            ${searchFocused
              ? 'glass border-violet-500/30 shadow-lg shadow-violet-500/5'
              : 'glass hover:bg-white/[0.06]'
            }
          `}
        >
          <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${searchFocused ? 'text-violet-400' : 'text-gray-500'}`} />
          <input
            type="text"
            placeholder="Search title or language..."
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] text-gray-500 border border-white/[0.06]">
            <Command className="w-3 h-3" />K
          </kbd>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2 ml-4">
        {/* Notifications */}
        <button className="relative w-10 h-10 rounded-xl glass-hover flex items-center justify-center text-gray-400 hover:text-white transition-all group">
          <Bell className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-violet-500 rounded-full animate-pulse-dot" />
        </button>

        {/* Dark mode toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="w-10 h-10 rounded-xl glass-hover flex items-center justify-center text-gray-400 hover:text-amber-400 transition-all group"
        >
          {isDark ? (
            <Moon className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
          ) : (
            <Sun className="w-[18px] h-[18px] group-hover:scale-110 transition-transform" />
          )}
        </button>

        {/* New Paste button */}
        <button onClick={onCreate} className="btn-primary flex items-center gap-2 ml-1">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Paste</span>
        </button>

        {/* User avatar */}
        <button className="ml-1 flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white ring-2 ring-transparent group-hover:ring-violet-500/30 transition-all">
            G
          </div>
          <svg className="w-3 h-3 text-gray-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </header>
  );
}

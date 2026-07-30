import {
  LayoutDashboard,
  FilePlus,
  FileText,
  Share2,
  Star,
  BarChart3,
  Settings,
  LogOut,
  Code2,
  ChevronLeft,
  Menu,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: FilePlus, label: 'New Paste', active: false },
  { icon: FileText, label: 'My Pastes', active: false },
  { icon: Share2, label: 'Shared', active: false },
  { icon: Star, label: 'Favorites', active: false },
  { icon: BarChart3, label: 'Analytics', active: false },
  { icon: Settings, label: 'Settings', active: false },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const [activeItem, setActiveItem] = useState('Dashboard');

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          ${collapsed ? '-translate-x-full lg:translate-x-0 lg:w-20' : 'translate-x-0 w-[260px]'}
          bg-dark-950/80 backdrop-blur-2xl
          border-r border-white/[0.06]
          flex flex-col
          transition-all duration-300 ease-out
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="text-lg font-bold text-gradient">PasteBin</span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition-all"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActiveItem(item.label)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200 group relative
                  ${isActive
                    ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/10 text-white border border-violet-500/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.04]'
                  }
                  ${collapsed ? 'justify-center lg:px-0' : ''}
                `}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-violet-400 to-purple-500 rounded-r-full" />
                )}
                <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-violet-400' : 'group-hover:text-violet-400'} transition-colors`} />
                {!collapsed && <span>{item.label}</span>}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-dark-800 rounded-lg text-xs text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl border border-white/10">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-white/[0.06]">
          <div className={`flex items-center gap-3 p-3 rounded-xl glass-card-hover cursor-pointer ${collapsed ? 'justify-center px-2' : ''}`}>
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-sm font-bold text-white">
                G
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-dark-950 animate-pulse-dot" />
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Gayathri</p>
                <p className="text-xs text-gray-500 truncate">gayathri@example.com</p>
              </div>
            )}
          </div>

          {/* Pro Badge */}
          {!collapsed && (
            <div className="mt-2 mx-1 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600/10 to-purple-600/10 border border-violet-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-violet-300">Pro Plan</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">Active</span>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            className={`
              mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              text-gray-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all duration-200
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="w-[18px] h-[18px]" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 rounded-xl glass flex items-center justify-center text-gray-400 hover:text-white"
      >
        <Menu className="w-5 h-5" />
      </button>
    </>
  );
}

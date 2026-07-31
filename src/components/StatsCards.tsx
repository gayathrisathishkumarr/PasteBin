import { Database, Eye, FileText, GitFork, Globe, Heart } from 'lucide-react';
import type { Stats } from '../types';
export function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`; return `${(value / 1048576).toFixed(1)} MB`; }
export default function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    ['Total pastes', stats.total, FileText, 'text-violet-400'], ['Public', stats.public, Globe, 'text-cyan-400'],
    ['Favorites', stats.favorites, Heart, 'text-pink-400'], ['Views', stats.views, Eye, 'text-emerald-400'],
    ['Forks', stats.forks, GitFork, 'text-blue-400'], ['Storage', formatBytes(stats.bytes), Database, 'text-amber-400'],
  ] as const;
  return <section aria-label="Paste statistics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([label, value, Icon, color]) => <div key={label} className="glass-card p-4"><Icon className={`mb-3 h-4 w-4 ${color}`} /><p className="text-xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p></div>)}</section>;
}

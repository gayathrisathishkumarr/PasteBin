import {
  Eye,
  Link2,
  Trash2,
  ArrowRight,
  Globe,
  Lock,
  EyeOff,
} from 'lucide-react';
import type { Paste } from '../types';

const languageColors: Record<string, { bg: string; text: string; dot: string }> = {
  JavaScript: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400' },
  Python: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-400' },
  React: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  TypeScript: { bg: 'bg-blue-600/10', text: 'text-blue-300', dot: 'bg-blue-300' },
  SQL: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  YAML: { bg: 'bg-pink-500/10', text: 'text-pink-400', dot: 'bg-pink-400' },
};

const visibilityConfig = {
  Public: { icon: Globe, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  Private: { icon: Lock, bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  Unlisted: { icon: EyeOff, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
} as const;

function age(date: string) {
  const seconds = Math.floor((Date.now() - new Date(`${date.replace(' ', 'T')}Z`).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface Props { pastes: Paste[]; loading: boolean; onView: (id: string) => void; onDelete: (id: string) => void }
export default function RecentPastes({ pastes, loading, onView, onDelete }: Props) {
  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-0">
        <h2 className="text-lg font-semibold text-white">Recent Pastes</h2>
        <button className="flex items-center gap-1.5 text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors group">
          View all pastes
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.04]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Language</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Visibility</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && pastes.length === 0 && <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-gray-500">No pastes yet. Create your first snippet to get started.</td></tr>}
            {pastes.map((paste) => {
              const lang = languageColors[paste.language] || languageColors.JavaScript;
              const visibility = `${paste.visibility[0].toUpperCase()}${paste.visibility.slice(1)}` as keyof typeof visibilityConfig;
              const vis = visibilityConfig[visibility];
              const VisIcon = vis.icon;

              return (
                <tr
                  key={paste.id}
                  className="border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors group cursor-pointer"
                >
                  {/* Title */}
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors">
                        {paste.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{paste.content.slice(0, 70)}</p>
                    </div>
                  </td>

                  {/* Language */}
                  <td className="px-5 py-4">
                    <span className={`badge ${lang.bg} ${lang.text} border border-white/[0.04]`}>
                      <span className={`w-2 h-2 rounded-full ${lang.dot}`} />
                      {paste.language}
                    </span>
                  </td>

                  {/* Visibility */}
                  <td className="px-5 py-4">
                    <span className={`badge ${vis.bg} ${vis.text} border ${vis.border}`}>
                      <VisIcon className="w-3 h-3" />
                      {visibility}
                    </span>
                  </td>

                  {/* Created */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-400">{age(paste.created_at)}</span>
                  </td>

                  {/* Views */}
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-400">{paste.views}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onView(paste.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/[0.06] transition-all"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?paste=${paste.id}`)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-violet-400 hover:bg-violet-500/[0.06] transition-all"
                        title="Copy Link"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(paste.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center p-4 border-t border-white/[0.04]">
        <button className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-violet-400 transition-colors group">
          View all pastes
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

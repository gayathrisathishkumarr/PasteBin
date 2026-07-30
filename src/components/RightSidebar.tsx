import {
  Plus,
  Upload,
  Github,
  FileCode,
  ArrowRight,
  Clock,
} from 'lucide-react';
import type { Paste } from '../types';

const quickActions = [
  {
    icon: Plus,
    label: 'Create New Paste',
    description: 'Start from scratch',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    hoverBg: 'hover:bg-violet-500/15',
  },
  {
    icon: Upload,
    label: 'Upload File',
    description: 'Import from file',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    hoverBg: 'hover:bg-blue-500/15',
  },
  {
    icon: FileCode,
    label: 'Create from Template',
    description: 'Use a template',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    hoverBg: 'hover:bg-emerald-500/15',
  },
  {
    icon: Github,
    label: 'Import from GitHub',
    description: 'Sync from repo',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    hoverBg: 'hover:bg-orange-500/15',
  },
];

const recentActivity = [
  {
    title: 'React Authentication Context',
    time: '2 mins ago',
    color: 'bg-cyan-400',
  },
  {
    title: 'Python Data Analysis Script',
    time: '15 mins ago',
    color: 'bg-blue-400',
  },
  {
    title: 'Next.js API Route Example',
    time: '1 hour ago',
    color: 'bg-blue-300',
  },
  {
    title: 'PostgreSQL Query Optimization',
    time: '2 hours ago',
    color: 'bg-emerald-400',
  },
];

export default function RightSidebar({ onCreate, pastes }: { onCreate: () => void; pastes: Paste[] }) {
  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
        <div className="space-y-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.label === 'Create New Paste' ? onCreate : undefined}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 group ${action.hoverBg} hover:scale-[1.01]`}
              >
                <div className={`w-9 h-9 rounded-lg ${action.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-4 h-4 ${action.color}`} />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors truncate">
                    {action.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {(pastes.length ? pastes.slice(0, 4).map((paste, index) => ({
            title: paste.title,
            time: new Date(`${paste.created_at.replace(' ', 'T')}Z`).toLocaleDateString(),
            color: ['bg-cyan-400', 'bg-blue-400', 'bg-violet-400', 'bg-emerald-400'][index],
          })) : recentActivity).map((activity, index) => (
            <div
              key={index}
              className="flex items-start gap-3 group cursor-pointer"
            >
              <div className="relative mt-1.5 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full ${activity.color}`} />
                {index < recentActivity.length - 1 && (
                  <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-6 bg-white/[0.06]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                  {activity.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <span className="text-xs text-gray-500">{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="w-full flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-white/[0.04] text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors group">
          View all activity
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}

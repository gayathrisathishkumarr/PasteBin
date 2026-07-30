import {
  FileText,
  Globe,
  Eye,
  HardDrive,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Stats } from '../types';

export default function StatsCards({ stats }: { stats: Stats }) {
const cards = [
  {
    label: 'Total Pastes',
    value: stats.total.toLocaleString(),
    trend: '+12%',
    trendUp: true,
    trendLabel: 'from last month',
    icon: FileText,
    color: 'from-violet-500 to-purple-500',
    iconBg: 'bg-violet-500/10',
    iconColor: 'text-violet-400',
  },
  {
    label: 'Public Pastes',
    value: stats.public.toLocaleString(),
    trend: '+8%',
    trendUp: true,
    trendLabel: 'from last month',
    icon: Globe,
    color: 'from-blue-500 to-cyan-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
  },
  {
    label: 'Total Views',
    value: stats.views.toLocaleString(),
    trend: '+18%',
    trendUp: true,
    trendLabel: 'from last month',
    icon: Eye,
    color: 'from-emerald-500 to-teal-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
  },
  {
    label: 'Storage Used',
    value: stats.bytes < 1024 ? `${stats.bytes} B` : `${(stats.bytes / 1024).toFixed(1)} KB`,
    trend: '+6%',
    trendUp: true,
    trendLabel: 'from last month',
    icon: HardDrive,
    color: 'from-orange-500 to-amber-500',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
  },
];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="glass-card-hover p-5 group cursor-default"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${stat.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {stat.trendUp ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              )}
              <span className={`text-xs font-semibold ${stat.trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {stat.trend}
              </span>
              <span className="text-xs text-gray-500">{stat.trendLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

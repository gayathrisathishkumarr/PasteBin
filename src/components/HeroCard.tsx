import { Plus, BookOpen, Sparkles } from 'lucide-react';

export default function HeroCard({ onCreate, docsUrl }: { onCreate: () => void; docsUrl: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-card gradient-border group">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-purple-600/5 to-blue-600/10 animate-gradient" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-violet-500/10 to-transparent rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-blue-500/10 to-transparent rounded-full blur-3xl" />

      {/* Decorative code icon */}
      <div className="absolute top-6 right-6 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
        <div className="relative">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center animate-float">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-violet-400 animate-pulse" />
        </div>
      </div>

      <div className="relative p-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">👋</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
          Welcome back, <span className="text-gradient">Gayathri</span>!
        </h1>
        <p className="text-gray-400 text-sm sm:text-base max-w-md">
          Create, manage and share code snippets instantly.
        </p>

        <div className="flex flex-wrap items-center gap-3 mt-6">
          <button onClick={onCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Paste
          </button>
          <a href={docsUrl} target="_blank" rel="noreferrer" className="btn-secondary flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            API Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

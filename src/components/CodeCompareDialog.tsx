import { GitCompareArrows, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import type { Paste } from '../types';

function lines(content: string) { return content.split('\n').slice(0, 400); }

export default function CodeCompareDialog({ left, right, onClose }: { left: Paste; right: Paste; onClose: () => void }) {
  const comparison = useMemo(() => {
    const a = lines(left.content); const b = lines(right.content); const total = Math.max(a.length, b.length);
    const changed = Array.from({ length: total }, (_, index) => a[index] !== b[index]).filter(Boolean).length;
    return { a, b, total, changed };
  }, [left, right]);
  useEffect(() => { const key = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); addEventListener('keydown', key); return () => removeEventListener('keydown', key); }, [onClose]);

  const panel = (paste: Paste, content: string[], other: string[]) => <section className="min-w-0">
    <div className="border-b border-white/[0.06] p-4"><p className="truncate font-semibold">{paste.title}</p><p className="mt-1 text-xs text-gray-500">{paste.language} · version {paste.version} · {content.length} lines</p></div>
    <ol className="max-h-[58vh] overflow-auto p-3 font-mono text-[11px] leading-5">{content.map((line, index) => <li key={index} className={`grid grid-cols-[34px_1fr] rounded px-1 ${line !== other[index] ? 'bg-amber-400/[0.08] text-amber-100' : 'text-gray-400'}`}><span className="select-none pr-2 text-right text-gray-700">{index + 1}</span><code className="whitespace-pre-wrap break-words">{line || ' '}</code></li>)}</ol>
  </section>;

  return <div className="modal-backdrop !p-3" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="compare-title" className="w-full max-w-6xl overflow-hidden rounded-2xl border border-cyan-400/15 bg-dark-900 shadow-2xl">
    <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] p-4 sm:p-5"><div><p className="flex items-center gap-2 text-xs font-semibold text-cyan-300"><GitCompareArrows className="h-4 w-4" />Lineage comparison</p><h2 id="compare-title" className="mt-1 text-lg font-bold">{comparison.changed} of {comparison.total} aligned lines differ</h2><p className="mt-1 text-xs text-gray-600">Changed rows are highlighted. Long files show their first 400 lines.</p></div><button autoFocus aria-label="Close comparison" onClick={onClose} className="icon-button"><X className="h-4 w-4" /></button></header>
    <div className="grid divide-y divide-white/[0.06] md:grid-cols-2 md:divide-x md:divide-y-0">{panel(left, comparison.a, comparison.b)}{panel(right, comparison.b, comparison.a)}</div>
  </section></div>;
}

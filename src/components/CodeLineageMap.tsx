import { ArrowUpRight, Braces, GitCompareArrows, GitFork, Network, ScanSearch, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LineageEdge, LineageGraph, LineageNode } from '../types';

const palette = [
  { node: 'border-violet-400/40 bg-violet-500/15 text-violet-200', dot: '#8b5cf6' },
  { node: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200', dot: '#22d3ee' },
  { node: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200', dot: '#34d399' },
  { node: 'border-amber-400/40 bg-amber-500/15 text-amber-200', dot: '#fbbf24' },
  { node: 'border-pink-400/40 bg-pink-500/15 text-pink-200', dot: '#f472b6' },
  { node: 'border-blue-400/40 bg-blue-500/15 text-blue-200', dot: '#60a5fa' },
];

function hash(value: string) {
  let result = 0;
  for (const character of value) result = ((result << 5) - result + character.charCodeAt(0)) | 0;
  return Math.abs(result);
}

function color(language: string) { return palette[hash(language) % palette.length]; }

function positions(nodes: LineageNode[]) {
  return new Map(nodes.map((node, index) => {
    if (index === 0) return [node.id, { x: 50, y: 50 }];
    const angle = index * 2.399963;
    const radius = 24 + ((index - 1) % 3) * 9;
    return [node.id, { x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius * 0.72 }];
  }));
}

function connected(edge: LineageEdge, id: string) { return edge.source === id || edge.target === id; }
function countLabel(count: number, singular: string, plural = `${singular}s`) { return `${count} ${count === 1 ? singular : plural}`; }

export default function CodeLineageMap({ graph, loading, error, onOpen, onCompare, onRetry }: {
  graph: LineageGraph | null;
  loading: boolean;
  error?: string;
  onOpen: (id: string) => void;
  onCompare: (left: string, right: string) => void;
  onRetry: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const active = nodes.find((node) => node.id === activeId) || nodes[0];
  const nodePositions = useMemo(() => positions(nodes), [nodes]);
  const relationships = active ? edges.filter((edge) => connected(edge, active.id)) : [];
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  return <section className="lineage-card overflow-hidden rounded-2xl border border-violet-500/15" aria-labelledby="lineage-title">
    <div className="flex flex-col justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:flex-row sm:items-center">
      <div>
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-400"><Sparkles className="h-3.5 w-3.5" />PasteBin original</p>
        <h2 id="lineage-title" className="mt-1 text-xl font-bold">Code Lineage Map</h2>
        <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500">See where snippets came from, which code evolved together, and where duplication is quietly growing.</p>
      </div>
      {graph && <div className="flex flex-wrap gap-2 text-[11px] text-gray-400"><span className="lineage-chip"><Network />{countLabel(graph.meta.totalNodes, 'node')}</span><span className="lineage-chip"><GitFork />{countLabel(graph.meta.totalEdges, 'link')}</span><span className="lineage-chip"><Braces />{countLabel(graph.meta.languages, 'language')}</span></div>}
    </div>

    {loading ? <div role="status" className="grid min-h-[390px] place-items-center"><span className="animate-pulse text-sm text-violet-300">Tracing code relationships…</span></div> : error ? <div className="grid min-h-[300px] place-items-center p-6 text-center"><div><p className="text-sm text-red-300">{error}</p><button onClick={onRetry} className="btn-secondary mt-3">Retry map</button></div></div> : !graph || nodes.length < 2 ? <div className="grid min-h-[320px] place-items-center p-8 text-center"><div><ScanSearch className="mx-auto h-10 w-10 text-violet-400/50" /><p className="mt-3 font-medium">The map needs at least two snippets</p><p className="mt-1 text-sm text-gray-500">Create or fork another paste and its relationships will appear automatically.</p></div></div> :
      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="overflow-x-auto border-b border-white/[0.06] lg:border-b-0 lg:border-r">
          <div className="relative h-[390px] min-w-[680px] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.12),transparent_58%)]">
            <div aria-hidden="true" className="lineage-grid absolute inset-0" />
            <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {edges.map((edge) => {
                const start = nodePositions.get(edge.source); const end = nodePositions.get(edge.target);
                if (!start || !end) return null;
                const highlighted = active ? connected(edge, active.id) : false;
                return <g key={`${edge.type}-${edge.source}-${edge.target}`}>
                  <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke={edge.type === 'fork' ? '#8b5cf6' : '#22d3ee'} strokeWidth={highlighted ? 0.55 : 0.25} strokeOpacity={highlighted ? 0.9 : 0.34} strokeDasharray={edge.type === 'similar' ? '1.2 1.3' : undefined} />
                  {highlighted && <circle className="lineage-pulse" r="0.8" fill={edge.type === 'fork' ? '#c4b5fd' : '#67e8f9'}><animateMotion dur="3.2s" repeatCount="indefinite" path={`M ${start.x} ${start.y} L ${end.x} ${end.y}`} /></circle>}
                </g>;
              })}
            </svg>
            {nodes.map((node) => {
              const point = nodePositions.get(node.id)!; const tone = color(node.language); const selected = active?.id === node.id;
              return <button key={node.id} aria-pressed={selected} aria-label={`Inspect ${node.title}, ${node.language}`} onClick={() => setActiveId(node.id)} style={{ left: `${point.x}%`, top: `${point.y}%` }} className={`lineage-node absolute max-w-[142px] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 text-left shadow-xl transition ${tone.node} ${selected ? 'z-10 scale-110 ring-2 ring-white/20' : 'hover:z-10 hover:scale-105'}`}>
                <span className="block truncate text-[11px] font-semibold">{node.title}</span><span className="mt-1 block truncate text-[9px] opacity-60">{node.language} · v{node.version}</span>
                <span aria-hidden="true" className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-4 ring-dark-950" style={{ backgroundColor: tone.dot }} />
              </button>;
            })}
            <div className="absolute bottom-3 left-4 flex gap-4 text-[10px] text-gray-600"><span className="flex items-center gap-1.5"><i className="h-px w-5 bg-violet-400" />Fork</span><span className="flex items-center gap-1.5"><i className="w-5 border-t border-dashed border-cyan-400" />Similar code</span></div>
          </div>
        </div>

        <aside className="min-h-[390px] p-5" aria-live="polite">
          {active && <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className={`inline-flex rounded-md border px-2 py-1 text-[10px] ${color(active.language).node}`}>{active.language}</span><h3 className="mt-3 truncate font-semibold">{active.title}</h3><p className="mt-1 text-xs text-gray-600">Version {active.version} · {countLabel(active.revisionCount, 'saved revision')}</p></div><button aria-label={`Open ${active.title}`} onClick={() => onOpen(active.id)} className="icon-button"><ArrowUpRight className="h-4 w-4" /></button></div>
            <div className="my-4 h-px bg-white/[0.06]" />
            <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-600">Why it connects</h4>
            {relationships.length ? <ul className="mt-3 space-y-2">{relationships.slice(0, 5).map((edge) => { const otherId = edge.source === active.id ? edge.target : edge.source; const other = nodeById.get(otherId); if (!other) return null; return <li key={`${edge.type}-${otherId}`} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-gray-300">{other.title}</p><p className="mt-1 text-[10px] text-gray-600">{edge.reasons[0]}</p></div><button aria-label={`Compare ${active.title} with ${other.title}`} title="Compare snippets" onClick={() => onCompare(active.id, other.id)} className="text-gray-600 hover:text-cyan-300"><GitCompareArrows className="h-4 w-4" /></button></div></li>; })}</ul> : <p className="mt-3 text-xs leading-5 text-gray-600">No strong relationship yet. Fork this snippet or create structurally similar code to reveal a connection.</p>}
            <button onClick={() => onOpen(active.id)} className="btn-secondary mt-4 w-full">Open snippet</button>
          </>}
        </aside>
      </div>}
    <div className="flex flex-col justify-between gap-2 border-t border-white/[0.06] px-5 py-3 text-[10px] text-gray-600 sm:flex-row"><span>Private calculation: source code never leaves your API.</span><span>Similarity: deterministic token-set Jaccard · no AI required</span></div>
  </section>;
}

import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import type { Paste } from '../types';

interface Props {
  mode: 'create' | 'view';
  paste?: Paste | null;
  saving?: boolean;
  onClose: () => void;
  onCreate: (data: Pick<Paste, 'title' | 'content' | 'language' | 'visibility'>) => void;
}

export default function PasteModal({ mode, paste, saving, onClose, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('Plain Text');
  const [visibility, setVisibility] = useState<Paste['visibility']>('public');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (paste) {
      setTitle(paste.title); setContent(paste.content); setLanguage(paste.language); setVisibility(paste.visibility);
    }
  }, [paste]);

  const readonly = mode === 'view';
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl shadow-violet-950/40" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
          <div><p className="text-xs uppercase tracking-[.2em] text-violet-400">{readonly ? language : 'New snippet'}</p><h2 className="text-xl font-semibold mt-1">{readonly ? title : 'Create a paste'}</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!readonly && <input className="field" placeholder="A clear title" value={title} onChange={(e) => setTitle(e.target.value)} />}
          {!readonly && <div className="grid sm:grid-cols-2 gap-4">
            <select className="field" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {['Plain Text', 'JavaScript', 'TypeScript', 'Python', 'React', 'SQL', 'YAML', 'JSON', 'Bash'].map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field" value={visibility} onChange={(e) => setVisibility(e.target.value as Paste['visibility'])}>
              <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
            </select>
          </div>}
          <div className="relative">
            <textarea className="field min-h-[340px] font-mono text-[13px] leading-6 resize-y" placeholder="Paste text or code here..." value={content} readOnly={readonly} onChange={(e) => setContent(e.target.value)} />
            {readonly && <button onClick={async () => { await navigator.clipboard.writeText(content); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="absolute right-3 top-3 btn-secondary !p-2">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>}
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="btn-secondary">{readonly ? 'Close' : 'Cancel'}</button>
            {!readonly && <button disabled={saving || !title.trim() || !content} onClick={() => onCreate({ title, content, language, visibility })} className="btn-primary disabled:opacity-40">{saving ? 'Creating...' : 'Create paste'}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

